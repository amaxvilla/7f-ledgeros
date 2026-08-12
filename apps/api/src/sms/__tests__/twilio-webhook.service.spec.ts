import { Test } from '@nestjs/testing';
import { NotificationStatus } from '@prisma/client';
import { TwilioWebhookService } from '../twilio-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import * as sigUtil from '../twilio-signature.util';

describe('TwilioWebhookService', () => {
  let service: TwilioWebhookService;
  let prisma: { notification: { findFirst: jest.Mock; update: jest.Mock } };
  let integrations: { getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  beforeEach(async () => {
    prisma = { notification: { findFirst: jest.fn(), update: jest.fn() } };
    integrations = { getDecryptedCredentials: jest.fn() };
    process.env = { ...originalEnv };
    delete process.env.SMS_TWILIO_PROVIDER_ID;
    delete process.env.TWILIO_AUTH_TOKEN;

    const moduleRef = await Test.createTestingModule({
      providers: [
        TwilioWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: IntegrationsService, useValue: integrations },
      ],
    }).compile();
    service = moduleRef.get(TwilioWebhookService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('resolveAuthToken', () => {
    it('falls back to TWILIO_AUTH_TOKEN when no provider id is configured', async () => {
      process.env.TWILIO_AUTH_TOKEN = 'env-token';
      expect(await service.resolveAuthToken()).toBe('env-token');
      expect(integrations.getDecryptedCredentials).not.toHaveBeenCalled();
    });

    it('prefers the IntegrationProvider credential when SMS_TWILIO_PROVIDER_ID is set', async () => {
      process.env.SMS_TWILIO_PROVIDER_ID = 'provider-1';
      process.env.TWILIO_AUTH_TOKEN = 'env-token';
      integrations.getDecryptedCredentials.mockResolvedValue({ accountSid: 'AC1', authToken: 'provider-token' });

      expect(await service.resolveAuthToken()).toBe('provider-token');
    });

    it('falls back to the env var when the provider has no usable authToken', async () => {
      process.env.SMS_TWILIO_PROVIDER_ID = 'provider-1';
      process.env.TWILIO_AUTH_TOKEN = 'env-token';
      integrations.getDecryptedCredentials.mockResolvedValue({ accountSid: 'AC1' });

      expect(await service.resolveAuthToken()).toBe('env-token');
    });

    it('returns null when nothing is configured anywhere', async () => {
      expect(await service.resolveAuthToken()).toBeNull();
    });
  });

  describe('verifySignature', () => {
    it('rejects (fails closed) when no auth token is configured', async () => {
      expect(await service.verifySignature('https://x/y', {}, 'sig')).toBe(false);
    });

    it('delegates to verifyTwilioSignature when a token is available', async () => {
      process.env.TWILIO_AUTH_TOKEN = 'env-token';
      const spy = jest.spyOn(sigUtil, 'verifyTwilioSignature').mockReturnValue(true);

      const result = await service.verifySignature('https://x/y', { a: 'b' }, 'sig');

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith('env-token', 'https://x/y', { a: 'b' }, 'sig');
    });
  });

  describe('applyStatusCallback', () => {
    it('ignores a callback missing MessageSid/MessageStatus', async () => {
      const result = await service.applyStatusCallback({});
      expect(result.matched).toBe(false);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('reports unmatched when no notification has this providerMessageId', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      const result = await service.applyStatusCallback({ MessageSid: 'SM1', MessageStatus: 'delivered' });
      expect(result.matched).toBe(false);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('sets DELIVERED + deliveredAt on a "delivered" callback', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      const result = await service.applyStatusCallback({ MessageSid: 'SM1', MessageStatus: 'delivered' });

      expect(result.matched).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.DELIVERED, deliveredAt: expect.any(Date) },
      });
    });

    it.each(['failed', 'undelivered'])('sets FAILED on a "%s" callback', async (status) => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      await service.applyStatusCallback({ MessageSid: 'SM1', MessageStatus: status });

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it.each(['queued', 'sending', 'sent'])('makes no update for an in-flight "%s" callback', async (status) => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      const result = await service.applyStatusCallback({ MessageSid: 'SM1', MessageStatus: status });

      expect(result.matched).toBe(true);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });
});
