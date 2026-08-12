import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, type PaymentReconciliationJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/** A PENDING transaction younger than this is still a normal in-flight checkout, not stale. */
const STALE_AFTER_MINUTES = 15;

/**
 * Release IE.1, Checkpoint E — Payment Framework reconciliation.
 * Release IE.2, Checkpoint G extends this to PaymentRefund rows too.
 *
 * Deliberately does NOT re-implement verification here: this class's
 * only job is finding which PaymentTransaction/PaymentRefund rows are
 * stale (same "worker does the direct-Prisma enumeration, API does the
 * one real business-logic call per item" split BudgetRecalculationProcessor
 * uses for budget variance) and then calling the existing
 * POST /payments/:reference/verify or POST /payments/refunds/:refundReference/verify
 * endpoint once per stale row — Checkpoint D's PaymentsService.verifyPayment()
 * and Checkpoint G's PaymentsService.verifyRefund(). No new PaymentsService
 * method beyond those two, no new controller route beyond those two, no
 * second copy of "what does verifying a payment/refund mean".
 */
@Processor(QUEUE_NAMES.PAYMENT_RECONCILIATION)
export class PaymentReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentReconciliationProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<PaymentReconciliationJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.payment_reconciliation'))) {
      this.logger.warn(`jobs.payment_reconciliation is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.PAYMENT_RECONCILIATION,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const references = job.data.paymentTransactionId
        ? (
            await this.prisma.paymentTransaction.findMany({
              where: { id: job.data.paymentTransactionId },
              select: { reference: true },
            })
          ).map((t: { reference: string }) => t.reference)
        : (
            await this.prisma.paymentTransaction.findMany({
              where: {
                status: 'PENDING',
                createdAt: { lte: new Date(Date.now() - STALE_AFTER_MINUTES * 60_000) },
              },
              select: { reference: true },
            })
          ).map((t: { reference: string }) => t.reference);

      const refundReferences = job.data.paymentRefundId
        ? (
            await this.prisma.paymentRefund.findMany({
              where: { id: job.data.paymentRefundId },
              select: { refundReference: true },
            })
          ).map((r: { refundReference: string }) => r.refundReference)
        : (
            await this.prisma.paymentRefund.findMany({
              where: {
                status: 'PENDING',
                createdAt: { lte: new Date(Date.now() - STALE_AFTER_MINUTES * 60_000) },
              },
              select: { refundReference: true },
            })
          ).map((r: { refundReference: string }) => r.refundReference);

      const results: Record<string, unknown> = {};
      let failedCount = 0;
      for (const reference of references) {
        try {
          results[reference] = await this.api.post(`/payments/${reference}/verify`);
        } catch (err) {
          // One provider's transient failure shouldn't abort reconciling
          // every other stale transaction in the same run.
          failedCount += 1;
          results[reference] = { error: (err as Error).message };
          this.logger.warn(`Reconciliation failed for payment "${reference}": ${(err as Error).message}`);
        }
      }

      // Release IE.2, Checkpoint G. Same per-item try/catch isolation as
      // the transaction loop above, and a distinctly-prefixed results key
      // (refund:<refundReference>) so a transaction reference and a
      // refund reference can never collide in the same results object.
      for (const refundReference of refundReferences) {
        try {
          results[`refund:${refundReference}`] = await this.api.post(`/payments/refunds/${refundReference}/verify`);
        } catch (err) {
          failedCount += 1;
          results[`refund:${refundReference}`] = { error: (err as Error).message };
          this.logger.warn(`Reconciliation failed for refund "${refundReference}": ${(err as Error).message}`);
        }
      }

      await this.jobRunLog.recordSuccess({
        jobId: String(job.id),
        result: { reconciled: references.length + refundReferences.length, failed: failedCount },
      });
      return { reconciled: references.length + refundReferences.length, failed: failedCount, results };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Payment reconciliation failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
