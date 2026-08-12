import { Test, TestingModule } from '@nestjs/testing';
import { NotificationStatus } from '@prisma/client';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppCloudService } from '../whatsapp/whatsapp-cloud.service';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'deliver', data, attemptsMade: 0 } as any;
}

describe('WhatsAppProcessor', () => {
  let processor: WhatsAppProcessor;
  let whatsapp: { send: jest.Mock };
  let prisma: { notification: { update: jest.Mock } };
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    whatsapp = { send: jest.fn() };
    prisma = { notification: { update: jest.fn() } };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppProcessor,
        { provide: WhatsAppCloudService, useValue: whatsapp },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(WhatsAppProcessor);
  });

  it('sends the WhatsApp message and marks the linked notification SENT with the providerMessageId on success', async () => {
    whatsapp.send.mockResolvedValue({ delivered: true, providerMessageId: 'wamid.123' });

    const job = makeJob({ to: '+15551234567', body: 'Hi', notificationId: 'notif-1' });
    const result = await processor.process(job);

    expect(whatsapp.send).toHaveBeenCalledWith(job.data);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.SENT, sentAt: expect.any(Date), providerMessageId: 'wamid.123' },
    });
    expect(result).toEqual({ delivered: true, providerMessageId: 'wamid.123' });
  });

  it('does not touch the notification when there is no notificationId (ad-hoc send)', async () => {
    whatsapp.send.mockResolvedValue({ delivered: true, providerMessageId: 'wamid.456' });

    await processor.process(makeJob({ to: '+15551234567', body: 'Hi' }));

    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks the linked notification FAILED and rethrows when the send fails', async () => {
    whatsapp.send.mockRejectedValue(new Error('WhatsApp Cloud send failed: HTTP 400'));

    const job = makeJob({ to: '+15551234567', body: 'Hi', notificationId: 'notif-2' });
    await expect(processor.process(job)).rejects.toThrow('WhatsApp Cloud send failed');

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-2' },
      data: { status: NotificationStatus.FAILED },
    });
  });

  it('skips entirely when jobs.whatsapp_queue is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const result = await processor.process(makeJob({ to: '+15551234567', body: 'Hi' }));

    expect(result).toEqual({ skipped: true });
    expect(whatsapp.send).not.toHaveBeenCalled();
  });
});
