import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { QUEUE_NAMES, type PayrollProcessingJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reuses HrPayrollService.calculatePayrollRun (apps/api/src/hr-payroll/hr-payroll.service.ts)
 * over HTTP via InternalApiClient — the calculation logic itself is not
 * duplicated here. This processor's job is orchestration: run the
 * calculation, persist a Notification for the requester, and record the
 * job's outcome for the queue dashboard.
 */
@Processor(QUEUE_NAMES.PAYROLL_PROCESSING)
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PayrollProcessingJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.payroll_processing'))) {
      this.logger.warn(`jobs.payroll_processing is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.PAYROLL_PROCESSING,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const result = await this.api.post(`/hr/payroll-runs/${job.data.payrollRunId}/calculate`);

      const notification = await this.prisma.notification.create({
        data: {
          userId: job.data.requestedByUserId,
          title: 'Payroll run calculated',
          body: `Payroll run ${job.data.payrollRunId} finished calculating and is ready for approval.`,
          metadata: { payrollRunId: job.data.payrollRunId },
        },
      });
      await this.notificationQueue.add('deliver', { notificationId: notification.id });

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result });
      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Payroll calculation failed for run ${job.data.payrollRunId}: ${error.message}`);

      const notification = await this.prisma.notification.create({
        data: {
          userId: job.data.requestedByUserId,
          title: 'Payroll run calculation failed',
          body: `Payroll run ${job.data.payrollRunId} failed to calculate: ${error.message}`,
          metadata: { payrollRunId: job.data.payrollRunId, error: error.message },
        },
      });
      await this.notificationQueue.add('deliver', { notificationId: notification.id });

      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
