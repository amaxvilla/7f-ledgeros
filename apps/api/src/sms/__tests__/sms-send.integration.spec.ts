import { Test } from '@nestjs/testing';
import { SmsController } from '../sms.controller';
import { SmsService } from '../sms.service';
import { QueueProducerService } from '../../queue/queue-producer.service';

/**
 * Same convention as sms.integration.spec.ts: this repo has no
 * supertest/real-HTTP-server e2e harness anywhere (every *.spec.ts mocks
 * at the repository/infra boundary rather than booting a real app), so
 * this wires the REAL controller and REAL service together and only
 * mocks QueueProducerService (which itself wraps real BullMQ Queue
 * instances requiring Redis — the actual repository/infra boundary for
 * this path, same role PrismaService plays in the webhook integration
 * test). A true e2e test (real HTTP request in, real Redis/worker
 * consuming the job out) does not exist for this or any other route in
 * the codebase; introducing that harness is a separate, larger piece of
 * infrastructure work than this release's scope.
 */
describe('SMS send integration (controller + service, real DI wiring)', () => {
  let controller: SmsController;
  let queueProducer: { enqueueSms: jest.Mock };

  beforeEach(async () => {
    queueProducer = { enqueueSms: jest.fn().mockResolvedValue({ jobId: 'job1', queueName: 'sms' }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [SmsService, { provide: QueueProducerService, useValue: queueProducer }],
    }).compile();

    controller = moduleRef.get(SmsController);
  });

  it('end-to-end (within this repo\'s testing convention): a send request reaches QueueProducerService.enqueueSms with the right payload', async () => {
    const result = await controller.send({ to: '+15551234567', body: 'Your OTP is 000000' } as any);

    expect(queueProducer.enqueueSms).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Your OTP is 000000',
      notificationId: undefined,
    });
    expect(result).toEqual({ to: '+15551234567', queued: true });
  });

  it('propagates a queue failure rather than reporting false success', async () => {
    queueProducer.enqueueSms.mockRejectedValue(new Error('Redis unavailable'));

    await expect(controller.send({ to: '+15551234567', body: 'Hi' } as any)).rejects.toThrow('Redis unavailable');
  });
});
