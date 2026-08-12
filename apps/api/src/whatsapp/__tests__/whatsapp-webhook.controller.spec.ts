import { ForbiddenException } from '@nestjs/common';
import { WhatsAppWebhookController } from '../whatsapp-webhook.controller';

function buildRequest(rawBody: Buffer | undefined) {
  return { rawBody } as any;
}

describe('WhatsAppWebhookController', () => {
  let webhook: { verifyHandshake: jest.Mock; verifySignature: jest.Mock; applyCallback: jest.Mock };
  let controller: WhatsAppWebhookController;

  beforeEach(() => {
    webhook = { verifyHandshake: jest.fn(), verifySignature: jest.fn(), applyCallback: jest.fn() };
    controller = new WhatsAppWebhookController(webhook as any);
  });

  describe('verify (GET — subscription handshake)', () => {
    it('returns the challenge string when verification succeeds', async () => {
      webhook.verifyHandshake.mockResolvedValue(true);

      const result = await controller.verify('subscribe', 'good-token', 'challenge-123');

      expect(webhook.verifyHandshake).toHaveBeenCalledWith('subscribe', 'good-token');
      expect(result).toBe('challenge-123');
    });

    it('throws ForbiddenException when verification fails', async () => {
      webhook.verifyHandshake.mockResolvedValue(false);

      await expect(controller.verify('subscribe', 'bad-token', 'challenge-123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('callback (POST — status callback processing)', () => {
    it('throws ForbiddenException and never applies the callback when the signature is invalid', async () => {
      webhook.verifySignature.mockResolvedValue(false);

      await expect(
        controller.callback({ object: 'whatsapp_business_account', entry: [] }, 'bad-sig', buildRequest(Buffer.from('{}'))),
      ).rejects.toThrow(ForbiddenException);

      expect(webhook.applyCallback).not.toHaveBeenCalled();
    });

    it('applies the callback when the signature is valid', async () => {
      webhook.verifySignature.mockResolvedValue(true);
      webhook.applyCallback.mockResolvedValue({ statuses: 1, matched: 1 });
      const payload = { object: 'whatsapp_business_account', entry: [{ id: 'e1' }] };
      const rawBody = Buffer.from(JSON.stringify(payload));

      await controller.callback(payload, 'good-sig', buildRequest(rawBody));

      expect(webhook.verifySignature).toHaveBeenCalledWith(rawBody, 'good-sig');
      expect(webhook.applyCallback).toHaveBeenCalledWith(payload);
    });
  });
});
