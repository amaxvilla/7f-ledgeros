import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS, type NotificationJobData } from '@7f/queue';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * "Delivering" an IN_APP notification just means marking it SENT — the web
 * app reads unread notifications directly from the notifications table.
 * If the notification's channel is EMAIL, this processor hands it off to
 * the email queue instead of sending mail itself, keeping the two queues'
 * responsibilities separate (and independently scalable/retryable).
 *
 * Release ID Part 1 adds the same hand-off for SMS. Two differences from
 * the EMAIL branch, both deliberate:
 *  - a user with no phone number set fails fast (marked FAILED with a
 *    logged reason) rather than enqueueing a job Twilio could never
 *    fulfill;
 *  - the SMS job's retry options are read from the active TWILIO
 *    IntegrationProvider's retryMaxAttempts/retryBackoffMs when one is
 *    configured, overriding DEFAULT_JOB_OPTIONS[SMS] — this is the "Retry
 *    Queue" piece of Release ID: those two IntegrationProvider columns
 *    existed since Release IA but nothing ever actually read them into a
 *    BullMQ job's options until now.
 *
 * Release ID.2 Part 1 adds the identical hand-off for WHATSAPP — same
 * "no phone number, fail fast" guard, same provider-level retry-options
 * override (against the active WHATSAPP_CLOUD provider instead of
 * TWILIO). Reuses `user.phone` rather than a separate WhatsApp-specific
 * number column: a WhatsApp Business number IS just a phone number, and
 * this repo has no product requirement yet for a user to have a
 * different number for SMS vs WhatsApp.
 */
@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SMS) private readonly smsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WHATSAPP) private readonly whatsappQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.notification_queue'))) {
      this.logger.warn(`jobs.notification_queue is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.NOTIFICATION,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: job.data.notificationId },
        include: { user: true },
      });
      if (!notification) {
        throw new NotFoundException(`Notification ${job.data.notificationId} not found`);
      }

      if (notification.channel === NotificationChannel.EMAIL) {
        await this.emailQueue.add('deliver', {
          to: [notification.user.email],
          subject: notification.title,
          html: notification.bodyHtml ?? undefined,
          text: notification.body,
          notificationId: notification.id,
        });
      } else if (notification.channel === NotificationChannel.SMS) {
        if (!notification.user.phone) {
          this.logger.warn(`Notification ${notification.id}: user ${notification.userId} has no phone set — cannot send SMS`);
          await this.prisma.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.FAILED } });
        } else {
          const retryOpts = await this.resolveRetryOptions(QUEUE_NAMES.SMS, process.env.SMS_TWILIO_PROVIDER_ID);
          await this.smsQueue.add(
            'deliver',
            { to: notification.user.phone, body: notification.body, notificationId: notification.id },
            { attempts: retryOpts.attempts, backoff: { type: 'exponential', delay: retryOpts.backoffMs } },
          );
        }
      } else if (notification.channel === NotificationChannel.WHATSAPP) {
        if (!notification.user.phone) {
          this.logger.warn(`Notification ${notification.id}: user ${notification.userId} has no phone set — cannot send WhatsApp message`);
          await this.prisma.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.FAILED } });
        } else {
          const retryOpts = await this.resolveRetryOptions(QUEUE_NAMES.WHATSAPP, process.env.WHATSAPP_CLOUD_PROVIDER_ID);
          await this.whatsappQueue.add(
            'deliver',
            { to: notification.user.phone, body: notification.body, notificationId: notification.id },
            { attempts: retryOpts.attempts, backoff: { type: 'exponential', delay: retryOpts.backoffMs } },
          );
        }
      } else {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
        });
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id) });
      return { delivered: true };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Notification delivery failed for ${job.data.notificationId}: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }

  /**
   * Reads retryMaxAttempts/retryBackoffMs off the given queue's active
   * IntegrationProvider (identified by `providerId`, e.g.
   * SMS_TWILIO_PROVIDER_ID or WHATSAPP_CLOUD_PROVIDER_ID) when set,
   * falling back to DEFAULT_JOB_OPTIONS[queueName] otherwise — same
   * fallback shape as TwilioSmsService/WhatsAppCloudService's own
   * credential resolution. Generalised from Release ID's
   * SMS-only `resolveSmsRetryOptions` so Release ID.2 doesn't duplicate
   * the same three lines for WHATSAPP.
   */
  private async resolveRetryOptions(
    queueName: typeof QUEUE_NAMES.SMS | typeof QUEUE_NAMES.WHATSAPP,
    providerId: string | undefined,
  ): Promise<{ attempts: number; backoffMs: number }> {
    const fallback = DEFAULT_JOB_OPTIONS[queueName];
    if (!providerId) return fallback;

    const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isActive) return fallback;

    return { attempts: provider.retryMaxAttempts, backoffMs: provider.retryBackoffMs };
  }
}
