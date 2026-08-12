import { SmsService } from '../sms.service';

describe('SmsService', () => {
  let queueProducer: { enqueueSms: jest.Mock };
  let service: SmsService;

  beforeEach(() => {
    queueProducer = { enqueueSms: jest.fn().mockResolvedValue({ jobId: 'job1', queueName: 'sms' }) };
    service = new SmsService(queueProducer as any);
  });

  it('enqueues the SMS via QueueProducerService.enqueueSms', async () => {
    const result = await service.sendSms({ to: '+15551234567', body: 'Your code is 123456' } as any);

    expect(queueProducer.enqueueSms).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Your code is 123456',
      notificationId: undefined,
    });
    expect(result).toEqual({ to: '+15551234567', queued: true });
  });

  it('passes notificationId through when the caller supplies one', async () => {
    await service.sendSms({ to: '+15551234567', body: 'Hi', notificationId: 'notif1' } as any);

    expect(queueProducer.enqueueSms).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'notif1' }),
    );
  });
});
