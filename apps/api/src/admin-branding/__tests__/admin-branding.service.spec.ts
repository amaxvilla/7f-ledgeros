import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminBrandingService } from '../admin-branding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../storage/storage.interface';

function buildPrismaMock() {
  return {
    entity: { findUnique: jest.fn() },
    entityProfile: { upsert: jest.fn(), findUnique: jest.fn() },
    entityBrandingProfile: { upsert: jest.fn(), findUnique: jest.fn() },
    userPreference: { upsert: jest.fn(), findUnique: jest.fn() },
    brandAsset: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), updateMany: jest.fn() },
    documentTemplate: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    translationEntry: { upsert: jest.fn(), findMany: jest.fn() },
  };
}

describe('AdminBrandingService', () => {
  let service: AdminBrandingService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let storage: { upload: jest.Mock; getUrl: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    storage = { upload: jest.fn(), getUrl: jest.fn(), delete: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminBrandingService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_PROVIDER, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(AdminBrandingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('uploadBrandAsset', () => {
    it('delegates the file bytes to the injected StorageProvider, not a concrete implementation', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1' });
      storage.upload.mockResolvedValue({ key: 'branding/e1/logo_primary/abc-logo.png', url: '/api/v1/storage/files/branding/e1/logo_primary/abc-logo.png' });
      prisma.brandAsset.create.mockResolvedValue({ id: 'asset1' });

      await service.uploadBrandAsset(
        'e1',
        { assetType: 'LOGO_PRIMARY', label: 'Primary logo', isDefault: false } as any,
        { buffer: Buffer.from('fake'), originalname: 'logo.png', mimetype: 'image/png' },
        'u1',
      );

      expect(storage.upload).toHaveBeenCalledWith(
        expect.objectContaining({ buffer: expect.any(Buffer), contentType: 'image/png' }),
      );
      expect(prisma.brandAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityId: 'e1',
            assetType: 'LOGO_PRIMARY',
            storageKey: 'branding/e1/logo_primary/abc-logo.png',
            uploadedById: 'u1',
          }),
        }),
      );
    });

    it('demotes any existing default asset of the same type before creating a new default', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1' });
      storage.upload.mockResolvedValue({ key: 'k', url: 'u' });
      prisma.brandAsset.updateMany.mockResolvedValue({ count: 1 });
      prisma.brandAsset.create.mockResolvedValue({ id: 'asset2' });

      await service.uploadBrandAsset(
        'e1',
        { assetType: 'LOGO_PRIMARY', label: 'New default', isDefault: true } as any,
        { buffer: Buffer.from('x'), originalname: 'a.png', mimetype: 'image/png' },
        'u1',
      );

      expect(prisma.brandAsset.updateMany).toHaveBeenCalledWith({
        where: { entityId: 'e1', assetType: 'LOGO_PRIMARY', isDefault: true },
        data: { isDefault: false },
      });
    });

    it('rejects uploading for an entity that does not exist', async () => {
      prisma.entity.findUnique.mockResolvedValue(null);
      await expect(
        service.uploadBrandAsset(
          'missing',
          { assetType: 'LOGO_PRIMARY', label: 'x' } as any,
          { buffer: Buffer.from('x'), originalname: 'a.png', mimetype: 'image/png' },
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('deleteBrandAsset', () => {
    it('deletes the underlying file via the storage provider before removing the record', async () => {
      prisma.brandAsset.findUnique.mockResolvedValue({ id: 'a1', storageKey: 'branding/e1/x.png' });
      prisma.brandAsset.delete.mockResolvedValue({});

      await service.deleteBrandAsset('a1');

      expect(storage.delete).toHaveBeenCalledWith('branding/e1/x.png');
      expect(prisma.brandAsset.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    });
  });

  describe('resolveTemplate', () => {
    it('resolves the entity-specific template', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValueOnce({ id: 't1', entityId: 'e1', content: 'entity-specific' });

      const result = await service.resolveTemplate('e1', 'INVOICE', 'default');
      expect(result.content).toBe('entity-specific');
      expect(prisma.documentTemplate.findFirst).toHaveBeenCalledTimes(1);
    });

    it('throws when no entity-specific template exists', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValue(null);
      await expect(service.resolveTemplate('e1', 'INVOICE', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renderTemplate', () => {
    it('substitutes merge tags in both subject and content', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValueOnce({
        id: 't1',
        subject: 'Invoice {{invoiceNumber}} for {{customerName}}',
        content: 'Dear {{customerName}}, your total is {{amount}}.',
      });

      const result = await service.renderTemplate('e1', 'INVOICE', 'default', {
        invoiceNumber: 'INV-001',
        customerName: 'Jane Doe',
        amount: '₦500,000',
      });

      expect(result.subject).toBe('Invoice INV-001 for Jane Doe');
      expect(result.content).toBe('Dear Jane Doe, your total is ₦500,000.');
    });

    it('leaves unresolved merge tags blank rather than throwing', async () => {
      prisma.documentTemplate.findFirst.mockResolvedValueOnce({ id: 't1', subject: null, content: 'Hello {{missingKey}}!' });
      const result = await service.renderTemplate('e1', 'EMAIL', 'welcome', {});
      expect(result.content).toBe('Hello !');
    });
  });

  describe('resolveBranding', () => {
    it('overlays a user preference on top of the entity branding defaults', async () => {
      prisma.entityBrandingProfile.findUnique.mockResolvedValue({
        entityId: 'e1',
        themeMode: 'LIGHT',
        language: 'en',
        timeZone: 'Africa/Lagos',
      });
      prisma.userPreference.findUnique.mockResolvedValue({ userId: 'u1', theme: 'DARK', language: null, timezone: null });

      const result = await service.resolveBranding('e1', 'u1');

      expect(result.themeMode).toBe('DARK');
      expect(result.language).toBe('en');
      expect(result.timeZone).toBe('Africa/Lagos');
    });

    it('falls back to sensible defaults when no branding profile has been configured', async () => {
      prisma.entityBrandingProfile.findUnique.mockResolvedValue(null);
      const result = await service.resolveBranding('e1');
      expect(result.primaryColor).toBe('#0F1B2D');
      expect(result.themeMode).toBe('SYSTEM');
    });
  });
});
