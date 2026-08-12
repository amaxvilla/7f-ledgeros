import { Injectable, Logger } from '@nestjs/common';
import { decryptIntegrationCredentials } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SendSmsParams {
  to: string;
  body: string;
}

export interface SendSmsResult {
  delivered: boolean;
  providerMessageId?: string;
}

interface ResolvedTwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Release ID Part 1 — SMS Integration (Twilio).
 *
 * Mirrors MailService's own resolution pattern exactly: resolves
 * credentials from an IntegrationProvider row (category SMS, providerCode
 * "TWILIO") when SMS_TWILIO_PROVIDER_ID is set, decrypting via
 * decryptIntegrationCredentials same as every other driver in this
 * codebase; falls back to raw TWILIO_* env vars for local/dev/test the
 * same way MailService falls back to SMTP_* — including the same
 * "log instead of send" no-op behavior when neither is configured, so
 * this never blocks a notification pipeline in an environment with no
 * SMS provider set up.
 *
 * Calls the Twilio REST API directly via fetch (Basic Auth,
 * form-urlencoded body) rather than adding the `twilio` npm SDK as a
 * dependency — the API surface needed here (POST one text message) is a
 * single well-documented endpoint, not worth a new dependency for.
 */
@Injectable()
export class TwilioSmsService {
  private readonly logger = new Logger(TwilioSmsService.name);
  private resolved: Promise<ResolvedTwilioConfig | null> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveConfig(): Promise<ResolvedTwilioConfig | null> {
    const providerId = process.env.SMS_TWILIO_PROVIDER_ID;
    if (providerId) {
      const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
      if (!provider) {
        this.logger.warn(`SMS_TWILIO_PROVIDER_ID=${providerId} does not match any integration_providers row — falling back to TWILIO_* env vars`);
      } else if (!provider.isActive) {
        this.logger.warn(`Integration provider ${providerId} (TWILIO) is inactive — falling back to TWILIO_* env vars`);
      } else {
        const config = (provider.config as Record<string, unknown> | null) ?? {};
        const credentials = provider.encryptedCredentials ? decryptIntegrationCredentials(provider.encryptedCredentials) : {};
        const accountSid = credentials.accountSid as string | undefined;
        const authToken = credentials.authToken as string | undefined;
        const fromNumber = config.fromNumber as string | undefined;
        if (accountSid && authToken && fromNumber) {
          return { accountSid, authToken, fromNumber };
        }
        this.logger.warn(`Integration provider ${providerId} (TWILIO) is missing required config/credentials — falling back to TWILIO_* env vars`);
      }
    }

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
      return null;
    }
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    };
  }

  async send(params: SendSmsParams): Promise<SendSmsResult> {
    if (!this.resolved) this.resolved = this.resolveConfig();
    const config = await this.resolved;

    if (!config) {
      // No SMS provider configured — expected for local dev/most test
      // environments. Log instead of failing so developers can see what
      // *would* have been sent, same convention as MailService's noop path.
      this.logger.log(`[sms:noop] to=${params.to} body="${params.body}"`);
      return { delivered: false };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const basicAuth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    const body = new URLSearchParams({ To: params.to, From: config.fromNumber, Body: params.body });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      throw new Error(`Twilio send failed: HTTP ${res.status}${json.message ? ` — ${json.message}` : ''}`);
    }

    this.logger.log(`[sms] sent to=${params.to} sid=${json.sid ?? 'unknown'}`);
    return { delivered: true, providerMessageId: json.sid };
  }
}
