import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationStatus } from '@prisma/client';
import { QUEUE_NAMES, type SmsJobData } from '@7f/queue';
import { TwilioSmsService } from '../sms/twilio-sms.service';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor(QUEUE_NAMES.SMS)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    private readonly sms: TwilioSmsService,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.sms_queue'))) {
      this.logger.warn(`jobs.sms_queue is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.SMS,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const result = await this.sms.send(job.data);

      if (job.data.notificationId) {
        await this.prisma.notification.update({
          where: { id: job.data.notificationId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            providerMessageId: result.providerMessageId,
          },
        });
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result });
      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`SMS send failed to ${job.data.to}: ${error.message}`);

      if (job.data.notificationId) {
        try {
          await this.prisma.notification.update({
            where: { id: job.data.notificationId },
            data: { status: NotificationStatus.FAILED },
          });
        } catch {
          // Notification status persistence must not mask the original send error.
        }
      }

      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
