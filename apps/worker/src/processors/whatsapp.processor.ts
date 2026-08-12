import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationStatus } from '@prisma/client';
import { QUEUE_NAMES, type WhatsAppJobData } from '@7f/queue';
import { WhatsAppCloudService } from '../whatsapp/whatsapp-cloud.service';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Release ID.2 Part 1 — WhatsApp Cloud API. Mirrors SmsProcessor exactly
 * — same job-run logging, same feature-flag gate shape (a new,
 * independent flag rather than reusing jobs.sms_queue, so WhatsApp can
 * be disabled without affecting SMS), same Notification status
 * transitions on success/failure.
 */
@Processor(QUEUE_NAMES.WHATSAPP)
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly whatsapp: WhatsAppCloudService,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<WhatsAppJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.whatsapp_queue'))) {
      this.logger.warn(`jobs.whatsapp_queue is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.WHATSAPP,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const result = await this.whatsapp.send(job.data);

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
      this.logger.error(`WhatsApp send failed to ${job.data.to}: ${error.message}`);

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
