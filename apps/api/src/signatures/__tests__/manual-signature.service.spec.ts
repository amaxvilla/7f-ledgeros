import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManualSignatureService } from '../manual-signature.service';

function buildPrismaMock() {
  return {
    manualSignatureEnvelope: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

function buildStorageMock() {
  return { upload: jest.fn(), getUrl: jest.fn(), delete: jest.fn() };
}

describe('ManualSignatureService', () => {
  let service: ManualSignatureService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let storage: ReturnType<typeof buildStorageMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    storage = buildStorageMock();
    service = new ManualSignatureService(prisma as any, storage as any);
  });

  describe('findEnvelope', () => {
    it('throws NotFoundException for an unknown envelope', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue(null);
      await expect(service.findEnvelope('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the envelope row when found', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'SENT' });
      const result = await service.findEnvelope('env-1');
      expect(result).toEqual({ id: 'env-1', status: 'SENT' });
    });
  });

  describe('findAll', () => {
    it('lists all envelopes, newest first, when no status filter is given', async () => {
      const rows = [{ id: 'env-2', status: 'SENT' }, { id: 'env-1', status: 'COMPLETED' }];
      prisma.manualSignatureEnvelope.findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect(prisma.manualSignatureEnvelope.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(rows);
    });

    it('filters by status when one is given', async () => {
      prisma.manualSignatureEnvelope.findMany.mockResolvedValue([{ id: 'env-1', status: 'DECLINED' }]);

      await service.findAll('DECLINED' as any);

      expect(prisma.manualSignatureEnvelope.findMany).toHaveBeenCalledWith({
        where: { status: 'DECLINED' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('recordCompletion', () => {
    const file = { buffer: Buffer.from('signed-bytes'), originalname: 'signed.pdf', mimetype: 'application/pdf' };

    it('rejects completing an envelope that is already COMPLETED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'COMPLETED' });
      await expect(service.recordCompletion('env-1', file)).rejects.toThrow(ConflictException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects completing an envelope that has been VOIDED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'VOIDED' });
      await expect(service.recordCompletion('env-1', file)).rejects.toThrow(ConflictException);
    });

    it('rejects completing an envelope that has been DECLINED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'DECLINED' });
      await expect(service.recordCompletion('env-1', file)).rejects.toThrow(ConflictException);
    });

    it('uploads the signed copy and moves a SENT envelope to COMPLETED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'SENT' });
      storage.upload.mockResolvedValue({ key: 'signatures/manual/env-1/signed-signed.pdf', url: 'https://cdn.example/signed.pdf' });
      prisma.manualSignatureEnvelope.update.mockResolvedValue({ id: 'env-1', status: 'COMPLETED', signedDocumentKey: 'signatures/manual/env-1/signed-signed.pdf' });

      const result: any = await service.recordCompletion('env-1', file);

      expect(storage.upload).toHaveBeenCalledWith({
        key: 'signatures/manual/env-1/signed-signed.pdf',
        buffer: file.buffer,
        contentType: 'application/pdf',
      });
      expect(prisma.manualSignatureEnvelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { signedDocumentKey: 'signatures/manual/env-1/signed-signed.pdf', status: 'COMPLETED' },
      });
      expect(result.status).toBe('COMPLETED');
    });

    it('also completes a DELIVERED envelope (not just SENT)', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'DELIVERED' });
      storage.upload.mockResolvedValue({ key: 'k', url: 'u' });
      prisma.manualSignatureEnvelope.update.mockResolvedValue({ id: 'env-1', status: 'COMPLETED' });

      const result: any = await service.recordCompletion('env-1', file);
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('recordDecline', () => {
    it('rejects declining an envelope that is already COMPLETED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'COMPLETED' });
      await expect(service.recordDecline('env-1', 'no thanks')).rejects.toThrow(ConflictException);
    });

    it('rejects declining an envelope that has already been VOIDED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'VOIDED' });
      await expect(service.recordDecline('env-1')).rejects.toThrow(ConflictException);
    });

    it('rejects declining an envelope that has already been DECLINED', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'DECLINED' });
      await expect(service.recordDecline('env-1')).rejects.toThrow(ConflictException);
    });

    it('moves a SENT envelope to DECLINED with the given reason', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'SENT' });
      prisma.manualSignatureEnvelope.update.mockResolvedValue({ id: 'env-1', status: 'DECLINED', declineReason: 'Changed my mind' });

      const result: any = await service.recordDecline('env-1', 'Changed my mind');

      expect(prisma.manualSignatureEnvelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { status: 'DECLINED', declineReason: 'Changed my mind' },
      });
      expect(result.status).toBe('DECLINED');
    });

    it('also declines a DELIVERED envelope, with no reason given', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'DELIVERED' });
      prisma.manualSignatureEnvelope.update.mockResolvedValue({ id: 'env-1', status: 'DECLINED', declineReason: undefined });

      await service.recordDecline('env-1');

      expect(prisma.manualSignatureEnvelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { status: 'DECLINED', declineReason: undefined },
      });
    });
  });
});
