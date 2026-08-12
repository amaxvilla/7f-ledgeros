import { Test, TestingModule } from '@nestjs/testing';
import { PaymentReconciliationProcessor } from './payment-reconciliation.processor';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'scheduled-reconcile-stale', data, attemptsMade: 0 } as any;
}

describe('PaymentReconciliationProcessor', () => {
  let processor: PaymentReconciliationProcessor;
  let api: { get: jest.Mock; post: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };
  let prisma: { paymentTransaction: { findMany: jest.Mock }; paymentRefund: { findMany: jest.Mock } };

  beforeEach(async () => {
    api = { get: jest.fn(), post: jest.fn() };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    prisma = { paymentTransaction: { findMany: jest.fn() }, paymentRefund: { findMany: jest.fn().mockResolvedValue([]) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentReconciliationProcessor,
        { provide: InternalApiClient, useValue: api },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(PaymentReconciliationProcessor);
  });

  it('reconciles every stale PENDING transaction when no specific id is given', async () => {
    prisma.paymentTransaction.findMany.mockResolvedValue([{ reference: 'PAY-1' }, { reference: 'PAY-2' }]);
    api.post.mockResolvedValue({ status: 'SUCCESSFUL' });

    const result = await processor.process(makeJob({}));

    // Confirms the "stale" query, not just "any PENDING" — status filter
    // plus a createdAt cutoff must both be present.
    const query = prisma.paymentTransaction.findMany.mock.calls[0][0];
    expect(query.where.status).toBe('PENDING');
    expect(query.where.createdAt.lte).toBeInstanceOf(Date);

    expect(api.post).toHaveBeenCalledWith('/payments/PAY-1/verify');
    expect(api.post).toHaveBeenCalledWith('/payments/PAY-2/verify');
    expect(result).toEqual({ reconciled: 2, failed: 0, results: { 'PAY-1': { status: 'SUCCESSFUL' }, 'PAY-2': { status: 'SUCCESSFUL' } } });
  });

  it('reconciles only the specified transaction when paymentTransactionId is given', async () => {
    prisma.paymentTransaction.findMany.mockResolvedValue([{ reference: 'PAY-3' }]);
    api.post.mockResolvedValue({ status: 'FAILED' });

    await processor.process(makeJob({ paymentTransactionId: 'pt-3' }));

    expect(prisma.paymentTransaction.findMany).toHaveBeenCalledWith({ where: { id: 'pt-3' }, select: { reference: true } });
    expect(api.post).toHaveBeenCalledWith('/payments/PAY-3/verify');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('does not let one failed verification abort reconciling the rest', async () => {
    prisma.paymentTransaction.findMany.mockResolvedValue([{ reference: 'PAY-OK' }, { reference: 'PAY-BAD' }]);
    api.post.mockImplementation((path: string) =>
      path.includes('PAY-BAD') ? Promise.reject(new Error('provider unreachable')) : Promise.resolve({ status: 'SUCCESSFUL' }),
    );

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({
      reconciled: 2,
      failed: 1,
      results: {
        'PAY-OK': { status: 'SUCCESSFUL' },
        'PAY-BAD': { error: 'provider unreachable' },
      },
    });
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ skipped: true });
    expect(prisma.paymentTransaction.findMany).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rethrows when the enumeration query itself fails (not a per-item failure)', async () => {
    prisma.paymentTransaction.findMany.mockRejectedValue(new Error('DB unreachable'));
    await expect(processor.process(makeJob({}))).rejects.toThrow('DB unreachable');
  });

  describe('refund reconciliation (Release IE.2, Checkpoint G)', () => {
    beforeEach(() => {
      prisma.paymentTransaction.findMany.mockResolvedValue([]);
    });

    it('reconciles every stale PENDING refund when no specific id is given, alongside any stale transactions', async () => {
      prisma.paymentRefund.findMany.mockResolvedValue([{ refundReference: 'RF-1' }, { refundReference: 'RF-2' }]);
      api.post.mockResolvedValue({ status: 'SUCCESSFUL' });

      const result = await processor.process(makeJob({}));

      const query = prisma.paymentRefund.findMany.mock.calls[0][0];
      expect(query.where.status).toBe('PENDING');
      expect(query.where.createdAt.lte).toBeInstanceOf(Date);

      expect(api.post).toHaveBeenCalledWith('/payments/refunds/RF-1/verify');
      expect(api.post).toHaveBeenCalledWith('/payments/refunds/RF-2/verify');
      expect(result).toEqual({
        reconciled: 2,
        failed: 0,
        results: { 'refund:RF-1': { status: 'SUCCESSFUL' }, 'refund:RF-2': { status: 'SUCCESSFUL' } },
      });
    });

    it('reconciles only the specified refund when paymentRefundId is given', async () => {
      prisma.paymentRefund.findMany.mockResolvedValue([{ refundReference: 'RF-3' }]);
      api.post.mockResolvedValue({ status: 'FAILED' });

      await processor.process(makeJob({ paymentRefundId: 'rf-3' }));

      expect(prisma.paymentRefund.findMany).toHaveBeenCalledWith({ where: { id: 'rf-3' }, select: { refundReference: true } });
      expect(api.post).toHaveBeenCalledWith('/payments/refunds/RF-3/verify');
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('does not let one failed refund verification abort reconciling the rest, and keeps refund/transaction results distinctly keyed', async () => {
      prisma.paymentTransaction.findMany.mockResolvedValue([{ reference: 'PAY-1' }]);
      prisma.paymentRefund.findMany.mockResolvedValue([{ refundReference: 'PAY-1' }]); // deliberately same string as the transaction reference above
      api.post.mockImplementation((path: string) =>
        path.includes('/refunds/') ? Promise.reject(new Error('provider unreachable')) : Promise.resolve({ status: 'SUCCESSFUL' }),
      );

      const result = await processor.process(makeJob({}));

      expect(result).toEqual({
        reconciled: 2,
        failed: 1,
        results: {
          'PAY-1': { status: 'SUCCESSFUL' },
          'refund:PAY-1': { error: 'provider unreachable' },
        },
      });
    });

    it('skips refund reconciliation too when the feature flag is disabled', async () => {
      featureFlags.isEnabled.mockResolvedValue(false);

      await processor.process(makeJob({}));

      expect(prisma.paymentRefund.findMany).not.toHaveBeenCalled();
    });
  });
});
