import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, type SignatureReconciliationJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/** A SENT offer with an outstanding envelope younger than this is still a normal in-flight signing wait, not stale. Longer than PaymentReconciliation's/BankTransferReconciliation's own 15-minute cutoff — see this class's own doc comment for why. */
const STALE_AFTER_MINUTES = 60;

/**
 * Digital Signature Providers, Checkpoint M.
 *
 * Closes the gap OfferService.checkSignatureStatus's own doc comment
 * (Checkpoint L) named: that method existed but was only ever reachable
 * by hand via POST /recruitment/offers/:id/check-signature-status. Same
 * "worker does the direct-Prisma enumeration, API does the one real
 * business-logic call per item" split PaymentReconciliationProcessor/
 * BankTransferReconciliationProcessor both use: this class finds which
 * Offer rows are stale and calls the existing POST
 * /recruitment/offers/:id/check-signature-status endpoint once per
 * row — OfferService.checkSignatureStatus(), Checkpoint L. No new
 * OfferService method, no new controller route, no second copy of
 * "what does checking a signature status mean".
 *
 * STALE_AFTER_MINUTES is deliberately 60, not
 * PaymentReconciliationProcessor's/BankTransferReconciliationProcessor's
 * own 15: a payment or transfer's PENDING status resolves in seconds to
 * low minutes (a gateway round-trip, a bank rail settlement) and is
 * financially time-sensitive at that scale; a candidate actually
 * opening their email and signing an offer letter routinely takes hours
 * to days. A 15-minute sweep here would mostly find the same still-SENT
 * offers it found 15 minutes ago and burn Graph/DocuSign API calls for
 * no new information — 60 minutes (paired with this processor's own
 * 30-minute schedule cadence, see SchedulerService) is a better match
 * for how quickly this particular status actually changes.
 *
 * Only SENT offers with a non-null signatureProviderEnvelopeId are
 * swept — same reasoning BankTransferReconciliationProcessor's own
 * PENDING-only filter uses: checkSignatureStatus() itself already
 * throws ConflictException for any other combination (see its own doc
 * comment), so including them here would just be wasted, always-failing
 * calls.
 */
@Processor(QUEUE_NAMES.SIGNATURE_RECONCILIATION)
export class SignatureReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(SignatureReconciliationProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SignatureReconciliationJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.signature_reconciliation'))) {
      this.logger.warn(`jobs.signature_reconciliation is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.SIGNATURE_RECONCILIATION,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const ids = job.data.offerId
        ? (
            await this.prisma.offer.findMany({
              where: { id: job.data.offerId },
              select: { id: true },
            })
          ).map((o: { id: string }) => o.id)
        : (
            await this.prisma.offer.findMany({
              where: {
                status: 'SENT',
                signatureProviderEnvelopeId: { not: null },
                sentAt: { lte: new Date(Date.now() - STALE_AFTER_MINUTES * 60_000) },
              },
              select: { id: true },
            })
          ).map((o: { id: string }) => o.id);

      const results: Record<string, unknown> = {};
      let failedCount = 0;

      for (const id of ids) {
        try {
          results[id] = await this.api.post(`/recruitment/offers/${id}/check-signature-status`);
        } catch (err) {
          // One offer's still-unresolved check shouldn't abort
          // reconciling every other stale offer in the same run — same
          // isolation PaymentReconciliationProcessor/
          // BankTransferReconciliationProcessor use per-row.
          failedCount += 1;
          results[id] = { error: (err as Error).message };
          this.logger.warn(`Reconciliation failed for offer "${id}": ${(err as Error).message}`);
        }
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result: { reconciled: ids.length, failed: failedCount } });
      return { reconciled: ids.length, failed: failedCount, results };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Signature reconciliation failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
