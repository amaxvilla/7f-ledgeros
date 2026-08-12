import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  createRedisConnection,
  DEFAULT_JOB_OPTIONS,
  type PayrollProcessingJobData,
  type EmailJobData,
  type NotificationJobData,
  type BankStatementImportJobData,
  type BudgetRecalculationJobData,
  type DashboardRefreshJobData,
  type ReportGenerationJobData,
  type SmsJobData,
  type WhatsAppJobData,
  type PaymentReconciliationJobData,
  type MonoStatementSyncJobData,
  type BankTransferReconciliationJobData,
} from '@7f/queue';

/**
 * This is additive infrastructure: existing domain controllers/services are
 * NOT modified to call this automatically (that would touch working business
 * logic and change existing API behavior). It's available for new/updated
 * endpoints to opt into async processing — e.g. a future
 * `POST /hr/payroll-runs/:id/calculate-async` alongside the existing
 * synchronous `POST /hr/payroll-runs/:id/calculate`.
 */
@Injectable()
export class QueueProducerService implements OnModuleDestroy {
  private readonly redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  private readonly queues = {
    [QUEUE_NAMES.PAYROLL_PROCESSING]: new Queue(QUEUE_NAMES.PAYROLL_PROCESSING, { connection: createRedisConnection(this.redisUrl) }),
    [QUEUE_NAMES.EMAIL]: new Queue(QUEUE_NAMES.EMAIL, { connection: createRedisConnection(this.redisUrl) }),
    [QUEUE_NAMES.NOTIFICATION]: new Queue(QUEUE_NAMES.NOTIFICATION, { connection: createRedisConnection(this.redisUrl) }),
    [QUEUE_NAMES.BANK_STATEMENT_IMPORT]: new Queue(QUEUE_NAMES.BANK_STATEMENT_IMPORT, { connection: createRedisConnection(this.redisUrl) }),
    [QUEUE_NAMES.BUDGET_RECALCULATION]: new Queue(QUEUE_NAMES.BUDGET_RECALCULATION, { connection: createRedisConnection(this.redisUrl) }),
    [QUEUE_NAMES.DASHBOARD_REFRESH]: new Queue(QUEUE_NAMES.DASHBOARD_REFRESH, { connection: createRedisConnection(this.redisUrl) }),
    [QUEUE_NAMES.REPORT_GENERATION]: new Queue(QUEUE_NAMES.REPORT_GENERATION, { connection: createRedisConnection(this.redisUrl) }),
    // Release ID Part 1 — SMS Integration (Twilio). This queue and
    // SmsJobData have existed in @7f/queue and apps/worker's SmsProcessor
    // since the rest of Part 1 shipped; nothing in apps/api ever actually
    // enqueued onto it until now.
    [QUEUE_NAMES.SMS]: new Queue(QUEUE_NAMES.SMS, { connection: createRedisConnection(this.redisUrl) }),
    // Release ID.2 Part 1 — WhatsApp Cloud API. Same shape as SMS above.
    [QUEUE_NAMES.WHATSAPP]: new Queue(QUEUE_NAMES.WHATSAPP, { connection: createRedisConnection(this.redisUrl) }),
    // Release IE.1, Checkpoint E — Payment Framework reconciliation.
    [QUEUE_NAMES.PAYMENT_RECONCILIATION]: new Queue(QUEUE_NAMES.PAYMENT_RECONCILIATION, { connection: createRedisConnection(this.redisUrl) }),
    // Release IF.1, Checkpoint H — Bank Integration Framework scheduled sync.
    [QUEUE_NAMES.MONO_STATEMENT_SYNC]: new Queue(QUEUE_NAMES.MONO_STATEMENT_SYNC, { connection: createRedisConnection(this.redisUrl) }),
    // Enterprise Banking APIs, Transfer APIs — Checkpoint G reconciliation sweep.
    [QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION]: new Queue(QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION, { connection: createRedisConnection(this.redisUrl) }),
  } as const;

  async enqueuePayrollProcessing(data: PayrollProcessingJobData) {
    return this.add(QUEUE_NAMES.PAYROLL_PROCESSING, 'calculate', data);
  }

  async enqueueEmail(data: EmailJobData) {
    return this.add(QUEUE_NAMES.EMAIL, 'deliver', data);
  }

  async enqueueNotification(data: NotificationJobData) {
    return this.add(QUEUE_NAMES.NOTIFICATION, 'deliver', data);
  }

  async enqueueBankStatementImport(data: BankStatementImportJobData) {
    return this.add(QUEUE_NAMES.BANK_STATEMENT_IMPORT, 'import', data);
  }

  async enqueueBudgetRecalculation(data: BudgetRecalculationJobData) {
    return this.add(QUEUE_NAMES.BUDGET_RECALCULATION, 'recalculate', data);
  }

  async enqueueDashboardRefresh(data: DashboardRefreshJobData) {
    return this.add(QUEUE_NAMES.DASHBOARD_REFRESH, 'refresh', data);
  }

  async enqueueReportGeneration(data: ReportGenerationJobData) {
    return this.add(QUEUE_NAMES.REPORT_GENERATION, 'generate', data);
  }

  /** Release ID Part 1 — hands off to the same 'deliver' job name and SmsProcessor that NotificationProcessor's SMS branch already uses. */
  async enqueueSms(data: SmsJobData) {
    return this.add(QUEUE_NAMES.SMS, 'deliver', data);
  }

  /** Release ID.2 Part 1 — same shape as enqueueSms, for WhatsAppProcessor. */
  async enqueueWhatsApp(data: WhatsAppJobData) {
    return this.add(QUEUE_NAMES.WHATSAPP, 'deliver', data);
  }

  /** Release IE.1, Checkpoint E. Omit paymentTransactionId to reconcile every stale PENDING transaction — same convention as enqueueing an integration health check for "all". */
  async enqueuePaymentReconciliation(data: PaymentReconciliationJobData) {
    return this.add(QUEUE_NAMES.PAYMENT_RECONCILIATION, 'reconcile', data);
  }

  /** Release IF.1, Checkpoint H. Omit monoLinkedAccountId to sync every ACTIVE MonoLinkedAccount — same convention as enqueuePaymentReconciliation above. Not called by any controller today (same as payment reconciliation, which is scheduler-only); available for a future manual "sync now" endpoint. */
  async enqueueMonoStatementSync(data: MonoStatementSyncJobData) {
    return this.add(QUEUE_NAMES.MONO_STATEMENT_SYNC, 'sync', data);
  }

  /** Enterprise Banking APIs, Transfer APIs — Checkpoint G. Omit bankTransferId to reconcile every stale PENDING BankTransfer — same convention as enqueuePaymentReconciliation above. Not called by any controller today (scheduler-only); available for a future manual "reconcile now" endpoint alongside the existing POST /transfers/:id/verify route. */
  async enqueueBankTransferReconciliation(data: BankTransferReconciliationJobData) {
    return this.add(QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION, 'reconcile', data);
  }

  private async add(queueName: keyof typeof this.queues, jobName: string, data: unknown) {
    const opts = DEFAULT_JOB_OPTIONS[queueName];
    const job = await this.queues[queueName].add(jobName, data, {
      attempts: opts.attempts,
      backoff: { type: 'exponential', delay: opts.backoffMs },
      removeOnComplete: { age: opts.removeOnCompleteAgeSeconds },
      removeOnFail: { age: opts.removeOnCompleteAgeSeconds },
    });
    return { jobId: job.id, queueName };
  }

  async onModuleDestroy() {
    await Promise.all(Object.values(this.queues).map((q) => q.close()));
  }
}
