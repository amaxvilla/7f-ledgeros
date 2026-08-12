import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@7f/queue';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.BUDGET_RECALCULATION) private readonly budgetQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DASHBOARD_REFRESH) private readonly dashboardQueue: Queue,
    @InjectQueue(QUEUE_NAMES.INTEGRATION_HEALTH_CHECK) private readonly integrationHealthQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PAYMENT_RECONCILIATION) private readonly paymentReconciliationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MONO_STATEMENT_SYNC) private readonly monoStatementSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION) private readonly bankTransferReconciliationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SIGNATURE_RECONCILIATION) private readonly signatureReconciliationQueue: Queue,
  ) {}

  // Every 30 minutes: recompute variance for every APPROVED budget.
  @Cron('*/30 * * * *')
  async scheduleBudgetRecalculation() {
    this.logger.log('Scheduling budget recalculation (all open budgets)');
    await this.budgetQueue.add('scheduled-recalc-all', {});
  }

  // Hourly: refresh cached dashboard widgets for every active entity.
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleDashboardRefresh() {
    this.logger.log('Scheduling dashboard refresh (all active entities)');
    await this.dashboardQueue.add('scheduled-refresh-all', {});
  }

  // Every 15 minutes: health-check every active integration provider.
  @Cron('*/15 * * * *')
  async scheduleIntegrationHealthCheck() {
    this.logger.log('Scheduling integration health check (all active providers)');
    await this.integrationHealthQueue.add('scheduled-health-check-all', {});
  }

  // Release IE.1, Checkpoint E. Every 15 minutes: re-verify every stale
  // PENDING payment transaction, in case a webhook was missed or the
  // customer never returned from a hosted checkout redirect. Same
  // cadence as the integration health check above.
  @Cron('*/15 * * * *')
  async schedulePaymentReconciliation() {
    this.logger.log('Scheduling payment reconciliation (all stale PENDING transactions)');
    await this.paymentReconciliationQueue.add('scheduled-reconcile-stale', {});
  }

  // Release IF.1, Checkpoint H. Every 6 hours: sync every ACTIVE
  // MonoLinkedAccount forward from its own lastSyncedAt watermark. Much
  // less frequent than payment reconciliation above — bank statement
  // data doesn't need near-real-time freshness the way a checkout
  // redirect does, and Mono's own API has provider-side rate limits a
  // 15-minute cadence across every linked account would risk tripping.
  @Cron('0 */6 * * *')
  async scheduleMonoStatementSync() {
    this.logger.log('Scheduling Mono statement sync (all ACTIVE linked accounts)');
    await this.monoStatementSyncQueue.add('scheduled-sync-all', {});
  }

  // Enterprise Banking APIs, Transfer APIs — Checkpoint G. Every 15
  // minutes: re-verify every stale PENDING bank transfer, in case a
  // provider call was missed or delayed — same cadence and reasoning as
  // payment reconciliation above (financially meaningful, time-sensitive
  // status), not Mono's own 6-hour one.
  @Cron('*/15 * * * *')
  async scheduleBankTransferReconciliation() {
    this.logger.log('Scheduling bank transfer reconciliation (all stale PENDING transfers)');
    await this.bankTransferReconciliationQueue.add('scheduled-reconcile-stale', {});
  }

  // Digital Signature Providers, Checkpoint M. Every 30 minutes: re-check
  // every SENT offer with an outstanding signature envelope older than
  // SignatureReconciliationProcessor's own 60-minute staleness cutoff —
  // see that processor's own doc comment for why both numbers are
  // larger than payment/transfer reconciliation's 15-minute cadence.
  @Cron('*/30 * * * *')
  async scheduleSignatureReconciliation() {
    this.logger.log('Scheduling signature reconciliation (all stale SENT offers with an outstanding envelope)');
    await this.signatureReconciliationQueue.add('scheduled-reconcile-stale', {});
  }
}
