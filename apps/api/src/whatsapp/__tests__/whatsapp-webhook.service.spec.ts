import { Test } from '@nestjs/testing';
import { NotificationStatus } from '@prisma/client';
import { WhatsAppWebhookService } from '../whatsapp-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import * as sigUtil from '../whatsapp-signature.util';

describe('WhatsAppWebhookService', () => {
  let service: WhatsAppWebhookService;
  let prisma: {
    integrationProvider: { findUnique: jest.Mock };
    notification: { findFirst: jest.Mock; update: jest.Mock };
  };
  let integrations: { getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  beforeEach(async () => {
    prisma = {
      integrationProvider: { findUnique: jest.fn() },
      notification: { findFirst: jest.fn(), update: jest.fn() },
    };
    integrations = { getDecryptedCredentials: jest.fn() };
    process.env = { ...originalEnv };
    delete process.env.WHATSAPP_CLOUD_PROVIDER_ID;
    delete process.env.WHATSAPP_CLOUD_VERIFY_TOKEN;
    delete process.env.WHATSAPP_CLOUD_APP_SECRET;

    const moduleRef = await Test.createTestingModule({
      providers: [
        WhatsAppWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: IntegrationsService, useValue: integrations },
      ],
    }).compile();
    service = moduleRef.get(WhatsAppWebhookService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('resolveVerifyToken', () => {
    it('falls back to WHATSAPP_CLOUD_VERIFY_TOKEN when no provider id is configured', async () => {
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'env-token';
      expect(await service.resolveVerifyToken()).toBe('env-token');
      expect(prisma.integrationProvider.findUnique).not.toHaveBeenCalled();
    });

    it('prefers config.verifyToken from the IntegrationProvider when WHATSAPP_CLOUD_PROVIDER_ID is set', async () => {
      process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'provider-1';
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'env-token';
      prisma.integrationProvider.findUnique.mockResolvedValue({ config: { verifyToken: 'provider-token' } });

      expect(await service.resolveVerifyToken()).toBe('provider-token');
    });

    it('falls back to the env var when the provider has no usable config.verifyToken', async () => {
      process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'provider-1';
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'env-token';
      prisma.integrationProvider.findUnique.mockResolvedValue({ config: {} });

      expect(await service.resolveVerifyToken()).toBe('env-token');
    });

    it('returns null when nothing is configured anywhere', async () => {
      expect(await service.resolveVerifyToken()).toBeNull();
    });
  });

  describe('resolveAppSecret', () => {
    it('falls back to WHATSAPP_CLOUD_APP_SECRET when no provider id is configured', async () => {
      process.env.WHATSAPP_CLOUD_APP_SECRET = 'env-secret';
      expect(await service.resolveAppSecret()).toBe('env-secret');
      expect(integrations.getDecryptedCredentials).not.toHaveBeenCalled();
    });

    it('prefers credentials.appSecret from the IntegrationProvider when WHATSAPP_CLOUD_PROVIDER_ID is set', async () => {
      process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'provider-1';
      process.env.WHATSAPP_CLOUD_APP_SECRET = 'env-secret';
      integrations.getDecryptedCredentials.mockResolvedValue({ accessToken: 'tok', appSecret: 'provider-secret' });

      expect(await service.resolveAppSecret()).toBe('provider-secret');
    });

    it('falls back to the env var when the provider has no usable appSecret', async () => {
      process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'provider-1';
      process.env.WHATSAPP_CLOUD_APP_SECRET = 'env-secret';
      integrations.getDecryptedCredentials.mockResolvedValue({ accessToken: 'tok' });

      expect(await service.resolveAppSecret()).toBe('env-secret');
    });

    it('returns null when nothing is configured anywhere', async () => {
      expect(await service.resolveAppSecret()).toBeNull();
    });
  });

  describe('verifyHandshake', () => {
    it('rejects when mode is not "subscribe"', async () => {
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'secret-token';
      expect(await service.verifyHandshake('unsubscribe', 'secret-token')).toBe(false);
    });

    it('rejects (fails closed) when no verify token is configured', async () => {
      expect(await service.verifyHandshake('subscribe', 'anything')).toBe(false);
    });

    it('accepts a matching token with mode=subscribe', async () => {
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'secret-token';
      expect(await service.verifyHandshake('subscribe', 'secret-token')).toBe(true);
    });

    it('rejects a non-matching token', async () => {
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'secret-token';
      expect(await service.verifyHandshake('subscribe', 'wrong-token')).toBe(false);
    });
  });

  describe('verifySignature', () => {
    it('rejects (fails closed) when no app secret is configured', async () => {
      expect(await service.verifySignature(Buffer.from('{}'), 'sha256=abc')).toBe(false);
    });

    it('delegates to verifyMetaSignature when a secret is available', async () => {
      process.env.WHATSAPP_CLOUD_APP_SECRET = 'env-secret';
      const spy = jest.spyOn(sigUtil, 'verifyMetaSignature').mockReturnValue(true);
      const rawBody = Buffer.from('{"a":1}');

      const result = await service.verifySignature(rawBody, 'sha256=abc');

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith('env-secret', rawBody, 'sha256=abc');
    });
  });

  describe('applyCallback', () => {
    it('ignores an entry missing id or status', async () => {
      const result = await service.applyCallback({ entry: [{ changes: [{ value: { statuses: [{ status: 'delivered' }] } }] }] });
      expect(result).toEqual({ statuses: 1, matched: 0 });
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('reports unmatched when no notification has this providerMessageId', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      const result = await service.applyCallback({
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }],
      });
      expect(result).toEqual({ statuses: 1, matched: 0 });
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('sets DELIVERED + deliveredAt on a "delivered" status', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1', deliveredAt: null });
      const result = await service.applyCallback({
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }],
      });

      expect(result).toEqual({ statuses: 1, matched: 1 });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.DELIVERED, deliveredAt: expect.any(Date) },
      });
    });

    it('sets READ + readAt (and backfills deliveredAt) on a "read" status', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1', deliveredAt: null });
      await service.applyCallback({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }] });

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.READ, readAt: expect.any(Date), deliveredAt: expect.any(Date) },
      });
    });

    it('preserves an existing deliveredAt when a "read" status arrives after delivery was already recorded', async () => {
      const existingDeliveredAt = new Date('2026-01-01T00:00:00Z');
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1', deliveredAt: existingDeliveredAt });
      await service.applyCallback({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }] });

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.READ, readAt: expect.any(Date), deliveredAt: existingDeliveredAt },
      });
    });

    it('sets FAILED on a "failed" status', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      await service.applyCallback({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'failed' }] } }] }] });

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it('makes no update for an in-flight "sent" status', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      const result = await service.applyCallback({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'sent' }] } }] }] });

      expect(result).toEqual({ statuses: 1, matched: 1 });
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('processes multiple statuses across multiple entries/changes in one callback', async () => {
      prisma.notification.findFirst
        .mockResolvedValueOnce({ id: 'n1', deliveredAt: null })
        .mockResolvedValueOnce({ id: 'n2' });

      const result = await service.applyCallback({
        entry: [
          { changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] },
          { changes: [{ value: { statuses: [{ id: 'wamid.2', status: 'failed' }] } }] },
        ],
      });

      expect(result).toEqual({ statuses: 2, matched: 2 });
      expect(prisma.notification.update).toHaveBeenCalledTimes(2);
    });

    it('safely ignores a payload containing only inbound messages[] (no statuses[])', async () => {
      const result = await service.applyCallback({
        entry: [{ changes: [{ value: { messages: [{ id: 'wamid.inbound', from: '15551234567' }] } }] }],
      });

      expect(result).toEqual({ statuses: 0, matched: 0 });
      expect(prisma.notification.findFirst).not.toHaveBeenCalled();
    });
  });
});
