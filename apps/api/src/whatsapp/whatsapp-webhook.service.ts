import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { verifyMetaSignature } from './whatsapp-signature.util';

/** One entry in Meta's `entry[].changes[].value.statuses[]` array — the
 *  only part of the webhook payload this release processes (see the
 *  module doc comment on WhatsAppWebhookController for why incoming
 *  `messages[]` is out of scope). */
export interface WhatsAppStatusEntry {
  id?: string; // WhatsApp message id (wamid) — matches Notification.providerMessageId
  status?: string; // 'sent' | 'delivered' | 'read' | 'failed'
  timestamp?: string;
  recipient_id?: string;
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: WhatsAppStatusEntry[];
        messages?: unknown[];
      };
    }>;
  }>;
}

/** Meta status values that mean "will never be delivered from here" —
 *  mirrors FAILURE_STATUSES in twilio-webhook.service.ts. */
const FAILURE_STATUSES = new Set(['failed']);

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  /** Same dual resolution WhatsAppCloudService (apps/worker) and
   *  TwilioWebhookService use for their own credentials — a configured
   *  IntegrationProvider row (WHATSAPP_CLOUD_PROVIDER_ID) takes
   *  precedence, falling back to a raw env var for local/dev/test. The
   *  verify token lives in the provider's non-secret `config` (it is not
   *  a secret Meta requires encrypting — it is only ever compared to a
   *  value Meta echoes back), unlike the app secret below which lives in
   *  encryptedCredentials. */
  async resolveVerifyToken(): Promise<string | null> {
    const providerId = process.env.WHATSAPP_CLOUD_PROVIDER_ID;
    if (providerId) {
      const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
      const verifyToken = (provider?.config as Record<string, unknown> | null)?.verifyToken as string | undefined;
      if (verifyToken) return verifyToken;
      this.logger.warn(
        `WHATSAPP_CLOUD_PROVIDER_ID=${providerId} has no usable config.verifyToken — falling back to WHATSAPP_CLOUD_VERIFY_TOKEN env var`,
      );
    }
    return process.env.WHATSAPP_CLOUD_VERIFY_TOKEN ?? null;
  }

  /** appSecret is the WhatsApp Business App's secret used to HMAC-sign
   *  every webhook callback — distinct from the phone number's
   *  accessToken (used for sending, see whatsapp-cloud.service.ts) and
   *  stored alongside it in the same encrypted credentials blob. */
  async resolveAppSecret(): Promise<string | null> {
    const providerId = process.env.WHATSAPP_CLOUD_PROVIDER_ID;
    if (providerId) {
      const credentials = await this.integrations.getDecryptedCredentials(providerId).catch(() => null);
      const appSecret = credentials?.appSecret as string | undefined;
      if (appSecret) return appSecret;
      this.logger.warn(
        `WHATSAPP_CLOUD_PROVIDER_ID=${providerId} has no usable credentials.appSecret — falling back to WHATSAPP_CLOUD_APP_SECRET env var`,
      );
    }
    return process.env.WHATSAPP_CLOUD_APP_SECRET ?? null;
  }

  /** Meta's one-time subscription handshake (GET .../whatsapp/webhook):
   *  confirm hub.mode=subscribe and hub.verify_token matches the
   *  configured token. Fails closed (returns false) when no verify token
   *  is configured anywhere — same "safe default is reject" posture
   *  TwilioWebhookService.verifySignature uses for its own no-token case. */
  async verifyHandshake(mode: string | undefined, token: string | undefined): Promise<boolean> {
    if (mode !== 'subscribe') return false;
    const expected = await this.resolveVerifyToken();
    if (!expected) {
      this.logger.warn('No WhatsApp verify token configured (WHATSAPP_CLOUD_PROVIDER_ID config.verifyToken or WHATSAPP_CLOUD_VERIFY_TOKEN) — rejecting handshake');
      return false;
    }
    return token === expected;
  }

  /** Verifies X-Hub-Signature-256 on an incoming callback (POST
   *  .../whatsapp/webhook). Fails closed when no app secret is
   *  configured, same posture as the handshake above and as
   *  TwilioWebhookService.verifySignature. */
  async verifySignature(rawBody: Buffer | undefined, signature: string | undefined): Promise<boolean> {
    const appSecret = await this.resolveAppSecret();
    if (!appSecret) {
      this.logger.warn('No WhatsApp app secret configured (WHATSAPP_CLOUD_PROVIDER_ID credentials.appSecret or WHATSAPP_CLOUD_APP_SECRET) — rejecting webhook, cannot verify signature');
      return false;
    }
    return verifyMetaSignature(appSecret, rawBody, signature);
  }

  /** Applies every status entry found anywhere in the payload (Meta may
   *  batch several entries/changes per callback). Returns counts rather
   *  than a single matched flag (unlike TwilioWebhookService, which only
   *  ever carries one status per callback) since a single WhatsApp
   *  callback can report on several messages at once. */
  async applyCallback(payload: WhatsAppWebhookPayload): Promise<{ statuses: number; matched: number }> {
    const statuses: WhatsAppStatusEntry[] =
      payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.statuses ?? []) ?? []) ?? [];

    let matched = 0;
    for (const status of statuses) {
      if (await this.applyStatus(status)) matched++;
    }
    return { statuses: statuses.length, matched };
  }

  private async applyStatus(entry: WhatsAppStatusEntry): Promise<boolean> {
    if (!entry.id || !entry.status) {
      this.logger.warn('WhatsApp status entry missing id or status — ignoring');
      return false;
    }

    const notification = await this.prisma.notification.findFirst({
      where: { providerMessageId: entry.id },
    });
    if (!notification) {
      this.logger.warn(`No notification found for WhatsApp message id=${entry.id} (status=${entry.status})`);
      return false;
    }

    if (entry.status === 'delivered') {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() },
      });
    } else if (entry.status === 'read') {
      // Meta always sends 'delivered' before 'read', but backfill
      // deliveredAt defensively in case a 'delivered' callback was
      // dropped/arrived out of order — a read message was, necessarily,
      // also delivered.
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
          deliveredAt: notification.deliveredAt ?? new Date(),
        },
      });
    } else if (FAILURE_STATUSES.has(entry.status)) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED },
      });
    }
    // 'sent': already reflected as SENT by WhatsAppProcessor — nothing further to update.

    return true;
  }
}
