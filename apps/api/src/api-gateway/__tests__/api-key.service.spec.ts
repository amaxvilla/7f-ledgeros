import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyStatus } from '@prisma/client';
import { ApiKeyService } from '../api-key.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

function buildPrismaMock() {
  return {
    apiKey: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'u1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [ApiKeyService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ApiKeyService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateKey', () => {
    it('returns the plaintext key exactly once alongside the persisted record, and never persists the plaintext', async () => {
      prisma.apiKey.create.mockResolvedValue({ id: 'ak-1', keyPrefix: '7f_live_abcd' });

      const result = await service.generateKey({ entityId: 'e1', name: 'Partner Integration' }, 'u1');

      expect(result.plaintextKey).toMatch(/^7f_live_[0-9a-f]{64}$/);
      expect(result.apiKey).toEqual({ id: 'ak-1', keyPrefix: '7f_live_abcd' });

      const createArgs = prisma.apiKey.create.mock.calls[0][0].data;
      expect(createArgs.keyHash).not.toBe(result.plaintextKey);
      expect(createArgs.keyHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest
      expect(JSON.stringify(createArgs)).not.toContain(result.plaintextKey.slice(20)); // full raw key never in the persisted payload
    });

    it('defaults scopes to an empty array when not provided', async () => {
      prisma.apiKey.create.mockResolvedValue({});
      await service.generateKey({ entityId: 'e1', name: 'X' }, 'u1');
      expect(prisma.apiKey.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ scopes: [] }) }));
    });

    it('generates a different key (and hash) on every call', async () => {
      prisma.apiKey.create.mockResolvedValue({});
      const a = await service.generateKey({ entityId: 'e1', name: 'A' }, 'u1');
      const b = await service.generateKey({ entityId: 'e1', name: 'B' }, 'u1');
      expect(a.plaintextKey).not.toBe(b.plaintextKey);
    });

    it('persists an explicitly-provided rateLimitPerMinute (Checkpoint B)', async () => {
      prisma.apiKey.create.mockResolvedValue({});
      await service.generateKey({ entityId: 'e1', name: 'X', rateLimitPerMinute: 120 }, 'u1');
      expect(prisma.apiKey.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rateLimitPerMinute: 120 }) }));
    });

    it('leaves rateLimitPerMinute undefined (unlimited) when not provided', async () => {
      prisma.apiKey.create.mockResolvedValue({});
      await service.generateKey({ entityId: 'e1', name: 'X' }, 'u1');
      expect(prisma.apiKey.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rateLimitPerMinute: undefined }) }));
    });
  });

  describe('findKeys', () => {
    it('never selects keyHash', async () => {
      prisma.apiKey.findMany.mockResolvedValue([]);
      await service.findKeys(buildUnrestrictedScope(), 'e1');
      const selectArg = prisma.apiKey.findMany.mock.calls[0][0].select;
      expect(selectArg.keyHash).toBeUndefined();
    });
  });

  describe('revokeKey', () => {
    it('throws NotFoundException for a missing key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.revokeKey('missing', {}, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('rejects revoking an already-revoked key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'ak-1', status: ApiKeyStatus.REVOKED });
      await expect(service.revokeKey('ak-1', {}, 'u1')).rejects.toThrow(ConflictException);
    });

    it('revokes an ACTIVE key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'ak-1', status: ApiKeyStatus.ACTIVE });
      prisma.apiKey.update.mockResolvedValue({ id: 'ak-1', status: ApiKeyStatus.REVOKED });

      await service.revokeKey('ak-1', {}, 'admin-1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ak-1' }, data: expect.objectContaining({ status: ApiKeyStatus.REVOKED, revokedById: 'admin-1' }) }),
      );
    });
  });

  describe('validateKey', () => {
    it('rejects an unknown key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.validateKey('bogus')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a revoked key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'ak-1', status: ApiKeyStatus.REVOKED, expiresAt: null });
      await expect(service.validateKey('some-key')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired key even if still ACTIVE', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'ak-1', status: ApiKeyStatus.ACTIVE, expiresAt: new Date('2020-01-01') });
      await expect(service.validateKey('some-key')).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a valid, unexpired ACTIVE key and touches lastUsedAt', async () => {
      const key = { id: 'ak-1', status: ApiKeyStatus.ACTIVE, expiresAt: null };
      prisma.apiKey.findUnique.mockResolvedValue(key);
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.validateKey('some-key');

      expect(result).toBe(key);
      expect(prisma.apiKey.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ak-1' } }));
    });

    it('does not reject the request if the lastUsedAt write itself fails', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'ak-1', status: ApiKeyStatus.ACTIVE, expiresAt: null });
      prisma.apiKey.update.mockRejectedValue(new Error('db hiccup'));

      await expect(service.validateKey('some-key')).resolves.toBeDefined();
    });
  });
});
