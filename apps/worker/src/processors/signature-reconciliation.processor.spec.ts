import { Test, TestingModule } from '@nestjs/testing';
import { SignatureReconciliationProcessor } from './signature-reconciliation.processor';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'scheduled-reconcile-stale', data, attemptsMade: 0 } as any;
}

describe('SignatureReconciliationProcessor', () => {
  let processor: SignatureReconciliationProcessor;
  let api: { get: jest.Mock; post: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };
  let prisma: { offer: { findMany: jest.Mock } };

  beforeEach(async () => {
    api = { get: jest.fn(), post: jest.fn() };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    prisma = { offer: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureReconciliationProcessor,
        { provide: InternalApiClient, useValue: api },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(SignatureReconciliationProcessor);
  });

  it('reconciles every stale SENT offer with an outstanding envelope when no specific id is given', async () => {
    prisma.offer.findMany.mockResolvedValue([{ id: 'off-1' }, { id: 'off-2' }]);
    api.post.mockResolvedValue({ status: 'ACCEPTED', providerStatus: 'SIGNED' });

    const result = await processor.process(makeJob({}));

    // Confirms the "stale" query, not just "any SENT" — status filter,
    // the envelope-not-null filter, and a sentAt cutoff must all be
    // present.
    const query = prisma.offer.findMany.mock.calls[0][0];
    expect(query.where.status).toBe('SENT');
    expect(query.where.signatureProviderEnvelopeId).toEqual({ not: null });
    expect(query.where.sentAt.lte).toBeInstanceOf(Date);

    expect(api.post).toHaveBeenCalledWith('/recruitment/offers/off-1/check-signature-status');
    expect(api.post).toHaveBeenCalledWith('/recruitment/offers/off-2/check-signature-status');
    expect(result).toEqual({
      reconciled: 2,
      failed: 0,
      results: {
        'off-1': { status: 'ACCEPTED', providerStatus: 'SIGNED' },
        'off-2': { status: 'ACCEPTED', providerStatus: 'SIGNED' },
      },
    });
  });

  it('reconciles only the specified offer when offerId is given', async () => {
    prisma.offer.findMany.mockResolvedValue([{ id: 'off-3' }]);
    api.post.mockResolvedValue({ status: 'SENT', providerStatus: 'SENT' });

    await processor.process(makeJob({ offerId: 'off-3' }));

    expect(prisma.offer.findMany).toHaveBeenCalledWith({ where: { id: 'off-3' }, select: { id: true } });
    expect(api.post).toHaveBeenCalledWith('/recruitment/offers/off-3/check-signature-status');
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('does not let one failed check abort reconciling the rest', async () => {
    prisma.offer.findMany.mockResolvedValue([{ id: 'off-ok' }, { id: 'off-bad' }]);
    api.post.mockImplementation((path: string) =>
      path.includes('off-bad') ? Promise.reject(new Error('provider unreachable')) : Promise.resolve({ status: 'SENT' }),
    );

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({
      reconciled: 2,
      failed: 1,
      results: {
        'off-ok': { status: 'SENT' },
        'off-bad': { error: 'provider unreachable' },
      },
    });
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ skipped: true });
    expect(prisma.offer.findMany).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rethrows when the enumeration query itself fails (not a per-item failure)', async () => {
    prisma.offer.findMany.mockRejectedValue(new Error('DB unreachable'));
    await expect(processor.process(makeJob({}))).rejects.toThrow('DB unreachable');
  });

  it('returns an empty result without calling the API when nothing is stale', async () => {
    prisma.offer.findMany.mockResolvedValue([]);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ reconciled: 0, failed: 0, results: {} });
    expect(api.post).not.toHaveBeenCalled();
  });
});
