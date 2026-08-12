import { Test } from '@nestjs/testing';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NotificationProcessor } from '../notification.processor';
import { JobRunLogService } from '../../jobs/job-run-log.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '@7f/queue';
import { getQueueToken } from '@nestjs/bullmq';

/**
 * NOTE: this module had no test coverage before Release IC.4. This file
 * only covers the one line changed in this release — forwarding
 * notification.bodyHtml onto the email queue job alongside the pre-existing
 * text field. The rest of process()'s behavior (feature-flag gating, job-run
 * logging, non-EMAIL channels) is untested pre-existing surface, not
 * something this release touched.
 */
/**
 * NOTE: this module had no test coverage before Release IC.4. This file
 * only covers the one line changed in Release IC.4 (bodyHtml forwarding)
 * plus the SMS branch added in Release ID Part 1. The rest of process()'s
 * behavior (feature-flag gating, job-run logging) is untested pre-existing
 * surface, not something either release touched.
 */
describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let prisma: any;
  let emailQueue: { add: jest.Mock };
  let smsQueue: { add: jest.Mock };
  let whatsappQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: { findUnique: jest.fn(), update: jest.fn() },
      integrationProvider: { findUnique: jest.fn() },
    };
    emailQueue = { add: jest.fn().mockResolvedValue({}) };
    smsQueue = { add: jest.fn().mockResolvedValue({}) };
    whatsappQueue = { add: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: { isEnabled: jest.fn().mockResolvedValue(true) } },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: emailQueue },
        { provide: getQueueToken(QUEUE_NAMES.SMS), useValue: smsQueue },
        { provide: getQueueToken(QUEUE_NAMES.WHATSAPP), useValue: whatsappQueue },
      ],
    }).compile();

    processor = moduleRef.get(NotificationProcessor);
  });

  it('forwards bodyHtml to the email queue job when the notification has one (Release IC.4 template with an htmlTemplate)', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n1',
      channel: NotificationChannel.EMAIL,
      title: 'Subject',
      body: 'Plain text body',
      bodyHtml: '<p>Rich body</p>',
      user: { email: 'a@example.com' },
    });

    await processor.process({ id: 'job1', data: { notificationId: 'n1' }, attemptsMade: 0 } as any);

    expect(emailQueue.add).toHaveBeenCalledWith('deliver', {
      to: ['a@example.com'],
      subject: 'Subject',
      html: '<p>Rich body</p>',
      text: 'Plain text body',
      notificationId: 'n1',
    });
  });

  it('leaves html undefined for a notification with no bodyHtml (a non-templated or text-only email — unchanged pre-IC.4 behavior)', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n2',
      channel: NotificationChannel.EMAIL,
      title: 'Subject',
      body: 'Plain text body',
      bodyHtml: null,
      user: { email: 'b@example.com' },
    });

    await processor.process({ id: 'job2', data: { notificationId: 'n2' }, attemptsMade: 0 } as any);

    expect(emailQueue.add).toHaveBeenCalledWith('deliver', {
      to: ['b@example.com'],
      subject: 'Subject',
      html: undefined,
      text: 'Plain text body',
      notificationId: 'n2',
    });
  });

  it('does not touch the email queue for a non-EMAIL channel notification', async () => {
    prisma.notification.findUnique.mockResolvedValue({
      id: 'n3',
      channel: NotificationChannel.IN_APP,
      title: 'Subject',
      body: 'Body',
      bodyHtml: null,
      user: { email: 'c@example.com' },
    });
    prisma.notification.update.mockResolvedValue({ id: 'n3', status: NotificationStatus.SENT });

    await processor.process({ id: 'job3', data: { notificationId: 'n3' }, attemptsMade: 0 } as any);

    expect(emailQueue.add).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n3' },
      data: { status: NotificationStatus.SENT, sentAt: expect.any(Date) },
    });
  });

  describe('Release ID Part 1 — SMS branch', () => {
    it('enqueues to the SMS queue with the default retry options when the user has a phone and no provider is configured', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n4',
        channel: NotificationChannel.SMS,
        userId: 'user-1',
        body: 'Your OTP is 123456',
        user: { phone: '+15551234567' },
      });
      delete process.env.SMS_TWILIO_PROVIDER_ID;

      await processor.process({ id: 'job4', data: { notificationId: 'n4' }, attemptsMade: 0 } as any);

      expect(smsQueue.add).toHaveBeenCalledWith(
        'deliver',
        { to: '+15551234567', body: 'Your OTP is 123456', notificationId: 'n4' },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
      );
    });

    it('fails fast (no job enqueued) when the user has no phone set', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n5',
        channel: NotificationChannel.SMS,
        userId: 'user-2',
        body: 'Your OTP is 123456',
        user: { phone: null },
      });

      await processor.process({ id: 'job5', data: { notificationId: 'n5' }, attemptsMade: 0 } as any);

      expect(smsQueue.add).not.toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n5' },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it("overrides the default retry options with the active TWILIO provider's own retryMaxAttempts/retryBackoffMs", async () => {
      process.env.SMS_TWILIO_PROVIDER_ID = 'provider-1';
      prisma.integrationProvider.findUnique.mockResolvedValue({
        id: 'provider-1',
        isActive: true,
        retryMaxAttempts: 7,
        retryBackoffMs: 9000,
      });
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n6',
        channel: NotificationChannel.SMS,
        userId: 'user-3',
        body: 'Alert',
        user: { phone: '+15559876543' },
      });

      await processor.process({ id: 'job6', data: { notificationId: 'n6' }, attemptsMade: 0 } as any);

      expect(smsQueue.add).toHaveBeenCalledWith(
        'deliver',
        { to: '+15559876543', body: 'Alert', notificationId: 'n6' },
        { attempts: 7, backoff: { type: 'exponential', delay: 9000 } },
      );
      delete process.env.SMS_TWILIO_PROVIDER_ID;
    });

    it('falls back to default retry options when the configured provider is inactive', async () => {
      process.env.SMS_TWILIO_PROVIDER_ID = 'provider-1';
      prisma.integrationProvider.findUnique.mockResolvedValue({ id: 'provider-1', isActive: false, retryMaxAttempts: 7, retryBackoffMs: 9000 });
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n7',
        channel: NotificationChannel.SMS,
        userId: 'user-4',
        body: 'Alert',
        user: { phone: '+15550000000' },
      });

      await processor.process({ id: 'job7', data: { notificationId: 'n7' }, attemptsMade: 0 } as any);

      expect(smsQueue.add).toHaveBeenCalledWith(
        'deliver',
        { to: '+15550000000', body: 'Alert', notificationId: 'n7' },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
      );
      delete process.env.SMS_TWILIO_PROVIDER_ID;
    });
  });

  describe('Release ID.2 Part 1 — WhatsApp branch', () => {
    it('enqueues to the WhatsApp queue with the default retry options when the user has a phone and no provider is configured', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n8',
        channel: NotificationChannel.WHATSAPP,
        userId: 'user-5',
        body: 'Your OTP is 654321',
        user: { phone: '+15551112222' },
      });
      delete process.env.WHATSAPP_CLOUD_PROVIDER_ID;

      await processor.process({ id: 'job8', data: { notificationId: 'n8' }, attemptsMade: 0 } as any);

      expect(whatsappQueue.add).toHaveBeenCalledWith(
        'deliver',
        { to: '+15551112222', body: 'Your OTP is 654321', notificationId: 'n8' },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
      );
    });

    it('fails fast (no job enqueued) when the user has no phone set', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n9',
        channel: NotificationChannel.WHATSAPP,
        userId: 'user-6',
        body: 'Your OTP is 654321',
        user: { phone: null },
      });

      await processor.process({ id: 'job9', data: { notificationId: 'n9' }, attemptsMade: 0 } as any);

      expect(whatsappQueue.add).not.toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n9' },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it("overrides the default retry options with the active WHATSAPP_CLOUD provider's own retryMaxAttempts/retryBackoffMs", async () => {
      process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'provider-2';
      prisma.integrationProvider.findUnique.mockResolvedValue({
        id: 'provider-2',
        isActive: true,
        retryMaxAttempts: 5,
        retryBackoffMs: 4000,
      });
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n10',
        channel: NotificationChannel.WHATSAPP,
        userId: 'user-7',
        body: 'Alert',
        user: { phone: '+15553334444' },
      });

      await processor.process({ id: 'job10', data: { notificationId: 'n10' }, attemptsMade: 0 } as any);

      expect(whatsappQueue.add).toHaveBeenCalledWith(
        'deliver',
        { to: '+15553334444', body: 'Alert', notificationId: 'n10' },
        { attempts: 5, backoff: { type: 'exponential', delay: 4000 } },
      );
      delete process.env.WHATSAPP_CLOUD_PROVIDER_ID;
    });
  });
});
