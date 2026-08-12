import { Test, TestingModule } from '@nestjs/testing';
import { NotificationStatus } from '@prisma/client';
import { SmsProcessor } from './sms.processor';
import { TwilioSmsService } from '../sms/twilio-sms.service';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'deliver', data, attemptsMade: 0 } as any;
}

describe('SmsProcessor', () => {
  let processor: SmsProcessor;
  let sms: { send: jest.Mock };
  let prisma: { notification: { update: jest.Mock } };
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    sms = { send: jest.fn() };
    prisma = { notification: { update: jest.fn() } };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsProcessor,
        { provide: TwilioSmsService, useValue: sms },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(SmsProcessor);
  });

  it('sends the SMS and marks the linked notification SENT with the providerMessageId on success', async () => {
    sms.send.mockResolvedValue({ delivered: true, providerMessageId: 'SMxxxx' });

    const job = makeJob({ to: '+15551234567', body: 'Hi', notificationId: 'notif-1' });
    const result = await processor.process(job);

    expect(sms.send).toHaveBeenCalledWith(job.data);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.SENT, sentAt: expect.any(Date), providerMessageId: 'SMxxxx' },
    });
    expect(result).toEqual({ delivered: true, providerMessageId: 'SMxxxx' });
  });

  it('marks the linked notification FAILED and rethrows on send failure', async () => {
    sms.send.mockRejectedValue(new Error('twilio down'));

    const job = makeJob({ to: '+15551234567', body: 'Hi', notificationId: 'notif-1' });

    await expect(processor.process(job)).rejects.toThrow('twilio down');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.FAILED },
    });
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const job = makeJob({ to: '+15551234567', body: 'Hi' });
    const result = await processor.process(job);

    expect(result).toEqual({ skipped: true });
    expect(sms.send).not.toHaveBeenCalled();
  });
});
