import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, type MonoStatementSyncJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/** First-ever sync for a linked account looks back at most this far, rather than an unbounded "since account creation" pull. */
const MAX_INITIAL_LOOKBACK_DAYS = 30;

/**
 * Release IF.1, Checkpoint H — Bank Integration Framework scheduled
 * statement sync.
 *
 * Closes the gap left open since Checkpoint E: importStatement was only
 * ever reachable via POST .../linked-accounts/:id/import-statement,
 * which a person has to call by hand. Same worker-does-enumeration,
 * API-does-the-real-call split as PaymentReconciliationProcessor: this
 * class finds which MonoLinkedAccount rows need syncing and calls the
 * existing POST .../import-statement endpoint once per account — no new
 * MonoLinkedAccountService method, no second copy of "what does
 * importing a statement mean".
 *
 * WATERMARK, and why it's a NEW column rather than reusing anything on
 * BankStatement: BankReconciliationService.importStatement
 * (bank-reconciliation/bank-reconciliation.service.ts) creates a fresh
 * BankStatement + lines on every call with no dedupe against an
 * existing statement for the same period — confirmed by reading that
 * method before writing this processor. A naive "always pull the
 * trailing N days" schedule would therefore create duplicate
 * BankStatement rows (and duplicate lines) every single run, not just
 * duplicate on rare overlap. MonoLinkedAccount.lastSyncedAt
 * (prisma/schema.prisma) exists specifically to make each run's window
 * pick up exactly where the previous one left off, with zero overlap.
 * lastSyncedAt is advanced ONLY after a successful import call for that
 * account, and only by this processor — a manual
 * POST .../import-statement call (Checkpoint E's endpoint, still used
 * directly by people who want an ad hoc range) deliberately does NOT
 * touch it, so a manual pull and the scheduled job never fight over the
 * same watermark or let a manual pull silently widen/shrink what the
 * schedule considers already-synced.
 *
 * A first-ever sync (lastSyncedAt is null) looks back at most
 * MAX_INITIAL_LOOKBACK_DAYS rather than all the way to linkedAt, since a
 * long-linked account with no prior sync could otherwise trigger one
 * enormous first pull.
 *
 * Only ACTIVE accounts are considered — REVOKED is a deliberate
 * unlink, and REQUIRES_REAUTH (Checkpoint G) means Mono has already
 * told us this account's credentials cannot currently be used to fetch
 * anything; attempting a sync against either would just fail Mono's own
 * validation stub. Checkpoint F's exact reasoning for validateAccount
 * (skip codes that are known-invalid rather than call an endpoint we
 * already know will reject them).
 */
@Processor(QUEUE_NAMES.MONO_STATEMENT_SYNC)
export class MonoStatementSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(MonoStatementSyncProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<MonoStatementSyncJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.mono_statement_sync'))) {
      this.logger.warn(`jobs.mono_statement_sync is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.MONO_STATEMENT_SYNC,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const accounts = await this.prisma.monoLinkedAccount.findMany({
        where: {
          status: 'ACTIVE',
          id: job.data.monoLinkedAccountId,
        },
        select: { id: true, linkedAt: true, lastSyncedAt: true },
      });

      const windowEnd = new Date();
      const earliestAllowed = new Date(windowEnd.getTime() - MAX_INITIAL_LOOKBACK_DAYS * 24 * 3600 * 1000);

      const results: Record<string, unknown> = {};
      let syncedCount = 0;
      let failedCount = 0;

      for (const account of accounts) {
        const windowStart = account.lastSyncedAt && account.lastSyncedAt > earliestAllowed ? account.lastSyncedAt : earliestAllowed;

        if (windowStart >= windowEnd) {
          // Already synced up to (or past) "now" — can happen if this
          // job overlaps a manual sync or a previous run for the same
          // account; nothing to do, not an error.
          results[account.id] = { skipped: true, reason: 'already up to date' };
          continue;
        }

        try {
          results[account.id] = await this.api.post(`/bank-integration/mono/linked-accounts/${account.id}/import-statement`, {
            fromDate: windowStart.toISOString(),
            toDate: windowEnd.toISOString(),
          });

          await this.prisma.monoLinkedAccount.update({ where: { id: account.id }, data: { lastSyncedAt: windowEnd } });
          syncedCount += 1;
        } catch (err) {
          // One account's transient failure (or a since-reauth-required
          // account that flipped status mid-run) shouldn't abort syncing
          // every other account in the same run — same isolation
          // PaymentReconciliationProcessor uses per-reference.
          failedCount += 1;
          results[account.id] = { error: (err as Error).message };
          this.logger.warn(`Mono statement sync failed for linked account "${account.id}": ${(err as Error).message}`);
        }
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result: { synced: syncedCount, failed: failedCount } });
      return { synced: syncedCount, failed: failedCount, results };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Mono statement sync failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
