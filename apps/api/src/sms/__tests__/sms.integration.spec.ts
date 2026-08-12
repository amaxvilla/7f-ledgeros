import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { NotificationStatus } from '@prisma/client';
import { TwilioWebhookController } from '../twilio-webhook.controller';
import { TwilioWebhookService } from '../twilio-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from '../../integrations/integrations.service';

/**
 * No e2e/supertest harness exists anywhere else in this repo (every
 * *.spec.ts file across all modules mocks Prisma directly rather than
 * booting a real HTTP server) — this follows that same convention rather
 * than introducing a new one, but wires the REAL controller, REAL
 * service, and the REAL crypto-based signature verification together
 * (only PrismaService and IntegrationsService are mocked, at the
 * repository boundary), so it exercises the actual request path rather
 * than each piece in isolation.
 */
function computeSignature(authToken: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

function buildRequest(url: string) {
  const u = new URL(url);
  return {
    protocol: u.protocol.replace(':', ''),
    originalUrl: u.pathname,
    get: (name: string) => (name === 'host' ? u.host : undefined),
  } as any;
}

describe('SMS webhook integration (controller + service + real signature verification)', () => {
  const authToken = 'integration-test-token';
  const webhookUrl = 'https://api.example.com/api/v1/sms/webhook/status';
  let controller: TwilioWebhookController;
  let prisma: { notification: { findFirst: jest.Mock; update: jest.Mock } };
  const originalEnv = process.env;

  beforeEach(async () => {
    prisma = { notification: { findFirst: jest.fn(), update: jest.fn() } };
    process.env = { ...originalEnv, TWILIO_AUTH_TOKEN: authToken, SMS_TWILIO_WEBHOOK_URL: webhookUrl };
    delete process.env.SMS_TWILIO_PROVIDER_ID;

    const moduleRef = await Test.createTestingModule({
      controllers: [TwilioWebhookController],
      providers: [
        TwilioWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: IntegrationsService, useValue: { getDecryptedCredentials: jest.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(TwilioWebhookController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('end-to-end: a validly signed "delivered" callback updates the matching Notification', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'notif-1', providerMessageId: 'SM123' });
    const body = { MessageSid: 'SM123', MessageStatus: 'delivered' };
    const signature = computeSignature(authToken, webhookUrl, body);

    await controller.status(body, signature, buildRequest(webhookUrl));

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { providerMessageId: 'SM123' } });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.DELIVERED, deliveredAt: expect.any(Date) },
    });
  });

  it('end-to-end: a tampered payload (signature no longer matches) is rejected before any DB write', async () => {
    const body = { MessageSid: 'SM123', MessageStatus: 'delivered' };
    const signature = computeSignature(authToken, webhookUrl, body);
    const tamperedBody = { ...body, MessageStatus: 'failed' }; // attacker flips the status after signing

    await expect(controller.status(tamperedBody, signature, buildRequest(webhookUrl))).rejects.toThrow();
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('end-to-end: a "failed" callback marks the notification FAILED', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'notif-2', providerMessageId: 'SM456' });
    const body = { MessageSid: 'SM456', MessageStatus: 'failed' };
    const signature = computeSignature(authToken, webhookUrl, body);

    await controller.status(body, signature, buildRequest(webhookUrl));

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-2' },
      data: { status: NotificationStatus.FAILED },
    });
  });
});
