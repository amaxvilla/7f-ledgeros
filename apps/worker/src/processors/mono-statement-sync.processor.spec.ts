import { Test, TestingModule } from '@nestjs/testing';
import { MonoStatementSyncProcessor } from './mono-statement-sync.processor';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'scheduled-sync-all', data, attemptsMade: 0 } as any;
}

const NOW = new Date('2026-07-30T12:00:00.000Z');

describe('MonoStatementSyncProcessor', () => {
  let processor: MonoStatementSyncProcessor;
  let api: { get: jest.Mock; post: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };
  let prisma: { monoLinkedAccount: { findMany: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW });

    api = { get: jest.fn(), post: jest.fn() };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    prisma = { monoLinkedAccount: { findMany: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonoStatementSyncProcessor,
        { provide: InternalApiClient, useValue: api },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(MonoStatementSyncProcessor);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('only queries ACTIVE accounts, optionally scoped to one id', async () => {
    prisma.monoLinkedAccount.findMany.mockResolvedValue([]);

    await processor.process(makeJob({}));

    expect(prisma.monoLinkedAccount.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', id: undefined },
      select: { id: true, linkedAt: true, lastSyncedAt: true },
    });
  });

  it('syncs from lastSyncedAt forward to now, and advances the watermark on success', async () => {
    const lastSyncedAt = new Date('2026-07-30T06:00:00.000Z');
    prisma.monoLinkedAccount.findMany.mockResolvedValue([{ id: 'acc-1', linkedAt: new Date('2026-01-01'), lastSyncedAt }]);
    api.post.mockResolvedValue({ imported: 3 });

    const result = await processor.process(makeJob({}));

    expect(api.post).toHaveBeenCalledWith('/bank-integration/mono/linked-accounts/acc-1/import-statement', {
      fromDate: lastSyncedAt.toISOString(),
      toDate: NOW.toISOString(),
    });
    expect(prisma.monoLinkedAccount.update).toHaveBeenCalledWith({ where: { id: 'acc-1' }, data: { lastSyncedAt: NOW } });
    expect(result).toEqual({ synced: 1, failed: 0, results: { 'acc-1': { imported: 3 } } });
  });

  it('caps a first-ever sync (lastSyncedAt null) at MAX_INITIAL_LOOKBACK_DAYS rather than pulling since linkedAt', async () => {
    const linkedTwoYearsAgo = new Date('2024-01-01T00:00:00.000Z');
    prisma.monoLinkedAccount.findMany.mockResolvedValue([{ id: 'acc-2', linkedAt: linkedTwoYearsAgo, lastSyncedAt: null }]);
    api.post.mockResolvedValue({ imported: 0 });

    await processor.process(makeJob({}));

    const call = api.post.mock.calls[0][1];
    const fromDate = new Date(call.fromDate);
    const daysBack = (NOW.getTime() - fromDate.getTime()) / (24 * 3600 * 1000);
    expect(daysBack).toBeCloseTo(30, 1);
  });

  it('skips an account already synced up to (or past) now without calling the API', async () => {
    prisma.monoLinkedAccount.findMany.mockResolvedValue([{ id: 'acc-3', linkedAt: new Date('2026-01-01'), lastSyncedAt: NOW }]);

    const result = await processor.process(makeJob({}));

    expect(api.post).not.toHaveBeenCalled();
    expect(prisma.monoLinkedAccount.update).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: 0, failed: 0, results: { 'acc-3': { skipped: true, reason: 'already up to date' } } });
  });

  it('does not let one account\'s failure abort syncing the rest, and does not advance its watermark', async () => {
    prisma.monoLinkedAccount.findMany.mockResolvedValue([
      { id: 'acc-ok', linkedAt: new Date('2026-01-01'), lastSyncedAt: new Date('2026-07-30T06:00:00.000Z') },
      { id: 'acc-bad', linkedAt: new Date('2026-01-01'), lastSyncedAt: new Date('2026-07-30T06:00:00.000Z') },
    ]);
    api.post.mockImplementation((path: string) =>
      path.includes('acc-bad') ? Promise.reject(new Error('Mono unreachable')) : Promise.resolve({ imported: 1 }),
    );

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({
      synced: 1,
      failed: 1,
      results: { 'acc-ok': { imported: 1 }, 'acc-bad': { error: 'Mono unreachable' } },
    });
    expect(prisma.monoLinkedAccount.update).toHaveBeenCalledTimes(1);
    expect(prisma.monoLinkedAccount.update).toHaveBeenCalledWith({ where: { id: 'acc-ok' }, data: { lastSyncedAt: NOW } });
  });

  it('scopes to a single account when monoLinkedAccountId is given', async () => {
    prisma.monoLinkedAccount.findMany.mockResolvedValue([{ id: 'acc-9', linkedAt: new Date('2026-01-01'), lastSyncedAt: null }]);
    api.post.mockResolvedValue({ imported: 2 });

    await processor.process(makeJob({ monoLinkedAccountId: 'acc-9' }));

    expect(prisma.monoLinkedAccount.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', id: 'acc-9' },
      select: { id: true, linkedAt: true, lastSyncedAt: true },
    });
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ skipped: true });
    expect(prisma.monoLinkedAccount.findMany).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rethrows when the enumeration query itself fails (not a per-account failure)', async () => {
    prisma.monoLinkedAccount.findMany.mockRejectedValue(new Error('DB unreachable'));
    await expect(processor.process(makeJob({}))).rejects.toThrow('DB unreachable');
  });
});
