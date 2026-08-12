import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BankTransferStatus } from '@prisma/client';
import { BankTransferService } from '../bank-transfer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { TransferProviderRegistry } from '../transfer-provider.registry';

function buildPrismaMock() {
  return {
    bankTransfer: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
}

const baseDto = {
  entityId: 'e1',
  providerCode: 'PAYSTACK',
  reference: 'txn-ref-001',
  amount: 50000,
  recipientAccountNumber: '0123456789',
  recipientBankCode: '044',
};

describe('BankTransferService', () => {
  let service: BankTransferService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let transferProviders: { get: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    transferProviders = { get: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        BankTransferService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransferProviderRegistry, useValue: transferProviders },
      ],
    }).compile();
    service = moduleRef.get(BankTransferService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createRecord (idempotency)', () => {
    it('creates a new PENDING record when the reference is unseen', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(null);
      prisma.bankTransfer.create.mockResolvedValue({ id: 'bt-1', reference: 'txn-ref-001', status: BankTransferStatus.PENDING });

      const result = await service.createRecord(baseDto, 'u1');

      expect(prisma.bankTransfer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reference: 'txn-ref-001', currency: 'NGN', initiatedById: 'u1' }) }),
      );
      expect(result.reference).toBe('txn-ref-001');
    });

    it('returns the existing record unchanged when the reference was already used, without calling create', async () => {
      const existing = { id: 'bt-1', reference: 'txn-ref-001', status: BankTransferStatus.SUCCESSFUL };
      prisma.bankTransfer.findUnique.mockResolvedValue(existing);

      const result = await service.createRecord(baseDto, 'u1');

      expect(result).toBe(existing);
      expect(prisma.bankTransfer.create).not.toHaveBeenCalled();
    });

    it('defaults currency to NGN when not provided, and honors an explicit override', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(null);
      prisma.bankTransfer.create.mockResolvedValue({});

      await service.createRecord({ ...baseDto, currency: 'USD' }, 'u1');

      expect(prisma.bankTransfer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }));
    });
  });

  describe('getRecord', () => {
    it('throws NotFoundException for a missing id', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(null);
      await expect(service.getRecord('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('initiateTransfer', () => {
    const pendingRecord = {
      id: 'bt-1',
      status: BankTransferStatus.PENDING,
      providerTransferId: null,
      providerCode: 'PAYSTACK',
      amount: 50000,
      currency: 'NGN',
      recipientAccountNumber: '0123456789',
      recipientBankCode: '044',
      recipientName: 'Ada Lovelace',
      reference: 'txn-ref-001',
      narration: 'Vendor payment',
    };

    it('calls the provider and persists the result on success', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(pendingRecord);
      const provider = { initiateTransfer: jest.fn().mockResolvedValue({ providerTransferId: 'TRF_xyz', status: 'SUCCESSFUL' }) };
      transferProviders.get.mockReturnValue(provider);
      prisma.bankTransfer.update.mockResolvedValue({ ...pendingRecord, providerTransferId: 'TRF_xyz', status: BankTransferStatus.SUCCESSFUL });

      const result = await service.initiateTransfer('bt-1');

      expect(transferProviders.get).toHaveBeenCalledWith('PAYSTACK');
      expect(provider.initiateTransfer).toHaveBeenCalledWith({
        amount: 50000,
        currency: 'NGN',
        recipientAccountNumber: '0123456789',
        recipientBankCode: '044',
        recipientName: 'Ada Lovelace',
        reference: 'txn-ref-001',
        narration: 'Vendor payment',
      });
      expect(prisma.bankTransfer.update).toHaveBeenCalledWith({
        where: { id: 'bt-1' },
        data: { providerTransferId: 'TRF_xyz', status: 'SUCCESSFUL' },
      });
      expect(result.status).toBe(BankTransferStatus.SUCCESSFUL);
    });

    it('is idempotent: does not call the provider again for a record that already has a providerTransferId', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue({ ...pendingRecord, providerTransferId: 'TRF_already' });

      const result = await service.initiateTransfer('bt-1');

      expect(transferProviders.get).not.toHaveBeenCalled();
      expect(result.providerTransferId).toBe('TRF_already');
    });

    it('is idempotent: does not call the provider again for a record that already moved past PENDING', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue({ ...pendingRecord, status: BankTransferStatus.FAILED });

      await service.initiateTransfer('bt-1');

      expect(transferProviders.get).not.toHaveBeenCalled();
    });

    it('persists FAILED + failureReason and RE-THROWS when the provider call fails', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(pendingRecord);
      const provider = { initiateTransfer: jest.fn().mockRejectedValue(new Error('Insufficient balance')) };
      transferProviders.get.mockReturnValue(provider);
      prisma.bankTransfer.update.mockResolvedValue({ ...pendingRecord, status: BankTransferStatus.FAILED, failureReason: 'Insufficient balance' });

      await expect(service.initiateTransfer('bt-1')).rejects.toThrow('Insufficient balance');

      expect(prisma.bankTransfer.update).toHaveBeenCalledWith({
        where: { id: 'bt-1' },
        data: { status: BankTransferStatus.FAILED, failureReason: 'Insufficient balance' },
      });
    });

    it('still re-throws the original error even if persisting the FAILED status itself also fails', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(pendingRecord);
      const provider = { initiateTransfer: jest.fn().mockRejectedValue(new Error('Insufficient balance')) };
      transferProviders.get.mockReturnValue(provider);
      prisma.bankTransfer.update.mockRejectedValue(new Error('DB unavailable'));

      await expect(service.initiateTransfer('bt-1')).rejects.toThrow('Insufficient balance');
    });

    it('throws NotFoundException for an unknown id', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(null);
      await expect(service.initiateTransfer('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyTransfer (Checkpoint F)', () => {
    const initiatedRecord = {
      id: 'bt-1',
      status: BankTransferStatus.PENDING,
      providerTransferId: 'TRF_xyz',
      providerCode: 'PAYSTACK',
      reference: 'txn-ref-001',
    };

    it('re-checks status with the provider and persists the result', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(initiatedRecord);
      const provider = {
        verifyTransfer: jest.fn().mockResolvedValue({
          providerTransferId: 'TRF_xyz',
          status: 'SUCCESSFUL',
          completedAt: new Date('2026-07-30T00:00:00.000Z'),
        }),
      };
      transferProviders.get.mockReturnValue(provider);
      prisma.bankTransfer.update.mockResolvedValue({ ...initiatedRecord, status: BankTransferStatus.SUCCESSFUL });

      const result = await service.verifyTransfer('bt-1');

      expect(transferProviders.get).toHaveBeenCalledWith('PAYSTACK');
      expect(provider.verifyTransfer).toHaveBeenCalledWith('txn-ref-001');
      expect(prisma.bankTransfer.update).toHaveBeenCalledWith({
        where: { id: 'bt-1' },
        data: {
          providerTransferId: 'TRF_xyz',
          status: 'SUCCESSFUL',
          completedAt: new Date('2026-07-30T00:00:00.000Z'),
          failureReason: undefined,
        },
      });
      expect(result.status).toBe(BankTransferStatus.SUCCESSFUL);
    });

    it('is callable for a record already SUCCESSFUL (reconciliation re-check), not just PENDING', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue({ ...initiatedRecord, status: BankTransferStatus.SUCCESSFUL });
      const provider = { verifyTransfer: jest.fn().mockResolvedValue({ providerTransferId: 'TRF_xyz', status: 'SUCCESSFUL' }) };
      transferProviders.get.mockReturnValue(provider);
      prisma.bankTransfer.update.mockResolvedValue({ ...initiatedRecord, status: BankTransferStatus.SUCCESSFUL });

      await service.verifyTransfer('bt-1');
      expect(provider.verifyTransfer).toHaveBeenCalled();
    });

    it('throws ConflictException for a record never initiated (PENDING, no providerTransferId)', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue({ ...initiatedRecord, status: BankTransferStatus.PENDING, providerTransferId: null });

      await expect(service.verifyTransfer('bt-1')).rejects.toThrow(ConflictException);
      expect(transferProviders.get).not.toHaveBeenCalled();
    });

    it('re-throws a provider-call failure WITHOUT marking the record FAILED (asymmetric with initiateTransfer)', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(initiatedRecord);
      const provider = { verifyTransfer: jest.fn().mockRejectedValue(new Error('Provider timeout')) };
      transferProviders.get.mockReturnValue(provider);

      await expect(service.verifyTransfer('bt-1')).rejects.toThrow('Provider timeout');
      expect(prisma.bankTransfer.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown id', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(null);
      await expect(service.verifyTransfer('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyProviderResult', () => {
    it('rejects patching a record that does not exist', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue(null);
      await expect(service.applyProviderResult('missing', { status: BankTransferStatus.SUCCESSFUL })).rejects.toThrow(NotFoundException);
    });

    it('patches only the provided fields', async () => {
      prisma.bankTransfer.findUnique.mockResolvedValue({ id: 'bt-1' });
      prisma.bankTransfer.update.mockResolvedValue({ id: 'bt-1', status: BankTransferStatus.SUCCESSFUL });

      await service.applyProviderResult('bt-1', { status: BankTransferStatus.SUCCESSFUL, providerTransferId: 'prov-123' });

      expect(prisma.bankTransfer.update).toHaveBeenCalledWith({
        where: { id: 'bt-1' },
        data: { status: BankTransferStatus.SUCCESSFUL, providerTransferId: 'prov-123' },
      });
    });
  });
});
