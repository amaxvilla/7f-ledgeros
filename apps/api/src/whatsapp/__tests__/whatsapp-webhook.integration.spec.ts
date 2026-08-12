import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { NotificationStatus } from '@prisma/client';
import { WhatsAppWebhookController } from '../whatsapp-webhook.controller';
import { WhatsAppWebhookService } from '../whatsapp-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from '../../integrations/integrations.service';

/**
 * Same convention as sms/__tests__/sms.integration.spec.ts: no
 * e2e/supertest harness exists anywhere in this repo, so this wires the
 * REAL controller, REAL service, and REAL crypto-based signature
 * verification together (only PrismaService and IntegrationsService are
 * mocked, at the repository boundary) to exercise the actual request
 * path rather than each piece in isolation.
 */
function computeSignature(appSecret: string, rawBody: Buffer): string {
  const hex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return `sha256=${hex}`;
}

function buildRequest(rawBody: Buffer) {
  return { rawBody } as any;
}

describe('WhatsApp webhook integration (controller + service + real signature verification)', () => {
  const appSecret = 'integration-test-app-secret';
  let controller: WhatsAppWebhookController;
  let prisma: {
    integrationProvider: { findUnique: jest.Mock };
    notification: { findFirst: jest.Mock; update: jest.Mock };
  };
  const originalEnv = process.env;

  beforeEach(async () => {
    prisma = {
      integrationProvider: { findUnique: jest.fn() },
      notification: { findFirst: jest.fn(), update: jest.fn() },
    };
    process.env = { ...originalEnv, WHATSAPP_CLOUD_APP_SECRET: appSecret, WHATSAPP_CLOUD_VERIFY_TOKEN: 'verify-me' };
    delete process.env.WHATSAPP_CLOUD_PROVIDER_ID;

    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsAppWebhookController],
      providers: [
        WhatsAppWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: IntegrationsService, useValue: { getDecryptedCredentials: jest.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(WhatsAppWebhookController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('end-to-end: the subscription handshake returns the challenge for a matching verify token', async () => {
    const result = await controller.verify('subscribe', 'verify-me', 'challenge-xyz');
    expect(result).toBe('challenge-xyz');
  });

  it('end-to-end: the subscription handshake is rejected for a non-matching verify token', async () => {
    await expect(controller.verify('subscribe', 'wrong-token', 'challenge-xyz')).rejects.toThrow();
  });

  it('end-to-end: a validly signed "delivered" callback updates the matching Notification', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'notif-1', deliveredAt: null });
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'delivered' }] } }] }],
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = computeSignature(appSecret, rawBody);

    await controller.callback(payload, signature, buildRequest(rawBody));

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { providerMessageId: 'wamid.123' } });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: NotificationStatus.DELIVERED, deliveredAt: expect.any(Date) },
    });
  });

  it('end-to-end: a tampered payload (signature no longer matches) is rejected before any DB write', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'delivered' }] } }] }],
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = computeSignature(appSecret, rawBody);
    const tamperedBody = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'failed' }] } }] }],
      }),
    );

    await expect(controller.callback(JSON.parse(tamperedBody.toString()), signature, buildRequest(tamperedBody))).rejects.toThrow();
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('end-to-end: a "read" callback marks the notification READ', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'notif-2', deliveredAt: null });
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.456', status: 'read' }] } }] }],
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = computeSignature(appSecret, rawBody);

    await controller.callback(payload, signature, buildRequest(rawBody));

    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-2' },
      data: { status: NotificationStatus.READ, readAt: expect.any(Date), deliveredAt: expect.any(Date) },
    });
  });
});
