import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationStatus } from '@prisma/client';
import { QUEUE_NAMES, type EmailJobData } from '@7f/queue';
import { MailService } from '../mail/mail.service';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mail: MailService,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.email_queue'))) {
      this.logger.warn(`jobs.email_queue is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.EMAIL,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const result = await this.mail.send(job.data);

      if (job.data.notificationId) {
        await this.prisma.notification.update({
          where: { id: job.data.notificationId },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
        });
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result });
      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Email send failed to ${job.data.to.join(',')}: ${error.message}`);

      if (job.data.notificationId) {
        await this.prisma.notification
          .update({ where: { id: job.data.notificationId }, data: { status: NotificationStatus.FAILED } })
          .catch(() => undefined);
      }

      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
