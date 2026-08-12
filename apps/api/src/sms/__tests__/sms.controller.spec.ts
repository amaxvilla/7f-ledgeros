import { SmsController } from '../sms.controller';

describe('SmsController', () => {
  let sms: { sendSms: jest.Mock };
  let controller: SmsController;

  beforeEach(() => {
    sms = { sendSms: jest.fn().mockResolvedValue({ to: '+15551234567', queued: true }) };
    controller = new SmsController(sms as any);
  });

  it('delegates to SmsService.sendSms', async () => {
    const dto = { to: '+15551234567', body: 'Hi there' } as any;
    const result = await controller.send(dto);

    expect(sms.sendSms).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ to: '+15551234567', queued: true });
  });
});
