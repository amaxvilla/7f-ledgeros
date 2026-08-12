import { Test, TestingModule } from '@nestjs/testing';
import { BankTransferReconciliationProcessor } from './bank-transfer-reconciliation.processor';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'scheduled-reconcile-stale', data, attemptsMade: 0 } as any;
}

describe('BankTransferReconciliationProcessor', () => {
  let processor: BankTransferReconciliationProcessor;
  let api: { get: jest.Mock; post: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };
  let prisma: { bankTransfer: { findMany: jest.Mock } };

  beforeEach(async () => {
    api = { get: jest.fn(), post: jest.fn() };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    prisma = { bankTransfer: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankTransferReconciliationProcessor,
        { provide: InternalApiClient, useValue: api },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(BankTransferReconciliationProcessor);
  });

  it('reconciles every stale PENDING transfer when no specific id is given', async () => {
    prisma.bankTransfer.findMany.mockResolvedValue([{ id: 'bt-1' }, { id: 'bt-2' }]);
    api.post.mockResolvedValue({ status: 'SUCCESSFUL' });

    const result = await processor.process(makeJob({}));

    // Confirms the "stale" query, not just "any PENDING" — status filter
    // plus a createdAt cutoff must both be present.
    const query = prisma.bankTransfer.findMany.mock.calls[0][0];
    expect(query.where.status).toBe('PENDING');
    expect(query.where.createdAt.lte).toBeInstanceOf(Date);

    expect(api.post).toHaveBeenCalledWith('/transfers/bt-1/verify');
    expect(api.post).toHaveBeenCalledWith('/transfers/bt-2/verify');
    expect(result).toEqual({
      reconciled: 2,
      failed: 0,
      results: { 'bt-1': { status: 'SUCCESSFUL' }, 'bt-2': { status: 'SUCCESSFUL' } },
    });
  });

  it('reconciles only the specified transfer when bankTransferId is given', async () => {
    prisma.bankTransfer.findMany.mockResolvedValue([{ id: 'bt-3' }]);
    api.post.mockResolvedValue({ status: 'FAILED' });

    await processor.process(makeJob({ bankTransferId: 'bt-3' }));

    expect(prisma.bankTransfer.findMany).toHaveBeenCalledWith({ where: { id: 'bt-3' }, select: { id: true } });
    expect(api.post).toHaveBeenCalledWith('/transfers/bt-3/verify');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('does not let one failed verification abort reconciling the rest', async () => {
    prisma.bankTransfer.findMany.mockResolvedValue([{ id: 'bt-ok' }, { id: 'bt-bad' }]);
    api.post.mockImplementation((path: string) =>
      path.includes('bt-bad') ? Promise.reject(new Error('provider unreachable')) : Promise.resolve({ status: 'SUCCESSFUL' }),
    );

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({
      reconciled: 2,
      failed: 1,
      results: {
        'bt-ok': { status: 'SUCCESSFUL' },
        'bt-bad': { error: 'provider unreachable' },
      },
    });
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ skipped: true });
    expect(prisma.bankTransfer.findMany).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rethrows when the enumeration query itself fails (not a per-item failure)', async () => {
    prisma.bankTransfer.findMany.mockRejectedValue(new Error('DB unreachable'));
    await expect(processor.process(makeJob({}))).rejects.toThrow('DB unreachable');
  });

  it('returns an empty result without calling the API when nothing is stale', async () => {
    prisma.bankTransfer.findMany.mockResolvedValue([]);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ reconciled: 0, failed: 0, results: {} });
    expect(api.post).not.toHaveBeenCalled();
  });
});
