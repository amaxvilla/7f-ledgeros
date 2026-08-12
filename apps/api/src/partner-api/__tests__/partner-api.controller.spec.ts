import { NotFoundException } from '@nestjs/common';
import { PartnerApiController } from '../partner-api.controller';

describe('PartnerApiController', () => {
  let controller: PartnerApiController;
  let bankTransfers: { getByReference: jest.Mock };
  let payments: { findTransactionByReference: jest.Mock; findRefundByReference: jest.Mock };

  beforeEach(() => {
    bankTransfers = { getByReference: jest.fn() };
    payments = { findTransactionByReference: jest.fn(), findRefundByReference: jest.fn() };
    controller = new PartnerApiController(bankTransfers as any, payments as any);
  });

  describe('ping', () => {
    it('echoes back the caller identity from the resolved ApiKey, not the key itself', () => {
      const apiKey = { id: 'ak-1', entityId: 'e1', name: 'Acme Partner', scopes: ['transfers:read'], rateLimitPerMinute: 100 };
      const result = controller.ping(apiKey as any);
      expect(result).toEqual({ ok: true, keyId: 'ak-1', entityId: 'e1', scopes: ['transfers:read'] });
    });
  });

  describe('transferStatus', () => {
    it('returns a narrowed shape — no recipient bank details', async () => {
      bankTransfers.getByReference.mockResolvedValue({
        id: 'bt-1',
        reference: 'txn-ref-001',
        status: 'SUCCESSFUL',
        amount: 50000,
        currency: 'NGN',
        completedAt: new Date('2026-08-01'),
        failureReason: null,
        recipientAccountNumber: '0123456789',
        recipientBankCode: '044',
        recipientName: 'Ada Lovelace',
      });

      const result = await controller.transferStatus('txn-ref-001');

      expect(result).toEqual({
        reference: 'txn-ref-001',
        status: 'SUCCESSFUL',
        amount: 50000,
        currency: 'NGN',
        completedAt: new Date('2026-08-01'),
        failureReason: null,
      });
      expect(result).not.toHaveProperty('recipientAccountNumber');
      expect(result).not.toHaveProperty('recipientBankCode');
      expect(result).not.toHaveProperty('recipientName');
    });

    it('throws NotFoundException for an unknown reference', async () => {
      bankTransfers.getByReference.mockResolvedValue(null);
      await expect(controller.transferStatus('unknown-ref')).rejects.toThrow(NotFoundException);
    });
  });

  describe('paymentStatus (Checkpoint D)', () => {
    it('returns a narrowed shape — no customerEmail/description/metadata/rawVerification', async () => {
      payments.findTransactionByReference.mockResolvedValue({
        id: 'pt-1',
        reference: 'pay-ref-001',
        status: 'SUCCESSFUL',
        amount: 500000,
        currency: 'NGN',
        paidAt: new Date('2026-08-01'),
        customerEmail: 'customer@example.com',
        description: 'Invoice #123',
        metadata: { orderId: 'o-1' },
        rawVerification: { raw: true },
      });

      const result = await controller.paymentStatus('pay-ref-001');

      expect(result).toEqual({
        reference: 'pay-ref-001',
        status: 'SUCCESSFUL',
        amount: 500000,
        currency: 'NGN',
        paidAt: new Date('2026-08-01'),
      });
      expect(result).not.toHaveProperty('customerEmail');
      expect(result).not.toHaveProperty('metadata');
      expect(result).not.toHaveProperty('rawVerification');
    });

    it('throws NotFoundException for an unknown reference', async () => {
      payments.findTransactionByReference.mockResolvedValue(null);
      await expect(controller.paymentStatus('unknown-ref')).rejects.toThrow(NotFoundException);
    });
  });

  describe('refundStatus (Checkpoint D)', () => {
    it('returns a narrowed shape — no rawResponse/createdById/paymentTransactionId', async () => {
      payments.findRefundByReference.mockResolvedValue({
        id: 'rf-1',
        paymentTransactionId: 'pt-1',
        refundReference: 'refund-ref-001',
        status: 'SUCCESSFUL',
        amount: 100000,
        reason: 'Customer requested',
        rawResponse: { raw: true },
        createdById: 'user-1',
      });

      const result = await controller.refundStatus('refund-ref-001');

      expect(result).toEqual({
        refundReference: 'refund-ref-001',
        status: 'SUCCESSFUL',
        amount: 100000,
        reason: 'Customer requested',
      });
      expect(result).not.toHaveProperty('rawResponse');
      expect(result).not.toHaveProperty('createdById');
      expect(result).not.toHaveProperty('paymentTransactionId');
    });

    it('throws NotFoundException for an unknown refund reference', async () => {
      payments.findRefundByReference.mockResolvedValue(null);
      await expect(controller.refundStatus('unknown-ref')).rejects.toThrow(NotFoundException);
    });
  });
});
