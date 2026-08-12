import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { decryptIntegrationCredentials } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';
import { MicrosoftGraphMailService } from './microsoft-graph-mail.service';
import { GmailMailService } from './gmail-mail.service';

export interface SendMailParams {
  to: string[];
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromAddress: string;
}

/**
 * Release IC.1 — Email Integration (SMTP wiring).
 *
 * Resolves its SMTP config/credentials from an IntegrationProvider row
 * (category EMAIL, providerCode "SMTP") when EMAIL_SMTP_PROVIDER_ID is
 * set, exactly the pattern AwsS3StorageProvider established for Storage
 * (apps/api/src/storage/providers/aws-s3-storage.provider.ts) — reads
 * config.{host,port,secure} and decrypts credentials.{user,password} via
 * decryptIntegrationCredentials (see @7f/config's encryption.ts doc
 * comment for why this is a direct, in-process decrypt rather than an
 * HTTP call back into apps/api).
 *
 * Falls back to the original raw SMTP_HOST/PORT/SECURE/USER/PASSWORD env
 * vars when EMAIL_SMTP_PROVIDER_ID isn't set — this is deliberate, not
 * legacy debt: it's the same zero-config local/dev/test path this class
 * always had (getTransporter() returning null when nothing is
 * configured, logging instead of sending), now just one of two ways to
 * reach it rather than the only one.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resolvedFromAddress: string | null = null;
  private resolving: Promise<ResolvedSmtpConfig | null> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphMail?: MicrosoftGraphMailService,
    private readonly gmail?: GmailMailService,
  ) {}

  private async resolveConfig(): Promise<ResolvedSmtpConfig | null> {
    const providerId = process.env.EMAIL_SMTP_PROVIDER_ID;
    if (providerId) {
      const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
      if (!provider) {
        this.logger.warn(`EMAIL_SMTP_PROVIDER_ID=${providerId} does not match any integration_providers row — falling back to SMTP_* env vars`);
      } else if (!provider.isActive) {
        this.logger.warn(`Integration provider ${providerId} (SMTP) is inactive — falling back to SMTP_* env vars`);
      } else {
        const config = (provider.config as Record<string, unknown> | null) ?? {};
        const credentials = provider.encryptedCredentials ? decryptIntegrationCredentials(provider.encryptedCredentials) : {};
        const host = config.host as string | undefined;
        if (!host) {
          this.logger.warn(`Integration provider ${providerId} (SMTP) has no config.host — falling back to SMTP_* env vars`);
        } else {
          return {
            host,
            port: Number(config.port ?? 587),
            secure: Boolean(config.secure ?? false),
            user: credentials.user as string | undefined,
            password: credentials.password as string | undefined,
            fromAddress: (config.fromAddress as string | undefined) ?? 'no-reply@7fifteencapital.com',
          };
        }
      }
    }

    if (!process.env.SMTP_HOST) return null;
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@7fifteencapital.com',
    };
  }

  private async getTransporter(): Promise<Transporter | null> {
    if (this.transporter) return this.transporter;
    if (!this.resolving) this.resolving = this.resolveConfig();
    const resolved = await this.resolving;
    if (!resolved) return null;

    this.resolvedFromAddress = resolved.fromAddress;
    this.transporter = nodemailer.createTransport({
      host: resolved.host,
      port: resolved.port,
      secure: resolved.secure,
      auth: resolved.user ? { user: resolved.user, pass: resolved.password } : undefined,
    });
    return this.transporter;
  }

  async send(params: SendMailParams): Promise<{ delivered: boolean; messageId?: string }> {
    // Release IC.2 — Microsoft Graph Email Driver. A separate, cheap
    // lookup deliberately kept apart from resolveConfig()'s own
    // SMTP-shaped caching below, so that logic is not touched by this
    // branch at all. Falls through to the SMTP path (unchanged) for
    // every provider except 'MS_GRAPH_EMAIL', including when
    // EMAIL_SMTP_PROVIDER_ID isn't set at all.
    const providerId = process.env.EMAIL_SMTP_PROVIDER_ID;
    if (providerId && this.graphMail) {
      const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
      if (provider?.isActive && provider.providerCode === 'MS_GRAPH_EMAIL') {
        const config = (provider.config as Record<string, unknown> | null) ?? {};
        const credentials = provider.encryptedCredentials ? decryptIntegrationCredentials(provider.encryptedCredentials) : {};
        const tenantId = config.tenantId as string | undefined;
        const clientId = config.clientId as string | undefined;
        const senderUserId = config.senderUserId as string | undefined;
        const clientSecret = credentials.clientSecret as string | undefined;
        if (tenantId && clientId && senderUserId && clientSecret) {
          return this.graphMail.send(params, { tenantId, clientId, clientSecret, senderUserId });
        }
        this.logger.warn(`Integration provider ${providerId} (MS_GRAPH_EMAIL) is missing required config/credentials — falling back to SMTP path`);
      }
    }

    // Release IC.3 — Gmail API Driver. Same shape as the MS_GRAPH_EMAIL
    // branch immediately above (separate lookup, falls through to SMTP
    // on missing config), for 'GMAIL_EMAIL' instead.
    if (providerId && this.gmail) {
      const provider = await this.prisma.integrationProvider.findUnique({ where: { id: providerId } });
      if (provider?.isActive && provider.providerCode === 'GMAIL_EMAIL') {
        const config = (provider.config as Record<string, unknown> | null) ?? {};
        const credentials = provider.encryptedCredentials ? decryptIntegrationCredentials(provider.encryptedCredentials) : {};
        const clientId = config.clientId as string | undefined;
        const clientSecret = credentials.clientSecret as string | undefined;
        const refreshToken = credentials.refreshToken as string | undefined;
        if (clientId && clientSecret && refreshToken) {
          return this.gmail.send(params, { clientId, clientSecret, refreshToken });
        }
        this.logger.warn(`Integration provider ${providerId} (GMAIL_EMAIL) is missing required config/credentials — falling back to SMTP path`);
      }
    }

    const transporter = await this.getTransporter();

    if (!transporter) {
      // No SMTP configured — this is the expected state for local dev and most
      // test/staging environments. Log instead of silently dropping the email
      // so developers can see what *would* have been sent.
      this.logger.log(`[mail:noop] to=${params.to.join(',')} subject="${params.subject}"`);
      return { delivered: false };
    }

    const info = await transporter.sendMail({
      from: this.resolvedFromAddress ?? 'no-reply@7fifteencapital.com',
      to: params.to.join(','),
      cc: params.cc?.join(','),
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    return { delivered: true, messageId: info.messageId };
  }
}
