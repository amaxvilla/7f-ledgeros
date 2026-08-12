import { ForbiddenException } from '@nestjs/common';
import { TwilioWebhookController } from '../twilio-webhook.controller';

function buildRequest(overrides: Partial<{ protocol: string; originalUrl: string; host: string }> = {}) {
  return {
    protocol: overrides.protocol ?? 'https',
    originalUrl: overrides.originalUrl ?? '/api/v1/sms/webhook/status',
    get: (name: string) => (name === 'host' ? overrides.host ?? 'api.example.com' : undefined),
  } as any;
}

describe('TwilioWebhookController', () => {
  let webhook: { verifySignature: jest.Mock; applyStatusCallback: jest.Mock };
  let controller: TwilioWebhookController;
  const originalEnv = process.env;

  beforeEach(() => {
    webhook = { verifySignature: jest.fn(), applyStatusCallback: jest.fn() };
    controller = new TwilioWebhookController(webhook as any);
    process.env = { ...originalEnv };
    delete process.env.SMS_TWILIO_WEBHOOK_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws ForbiddenException and never applies the callback when the signature is invalid', async () => {
    webhook.verifySignature.mockResolvedValue(false);

    await expect(
      controller.status({ MessageSid: 'SM1', MessageStatus: 'delivered' }, 'bad-sig', buildRequest()),
    ).rejects.toThrow(ForbiddenException);

    expect(webhook.applyStatusCallback).not.toHaveBeenCalled();
  });

  it('applies the callback when the signature is valid', async () => {
    webhook.verifySignature.mockResolvedValue(true);
    webhook.applyStatusCallback.mockResolvedValue({ matched: true });

    await controller.status({ MessageSid: 'SM1', MessageStatus: 'delivered' }, 'good-sig', buildRequest());

    expect(webhook.applyStatusCallback).toHaveBeenCalledWith({ MessageSid: 'SM1', MessageStatus: 'delivered' });
  });

  it('uses SMS_TWILIO_WEBHOOK_URL when configured, ignoring the request', async () => {
    process.env.SMS_TWILIO_WEBHOOK_URL = 'https://public.example.com/api/v1/sms/webhook/status';
    webhook.verifySignature.mockResolvedValue(true);
    webhook.applyStatusCallback.mockResolvedValue({ matched: true });

    await controller.status(
      { MessageSid: 'SM1', MessageStatus: 'delivered' },
      'sig',
      buildRequest({ host: 'internal-lb:8080', protocol: 'http' }),
    );

    expect(webhook.verifySignature).toHaveBeenCalledWith(
      'https://public.example.com/api/v1/sms/webhook/status',
      expect.any(Object),
      'sig',
    );
  });

  it('reconstructs the URL from the request when SMS_TWILIO_WEBHOOK_URL is unset', async () => {
    webhook.verifySignature.mockResolvedValue(true);
    webhook.applyStatusCallback.mockResolvedValue({ matched: true });

    await controller.status(
      { MessageSid: 'SM1', MessageStatus: 'delivered' },
      'sig',
      buildRequest({ host: 'api.example.com', protocol: 'https', originalUrl: '/api/v1/sms/webhook/status' }),
    );

    expect(webhook.verifySignature).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/sms/webhook/status',
      expect.any(Object),
      'sig',
    );
  });
});
