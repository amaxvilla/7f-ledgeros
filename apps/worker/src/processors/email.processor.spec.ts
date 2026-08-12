import { Test, TestingModule } from '@nestjs/testing';
import { NotificationStatus } from '@prisma/client';
import { EmailProcessor } from './email.processor';
import { MailService } from '../mail/mail.service';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'deliver', data, attemptsMade: 0 } as any;
}

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let mail: { send: jest.Mock };
  let prisma: { notification: { update: jest.Mock } };
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    mail = { send: jest.fn() };
    prisma = { notification: { update: jest.fn() } };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: MailService, useValue: mail },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get(EmailProcessor);
  });

  it('sends the email and marks the linked notification SENT on success', async () => {
    mail.send.mockResolvedValue({ delivered: true, messageId: 'abc' });

    const job = makeJob({ to: ['a@b.com'], subject: 'Hi', text: 'Body', notificationId: 'notif-1' });
    const result = await processor.process(job);

    expect(mail.send).toHaveBeenCalledWith(job.data);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.SENT, sentAt: expect.any(Date) },
    });
    expect(result).toEqual({ delivered: true, messageId: 'abc' });
  });

  it('marks the linked notification FAILED and rethrows on send failure', async () => {
    mail.send.mockRejectedValue(new Error('smtp down'));

    const job = makeJob({ to: ['a@b.com'], subject: 'Hi', text: 'Body', notificationId: 'notif-1' });

    await expect(processor.process(job)).rejects.toThrow('smtp down');
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.FAILED },
    });
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const job = makeJob({ to: ['a@b.com'], subject: 'Hi', text: 'Body' });
    const result = await processor.process(job);

    expect(result).toEqual({ skipped: true });
    expect(mail.send).not.toHaveBeenCalled();
  });
});
