import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, type BankTransferReconciliationJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/** A PENDING transfer younger than this is still a normal in-flight provider call, not stale. */
const STALE_AFTER_MINUTES = 15;

/**
 * Enterprise Banking APIs, Transfer APIs — Checkpoint G.
 *
 * Closes the gap BankTransferService.verifyTransfer's own doc comment
 * (Checkpoint F) named: "a reconciliation sweep re-verifying an
 * already-... record ... is a legitimate call" — that sweep didn't
 * exist until now. Same "worker does the direct-Prisma enumeration, API
 * does the one real business-logic call per item" split
 * PaymentReconciliationProcessor and MonoStatementSyncProcessor both
 * use: this class finds which BankTransfer rows are stale and calls the
 * existing POST /transfers/:id/verify endpoint once per row —
 * BankTransferService.verifyTransfer(), Checkpoint F. No new
 * BankTransferService method, no new controller route, no second copy
 * of "what does verifying a transfer mean".
 *
 * STALE_AFTER_MINUTES/cadence deliberately mirror
 * PaymentReconciliationProcessor's own 15-minute values, not Mono's
 * 6-hour one: like a payment, a transfer's PENDING status is
 * financially meaningful and time-sensitive, not just data freshness.
 *
 * Only PENDING transfers are swept — same reasoning
 * PaymentReconciliationProcessor's own STALE_AFTER_MINUTES cutoff uses:
 * verifyTransfer() itself is legal to call on any status (see its own
 * doc comment), but a sweep re-verifying already-SUCCESSFUL/FAILED/
 * REVERSED rows on a recurring schedule would be pure waste — those are
 * already terminal statuses this codebase has no path to un-terminal.
 */
@Processor(QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION)
export class BankTransferReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(BankTransferReconciliationProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<BankTransferReconciliationJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.bank_transfer_reconciliation'))) {
      this.logger.warn(`jobs.bank_transfer_reconciliation is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const ids = job.data.bankTransferId
        ? (
            await this.prisma.bankTransfer.findMany({
              where: { id: job.data.bankTransferId },
              select: { id: true },
            })
          ).map((t: { id: string }) => t.id)
        : (
            await this.prisma.bankTransfer.findMany({
              where: {
                status: 'PENDING',
                createdAt: { lte: new Date(Date.now() - STALE_AFTER_MINUTES * 60_000) },
              },
              select: { id: true },
            })
          ).map((t: { id: string }) => t.id);

      const results: Record<string, unknown> = {};
      let failedCount = 0;

      for (const id of ids) {
        try {
          results[id] = await this.api.post(`/transfers/${id}/verify`);
        } catch (err) {
          // One transfer's still-unresolved verify shouldn't abort
          // reconciling every other stale transfer in the same run —
          // same isolation PaymentReconciliationProcessor uses per-reference.
          failedCount += 1;
          results[id] = { error: (err as Error).message };
          this.logger.warn(`Reconciliation failed for bank transfer "${id}": ${(err as Error).message}`);
        }
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result: { reconciled: ids.length, failed: failedCount } });
      return { reconciled: ids.length, failed: failedCount, results };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Bank transfer reconciliation failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
