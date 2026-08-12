import { Injectable, Logger } from '@nestjs/common';
import { decryptIntegrationCredentials } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SendWhatsAppParams {
  to: string;
  body: string;
}

export interface SendWhatsAppResult {
  delivered: boolean;
  providerMessageId?: string;
}

interface ResolvedWhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
}

/**
 * Release ID.2 Part 1 — WhatsApp Cloud API.
 *
 * Mirrors TwilioSmsService's own resolution pattern exactly: resolves
 * credentials from an IntegrationProvider row (category WHATSAPP,
 * providerCode "WHATSAPP_CLOUD") when WHATSAPP_CLOUD_PROVIDER_ID is set,
 * decrypting via decryptIntegrationCredentials same as every other
 * driver in this codebase; falls back to raw WHATSAPP_CLOUD_* env vars
 * for local/dev/test the same way TwilioSmsService falls back to
 * TWILIO_* — including the same "log instead of send" no-op behavior
 * when neither is configured.
 *
 * Calls the Meta Graph API directly via fetch (Bearer token, JSON body)
 * rather than adding a WhatsApp/Meta SDK dependency — same "one
 * well-documented endpoint isn't worth a new dependency" call
 * TwilioSmsService's own doc comment makes.
 *
 * Sends a plain text message only (messaging_product: "whatsapp",
 * type: "text"). Template messages (required to *initiate* a
 * conversation outside WhatsApp's 24-hour customer-service window) and
 * incoming-message handling are both out of scope for Part 1 — see this
 * release's report for why they're deferred to Part 2.
 */
@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);
  private resolved: Promise<ResolvedWhatsAppConfig | null> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveConfig(): Promise<ResolvedWhatsAppConfig | null> {
    const providerId = process.env.WHATSAPP_CLOUD_PROVIDER_ID;
    if (providerId) {
      const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
      if (!provider) {
        this.logger.warn(`WHATSAPP_CLOUD_PROVIDER_ID=${providerId} does not match any integration_providers row — falling back to WHATSAPP_CLOUD_* env vars`);
      } else if (!provider.isActive) {
        this.logger.warn(`Integration provider ${providerId} (WHATSAPP_CLOUD) is inactive — falling back to WHATSAPP_CLOUD_* env vars`);
      } else {
        const config = (provider.config as Record<string, unknown> | null) ?? {};
        const credentials = provider.encryptedCredentials ? decryptIntegrationCredentials(provider.encryptedCredentials) : {};
        const accessToken = credentials.accessToken as string | undefined;
        const phoneNumberId = config.phoneNumberId as string | undefined;
        if (accessToken && phoneNumberId) {
          return { accessToken, phoneNumberId };
        }
        this.logger.warn(`Integration provider ${providerId} (WHATSAPP_CLOUD) is missing required config/credentials — falling back to WHATSAPP_CLOUD_* env vars`);
      }
    }

    if (!process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || !process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID) {
      return null;
    }
    return {
      accessToken: process.env.WHATSAPP_CLOUD_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
    };
  }

  async send(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
    if (!this.resolved) this.resolved = this.resolveConfig();
    const config = await this.resolved;

    if (!config) {
      // No WhatsApp provider configured — expected for local dev/most test
      // environments. Log instead of failing so developers can see what
      // *would* have been sent, same convention as TwilioSmsService's
      // no-op path.
      this.logger.log(`[whatsapp:noop] to=${params.to} body="${params.body}"`);
      return { delivered: false };
    }

    const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: params.to.replace(/^\+/, ''), // Graph API expects the number without a leading '+'
      type: 'text',
      text: { body: params.body },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(`WhatsApp Cloud send failed: HTTP ${res.status}${json.error?.message ? ` — ${json.error.message}` : ''}`);
    }

    const providerMessageId = json.messages?.[0]?.id;
    this.logger.log(`[whatsapp] sent to=${params.to} id=${providerMessageId ?? 'unknown'}`);
    return { delivered: true, providerMessageId };
  }
}
