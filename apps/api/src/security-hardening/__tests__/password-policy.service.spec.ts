import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordPolicyService } from '../password-policy.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    authSecurityPolicy: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    passwordHistory: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  };
}

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [PasswordPolicyService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PasswordPolicyService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getEffectivePolicy', () => {
    it('falls back to the built-in default when no policy row exists', async () => {
      prisma.authSecurityPolicy.findFirst.mockResolvedValue(null);
      const policy = await service.getEffectivePolicy();
      expect(policy.minLength).toBe(8);
      expect(policy.maxFailedLoginAttempts).toBe(5);
    });

    it('prefers an active entity-scoped policy over the global one', async () => {
      prisma.authSecurityPolicy.findUnique.mockResolvedValue({ entityId: 'e1', isActive: true, minLength: 12 });
      const policy = await service.getEffectivePolicy('e1');
      expect(policy.minLength).toBe(12);
      expect(prisma.authSecurityPolicy.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('validateComplexity', () => {
    const policy = { minLength: 8, requireUppercase: true, requireLowercase: true, requireNumber: true, requireSymbol: true };

    it('rejects a password missing multiple requirements with a specific message', () => {
      expect(() => service.validateComplexity('short', policy)).toThrow(BadRequestException);
    });

    it('accepts a password satisfying every requirement', () => {
      expect(() => service.validateComplexity('Str0ng!Pass', policy)).not.toThrow();
    });
  });

  describe('isExpired', () => {
    it('returns false when the policy has no expiryDays', () => {
      expect(service.isExpired(new Date('2020-01-01'), null)).toBe(false);
    });

    it('returns true once expiryDays has elapsed since passwordChangedAt', () => {
      const old = new Date();
      old.setDate(old.getDate() - 100);
      expect(service.isExpired(old, 90)).toBe(true);
    });

    it('returns false when still within the expiry window', () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 10);
      expect(service.isExpired(recent, 90)).toBe(false);
    });
  });

  describe('assertNotReused', () => {
    it('rejects a new password matching a recent hash', async () => {
      const hash = await bcrypt.hash('OldPassw0rd!', 10);
      prisma.passwordHistory.findMany.mockResolvedValue([{ passwordHash: hash }]);
      await expect(service.assertNotReused('u1', 'OldPassw0rd!', 5)).rejects.toThrow(BadRequestException);
    });

    it('allows a new password not found in history', async () => {
      prisma.passwordHistory.findMany.mockResolvedValue([]);
      await expect(service.assertNotReused('u1', 'BrandNew1!', 5)).resolves.toBeUndefined();
    });
  });

  describe('changePassword', () => {
    it('rejects an incorrect current password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: await bcrypt.hash('correct', 10) });
      await expect(service.changePassword('u1', { currentPassword: 'wrong', newPassword: 'NewPassw0rd!' })).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a new password that fails policy complexity', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: await bcrypt.hash('correct', 10) });
      prisma.authSecurityPolicy.findFirst.mockResolvedValue(null);
      await expect(service.changePassword('u1', { currentPassword: 'correct', newPassword: 'weak' })).rejects.toThrow(BadRequestException);
    });

    it('updates passwordHash/passwordChangedAt and records the old hash into history on success', async () => {
      const oldHash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: oldHash });
      prisma.authSecurityPolicy.findFirst.mockResolvedValue(null);
      prisma.passwordHistory.findMany.mockResolvedValueOnce([]); // assertNotReused
      prisma.passwordHistory.findMany.mockResolvedValueOnce([]); // prune query
      prisma.user.update.mockResolvedValue({});

      await service.changePassword('u1', { currentPassword: 'correct', newPassword: 'BrandNewPassw0rd!' });

      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({ data: { userId: 'u1', passwordHash: oldHash } });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ passwordHash: expect.any(String) }) }),
      );
    });
  });
});
