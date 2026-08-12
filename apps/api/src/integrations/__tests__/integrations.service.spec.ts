import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IntegrationCategory, IntegrationStatus } from '@prisma/client';
import { IntegrationsService } from '../integrations.service';
import { IntegrationEncryptionService } from '../integration-encryption.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let encryption: IntegrationEncryptionService;
  let prisma: any;

  const baseProvider = {
    id: 'ip1',
    entityId: null,
    category: IntegrationCategory.EMAIL,
    providerCode: 'SMTP',
    name: 'Company SMTP',
    status: IntegrationStatus.INACTIVE,
    isActive: true,
    config: { host: 'smtp.example.com' },
    encryptedCredentials: null as string | null,
    retryMaxAttempts: 3,
    retryBackoffMs: 2000,
    lastHealthCheckAt: null,
    lastHealthCheckOk: null,
    lastHealthCheckError: null,
    createdById: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'test-key-for-unit-tests-only';
    process.env.NODE_ENV = 'test';

    prisma = {
      integrationProvider: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        IntegrationEncryptionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(IntegrationsService);
    encryption = moduleRef.get(IntegrationEncryptionService);
  });

  describe('encryption round-trip', () => {
    it('decrypts exactly what was encrypted', () => {
      const secret = { apiKey: 'sk_live_abc123', accountSid: 'AC999' };
      const blob = encryption.encrypt(secret);
      expect(blob.split(':')).toHaveLength(3);
      expect(encryption.decrypt(blob)).toEqual(secret);
    });

    it('fails to decrypt a tampered blob (auth tag mismatch)', () => {
      const blob = encryption.encrypt({ apiKey: 'sk_live_abc123' });
      const [iv, tag, ciphertext] = blob.split(':');
      const tampered = `${iv}:${tag}:${ciphertext.slice(0, -2)}00`;
      expect(() => encryption.decrypt(tampered)).toThrow();
    });
  });

  describe('createProvider', () => {
    it('encrypts plaintext credentials before persisting and never returns the blob', async () => {
      prisma.integrationProvider.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...baseProvider, ...data }),
      );

      const result = await service.createProvider(
        {
          category: IntegrationCategory.EMAIL,
          providerCode: 'SMTP',
          name: 'Company SMTP',
          credentials: { username: 'ops', password: 'hunter2' },
        } as any,
        'u1',
      );

      const persistedData = prisma.integrationProvider.create.mock.calls[0][0].data;
      expect(persistedData.encryptedCredentials).toBeDefined();
      expect(persistedData.encryptedCredentials).not.toContain('hunter2');
      expect((result as any).encryptedCredentials).toBeUndefined();
      expect((result as any).hasCredentials).toBe(true);
    });
  });

  describe('runHealthCheck', () => {
    it('marks status ACTIVE when the no-op driver reports credentials are present', async () => {
      const withCreds = { ...baseProvider, encryptedCredentials: encryption.encrypt({ apiKey: 'x' }) };
      prisma.integrationProvider.findUnique.mockResolvedValue(withCreds);
      prisma.integrationProvider.update.mockImplementation(({ data }: any) => Promise.resolve({ ...withCreds, ...data }));

      const result = await service.runHealthCheck('ip1');

      expect(result.status).toBe(IntegrationStatus.ACTIVE);
      expect(result.lastHealthCheckOk).toBe(true);
    });

    it('marks status ERROR when no credentials are configured', async () => {
      prisma.integrationProvider.findUnique.mockResolvedValue(baseProvider);
      prisma.integrationProvider.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseProvider, ...data }));

      const result = await service.runHealthCheck('ip1');

      expect(result.status).toBe(IntegrationStatus.ERROR);
      expect(result.lastHealthCheckOk).toBe(false);
    });

    it('marks status INACTIVE regardless of check result when the provider is deactivated', async () => {
      const inactive = { ...baseProvider, isActive: false, encryptedCredentials: encryption.encrypt({ apiKey: 'x' }) };
      prisma.integrationProvider.findUnique.mockResolvedValue(inactive);
      prisma.integrationProvider.update.mockImplementation(({ data }: any) => Promise.resolve({ ...inactive, ...data }));

      const result = await service.runHealthCheck('ip1');

      expect(result.status).toBe(IntegrationStatus.INACTIVE);
    });

    it('throws NotFoundException for an unknown provider', async () => {
      prisma.integrationProvider.findUnique.mockResolvedValue(null);
      await expect(service.runHealthCheck('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('rotateCredentials', () => {
    it('overwrites the encrypted blob with the newly-supplied credentials', async () => {
      prisma.integrationProvider.findUnique.mockResolvedValue(baseProvider);
      prisma.integrationProvider.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseProvider, ...data }));

      const result = await service.rotateCredentials('ip1', { credentials: { apiKey: 'new-key' } });
      expect((result as any).hasCredentials).toBe(true);
    });
  });
});
