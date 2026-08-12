import { WhatsAppService } from '../whatsapp.service';

describe('WhatsAppService', () => {
  let queueProducer: { enqueueWhatsApp: jest.Mock };
  let service: WhatsAppService;

  beforeEach(() => {
    queueProducer = { enqueueWhatsApp: jest.fn().mockResolvedValue({ jobId: 'job1', queueName: 'whatsapp' }) };
    service = new WhatsAppService(queueProducer as any);
  });

  it('enqueues the message via QueueProducerService.enqueueWhatsApp', async () => {
    const result = await service.sendWhatsApp({ to: '+15551234567', body: 'Your code is 123456' } as any);

    expect(queueProducer.enqueueWhatsApp).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Your code is 123456',
      notificationId: undefined,
    });
    expect(result).toEqual({ to: '+15551234567', queued: true });
  });

  it('passes notificationId through when the caller supplies one', async () => {
    await service.sendWhatsApp({ to: '+15551234567', body: 'Hi', notificationId: 'notif1' } as any);

    expect(queueProducer.enqueueWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'notif1' }),
    );
  });
});
