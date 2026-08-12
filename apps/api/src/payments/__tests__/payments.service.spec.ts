import { Test } from '@nestjs/testing';
import { ForbiddenException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentTransactionStatus, PaymentRefundStatus } from '@prisma/client';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { PaymentProviderRegistry } from '../payment-provider.registry';
import { SecurityScope } from '../../security/security.types';

describe('PaymentsService (Release IE.1, Checkpoint D)', () => {
  let service: PaymentsService;
  let prisma: any;
  let registry: any;

  const unrestrictedScope: SecurityScope = {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: { unrestricted: true, viewableIds: [], postableIds: [] },
    department: { unrestricted: true, viewableIds: [], postableIds: [] },
    costCenter: { unrestricted: true, viewableIds: [], postableIds: [] },
    project: { unrestricted: true, viewableIds: [], postableIds: [] },
    businessUnit: { unrestricted: true, viewableIds: [], postableIds: [] },
  };
  const restrictedScope: SecurityScope = {
    ...unrestrictedScope,
    isSystemAdmin: false,
    entity: { unrestricted: false, viewableIds: ['ent-2'], postableIds: [] },
  };

  beforeEach(async () => {
    prisma = {
      paymentTransaction: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      paymentRefund: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn() },
    };
    registry = { get: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentProviderRegistry, useValue: registry },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
  });

  describe('initializePayment', () => {
    const dto = {
      entityId: 'ent-1',
      providerCode: 'PAYSTACK',
      reference: 'ref-001',
      amount: 50000,
      currency: 'NGN',
      customerEmail: 'buyer@example.com',
    };

    it('rejects for an entity outside the caller\'s scope', async () => {
      await expect(service.initializePayment(restrictedScope, { ...dto, entityId: 'ent-9' }, 'user-1')).rejects.toThrow(ForbiddenException);
      expect(registry.get).not.toHaveBeenCalled();
    });

    it('rejects a reference that already exists (idempotency)', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({ reference: 'ref-001', status: 'PENDING' });
      await expect(service.initializePayment(unrestrictedScope, dto, 'user-1')).rejects.toThrow(ConflictException);
      expect(registry.get).not.toHaveBeenCalled();
    });

    it('calls the registered provider and persists the resulting transaction', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue(null);
      const initializePaymentMock = jest.fn().mockResolvedValue({
        reference: 'ref-001',
        authorizationUrl: 'https://checkout.paystack.com/abc123',
        providerReference: 'ps_txn_1',
      });
      registry.get.mockReturnValue({ initializePayment: initializePaymentMock });
      prisma.paymentTransaction.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'tx-1', ...data }));

      const result = await service.initializePayment(unrestrictedScope, dto, 'user-1');

      expect(registry.get).toHaveBeenCalledWith('PAYSTACK');
      expect(initializePaymentMock).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'ref-001', amount: 50000, currency: 'NGN' }),
      );
      expect(prisma.paymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authorizationUrl: 'https://checkout.paystack.com/abc123', providerReference: 'ps_txn_1' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'PAYMENT_INITIALIZED' }) }),
      );
      expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc123');
    });
  });

  describe('verifyPayment', () => {
    it('throws NotFoundException for an unknown reference', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue(null);
      await expect(service.verifyPayment(unrestrictedScope, 'missing-ref')).rejects.toThrow(NotFoundException);
    });

    it('rejects for a transaction outside the caller\'s scope', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({ id: 'tx-1', reference: 'ref-1', entityId: 'ent-9', providerCode: 'PAYSTACK', status: 'PENDING' });
      await expect(service.verifyPayment(restrictedScope, 'ref-1')).rejects.toThrow(ForbiddenException);
    });

    it('updates the transaction with the provider\'s verification result', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        reference: 'ref-1',
        entityId: 'ent-1',
        providerCode: 'PAYSTACK',
        status: 'PENDING',
        providerReference: null,
      });
      const verifyPaymentMock = jest.fn().mockResolvedValue({
        reference: 'ref-1',
        status: 'SUCCESSFUL',
        amount: 50000,
        currency: 'NGN',
        paidAt: new Date('2026-07-29'),
        providerReference: 'ps_txn_1',
        raw: { gateway_response: 'Successful' },
      });
      registry.get.mockReturnValue({ verifyPayment: verifyPaymentMock });
      prisma.paymentTransaction.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'tx-1', ...data }));

      const result = await service.verifyPayment(unrestrictedScope, 'ref-1', 'user-1');

      expect(verifyPaymentMock).toHaveBeenCalledWith('ref-1');
      expect(result.status).toBe('SUCCESSFUL');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'PAYMENT_VERIFIED' }) }),
      );
    });
  });

  describe('refundPayment', () => {
    it('rejects refunding a non-SUCCESSFUL transaction', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({
        id: 'tx-1', reference: 'ref-1', entityId: 'ent-1', providerCode: 'PAYSTACK', status: PaymentTransactionStatus.PENDING, amount: 50000,
      });
      await expect(service.refundPayment(unrestrictedScope, 'ref-1', {}, 'user-1')).rejects.toThrow(BadRequestException);
      expect(registry.get).not.toHaveBeenCalled();
    });

    it('rejects a refund amount greater than the original payment', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({
        id: 'tx-1', reference: 'ref-1', entityId: 'ent-1', providerCode: 'PAYSTACK', status: PaymentTransactionStatus.SUCCESSFUL, amount: 50000,
      });
      await expect(service.refundPayment(unrestrictedScope, 'ref-1', { amount: 60000 }, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('calls the provider and persists a PaymentRefund row for a valid refund', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({
        id: 'tx-1', reference: 'ref-1', entityId: 'ent-1', providerCode: 'PAYSTACK', status: PaymentTransactionStatus.SUCCESSFUL, amount: 50000,
      });
      const refundPaymentMock = jest.fn().mockResolvedValue({
        reference: 'ref-1',
        refundReference: 'refund-1',
        status: 'SUCCESSFUL',
        amount: 50000,
      });
      registry.get.mockReturnValue({ refundPayment: refundPaymentMock });
      prisma.paymentRefund.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rf-1', ...data }));

      const result = await service.refundPayment(unrestrictedScope, 'ref-1', { reason: 'customer request' }, 'user-1');

      expect(refundPaymentMock).toHaveBeenCalledWith({ reference: 'ref-1', amount: undefined, reason: 'customer request' });
      expect(result.refundReference).toBe('refund-1');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'PAYMENT_REFUNDED' }) }),
      );
    });
  });

  describe('verifyRefund (Release IE.2, Checkpoint G)', () => {
    it('throws NotFoundException when no refund matches the refundReference', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue(null);
      await expect(service.verifyRefund(unrestrictedScope, 'missing-ref')).rejects.toThrow(NotFoundException);
      expect(registry.get).not.toHaveBeenCalled();
    });

    it("rejects for an entity outside the caller's scope", async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue({
        id: 'rf-1',
        refundReference: 'refund-1',
        status: 'PENDING',
        paymentTransaction: { entityId: 'ent-9', providerCode: 'PAYSTACK' },
      });
      await expect(service.verifyRefund(restrictedScope, 'refund-1')).rejects.toThrow(ForbiddenException);
    });

    it('calls provider.verifyRefund, persists the result, and writes an audit log entry', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue({
        id: 'rf-1',
        refundReference: 'refund-1',
        status: 'PENDING',
        paymentTransaction: { entityId: 'ent-1', providerCode: 'PAYSTACK' },
      });
      const verifyRefundMock = jest.fn().mockResolvedValue({ reference: 'ref-1', refundReference: 'refund-1', status: 'SUCCESSFUL', amount: 50000 });
      registry.get.mockReturnValue({ verifyRefund: verifyRefundMock });
      prisma.paymentRefund.update.mockResolvedValue({ id: 'rf-1', refundReference: 'refund-1', status: 'SUCCESSFUL' });

      const result = await service.verifyRefund(unrestrictedScope, 'refund-1', 'user-1');

      expect(verifyRefundMock).toHaveBeenCalledWith('refund-1');
      expect(prisma.paymentRefund.update).toHaveBeenCalledWith({
        where: { refundReference: 'refund-1' },
        data: expect.objectContaining({ status: 'SUCCESSFUL' }),
      });
      expect(result.status).toBe('SUCCESSFUL');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'PAYMENT_REFUND_VERIFIED', entityId: 'rf-1' }) }),
      );
    });
  });

  describe('listTransactions', () => {
    it('rejects for an entity outside the caller\'s scope', async () => {
      await expect(service.listTransactions(restrictedScope, 'ent-9')).rejects.toThrow(ForbiddenException);
    });

    it('lists transactions for an accessible entity, applying optional filters', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValue([{ id: 'tx-1' }]);
      const result = await service.listTransactions(unrestrictedScope, 'ent-1', { status: PaymentTransactionStatus.SUCCESSFUL });

      expect(result).toEqual([{ id: 'tx-1' }]);
      expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ entityId: 'ent-1', status: PaymentTransactionStatus.SUCCESSFUL }) }),
      );
    });
  });

  describe('applyWebhookEvent (Release IE.1, Checkpoint F2)', () => {
    it('returns matched: false and never writes when no transaction matches the reference', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue(null);

      const result = await service.applyWebhookEvent({ reference: 'unknown-ref', status: PaymentTransactionStatus.SUCCESSFUL, raw: {} });

      expect(result).toEqual({ matched: false });
      expect(prisma.paymentTransaction.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('updates the matching transaction and writes an audit log entry with no userId', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        reference: 'ref-001',
        status: PaymentTransactionStatus.PENDING,
        providerReference: null,
      });
      prisma.paymentTransaction.update.mockResolvedValue({
        id: 'tx-1',
        reference: 'ref-001',
        status: PaymentTransactionStatus.SUCCESSFUL,
      });

      const paidAt = new Date('2026-07-29T12:00:00Z');
      const result = await service.applyWebhookEvent({
        reference: 'ref-001',
        status: PaymentTransactionStatus.SUCCESSFUL,
        providerReference: 'psk_ref_1',
        paidAt,
        raw: { event: 'charge.success' },
      });

      expect(result).toEqual({ matched: true });
      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith({
        where: { reference: 'ref-001' },
        data: expect.objectContaining({
          status: PaymentTransactionStatus.SUCCESSFUL,
          paidAt,
          providerReference: 'psk_ref_1',
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_WEBHOOK_RECEIVED',
            entityType: 'PaymentTransaction',
            entityId: 'tx-1',
          }),
        }),
      );
    });

    it('falls back to the existing providerReference when the event does not carry one', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({
        id: 'tx-2',
        reference: 'ref-002',
        status: PaymentTransactionStatus.PENDING,
        providerReference: 'existing-ref',
      });
      prisma.paymentTransaction.update.mockResolvedValue({ id: 'tx-2', status: PaymentTransactionStatus.FAILED });

      await service.applyWebhookEvent({ reference: 'ref-002', status: PaymentTransactionStatus.FAILED, raw: {} });

      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ providerReference: 'existing-ref' }) }),
      );
    });
  });

  describe('applyRefundWebhookEvent (Release IE.2, Checkpoint E)', () => {
    it('returns matched: false and never writes when no refund matches the refundReference', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue(null);

      const result = await service.applyRefundWebhookEvent({ refundReference: 'unknown-ref', status: 'SUCCESSFUL', raw: {} });

      expect(result).toEqual({ matched: false });
      expect(prisma.paymentRefund.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('updates the matching refund and writes an audit log entry', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue({ id: 'rf-1', refundReference: '4321', status: PaymentRefundStatus.PENDING });
      prisma.paymentRefund.update.mockResolvedValue({ id: 'rf-1', refundReference: '4321', status: PaymentRefundStatus.SUCCESSFUL });

      const result = await service.applyRefundWebhookEvent({ refundReference: '4321', status: 'SUCCESSFUL', raw: { event: 'refund.processed' } });

      expect(result).toEqual({ matched: true });
      expect(prisma.paymentRefund.update).toHaveBeenCalledWith({
        where: { refundReference: '4321' },
        data: expect.objectContaining({ status: PaymentRefundStatus.SUCCESSFUL }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_REFUND_WEBHOOK_RECEIVED',
            entityType: 'PaymentRefund',
            entityId: 'rf-1',
            beforeState: { status: PaymentRefundStatus.PENDING },
            afterState: { status: PaymentRefundStatus.SUCCESSFUL },
          }),
        }),
      );
    });

    it('advances a refund to FAILED on a refund.failed-derived event', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue({ id: 'rf-2', refundReference: '4322', status: PaymentRefundStatus.PENDING });
      prisma.paymentRefund.update.mockResolvedValue({ id: 'rf-2', status: PaymentRefundStatus.FAILED });

      await service.applyRefundWebhookEvent({ refundReference: '4322', status: 'FAILED', raw: {} });

      expect(prisma.paymentRefund.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: PaymentRefundStatus.FAILED }) }),
      );
    });
  });

  describe('getOverview (Release IE.1, Checkpoint G; refund summary added Release IE.2, Checkpoint H)', () => {
    it('rejects for an entity outside the caller\'s scope', async () => {
      await expect(service.getOverview(restrictedScope, 'ent-9')).rejects.toThrow(ForbiddenException);
      expect(prisma.paymentTransaction.groupBy).not.toHaveBeenCalled();
      expect(prisma.paymentRefund.groupBy).not.toHaveBeenCalled();
    });

    it('fills in a zero-count/zero-total entry for every status not returned by groupBy (transactions and refunds)', async () => {
      prisma.paymentTransaction.groupBy = jest.fn().mockResolvedValue([
        { status: PaymentTransactionStatus.SUCCESSFUL, _count: { _all: 2 }, _sum: { amount: 50000 } },
      ]);

      const result = await service.getOverview(unrestrictedScope, 'ent-1');

      expect(result).toEqual({
        entityId: 'ent-1',
        totalCount: 2,
        successfulAmount: 50000,
        byStatus: {
          PENDING: { count: 0, totalAmount: 0 },
          SUCCESSFUL: { count: 2, totalAmount: 50000 },
          FAILED: { count: 0, totalAmount: 0 },
          ABANDONED: { count: 0, totalAmount: 0 },
        },
        refundsByStatus: {
          PENDING: { count: 0, totalAmount: 0 },
          SUCCESSFUL: { count: 0, totalAmount: 0 },
          FAILED: { count: 0, totalAmount: 0 },
        },
        totalRefundedAmount: 0,
      });
    });

    it('sums totalCount and successfulAmount across multiple statuses', async () => {
      prisma.paymentTransaction.groupBy = jest.fn().mockResolvedValue([
        { status: PaymentTransactionStatus.PENDING, _count: { _all: 1 }, _sum: { amount: 10000 } },
        { status: PaymentTransactionStatus.SUCCESSFUL, _count: { _all: 3 }, _sum: { amount: 75000 } },
        { status: PaymentTransactionStatus.FAILED, _count: { _all: 1 }, _sum: { amount: 5000 } },
      ]);

      const result = await service.getOverview(unrestrictedScope, 'ent-1');

      expect(result.totalCount).toBe(5);
      expect(result.successfulAmount).toBe(75000);
      expect(prisma.paymentTransaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['status'], where: { entityId: 'ent-1' } }),
      );
    });

    it('summarizes refunds by status, scoped to the entity via the paymentTransaction relation (Checkpoint H)', async () => {
      prisma.paymentTransaction.groupBy = jest.fn().mockResolvedValue([]);
      prisma.paymentRefund.groupBy = jest.fn().mockResolvedValue([
        { status: PaymentRefundStatus.SUCCESSFUL, _count: { _all: 2 }, _sum: { amount: 30000 } },
        { status: PaymentRefundStatus.PENDING, _count: { _all: 1 }, _sum: { amount: 5000 } },
      ]);

      const result = await service.getOverview(unrestrictedScope, 'ent-1');

      expect(prisma.paymentRefund.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['status'], where: { paymentTransaction: { entityId: 'ent-1' } } }),
      );
      expect(result.refundsByStatus).toEqual({
        PENDING: { count: 1, totalAmount: 5000 },
        SUCCESSFUL: { count: 2, totalAmount: 30000 },
        FAILED: { count: 0, totalAmount: 0 },
      });
      expect(result.totalRefundedAmount).toBe(30000);
    });
  });

  describe('findTransactionByReference / findRefundByReference (API Gateway, Partner API Checkpoint D)', () => {
    it('findTransactionByReference looks up unscoped by reference', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue({ id: 'pt-1', reference: 'pay-ref-001' });
      const result = await service.findTransactionByReference('pay-ref-001');
      expect(prisma.paymentTransaction.findUnique).toHaveBeenCalledWith({ where: { reference: 'pay-ref-001' } });
      expect(result).toEqual({ id: 'pt-1', reference: 'pay-ref-001' });
    });

    it('findTransactionByReference returns null for an unknown reference, without throwing', async () => {
      prisma.paymentTransaction.findUnique.mockResolvedValue(null);
      await expect(service.findTransactionByReference('unknown')).resolves.toBeNull();
    });

    it('findRefundByReference looks up unscoped by refundReference', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue({ id: 'rf-1', refundReference: 'refund-ref-001' });
      const result = await service.findRefundByReference('refund-ref-001');
      expect(prisma.paymentRefund.findUnique).toHaveBeenCalledWith({ where: { refundReference: 'refund-ref-001' } });
      expect(result).toEqual({ id: 'rf-1', refundReference: 'refund-ref-001' });
    });

    it('findRefundByReference returns null for an unknown refundReference, without throwing', async () => {
      prisma.paymentRefund.findUnique.mockResolvedValue(null);
      await expect(service.findRefundByReference('unknown')).resolves.toBeNull();
    });
  });
});
