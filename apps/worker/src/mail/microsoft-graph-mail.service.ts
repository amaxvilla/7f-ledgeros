import { Injectable, Logger } from '@nestjs/common';
import { acquireMicrosoftGraphToken } from '@7f/config';
import type { SendMailParams } from './mail.service';

export interface GraphSmtpConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderUserId: string;
}

/**
 * Release IC.2 — Microsoft Graph Email Driver.
 *
 * Sibling to MailService's nodemailer path, not a replacement for it —
 * MailService.send() delegates here only when the resolved
 * IntegrationProvider's providerCode is 'MS_GRAPH_EMAIL'; the SMTP path
 * is completely untouched otherwise (see MailService's doc comment on
 * that branch).
 *
 * Caches the acquired token in memory until ~60s before its stated
 * expiry rather than acquiring a fresh one on every single email send —
 * app-only Graph tokens are typically valid ~60-90 minutes, so this
 * meaningfully cuts down on token-endpoint calls under any real send
 * volume.
 */
@Injectable()
export class MicrosoftGraphMailService {
  private readonly logger = new Logger(MicrosoftGraphMailService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  async send(params: SendMailParams, config: GraphSmtpConfig): Promise<{ delivered: boolean; messageId?: string }> {
    const accessToken = await this.getToken(config);

    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.senderUserId)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: {
            contentType: params.html ? 'HTML' : 'Text',
            content: params.html ?? params.text ?? '',
          },
          toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
          ccRecipients: params.cc?.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Microsoft Graph sendMail failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }

    // Graph's sendMail returns 202 Accepted with an empty body — there is
    // no messageId to report back (unlike nodemailer's SMTP response).
    this.logger.log(`[graph-mail] sent to=${params.to.join(',')} subject="${params.subject}"`);
    return { delivered: true };
  }

  private async getToken(config: GraphSmtpConfig): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }
    const value = await acquireMicrosoftGraphToken(config.tenantId, config.clientId, config.clientSecret);
    // Graph doesn't return expires_in through this thin wrapper's return
    // type, so cache conservatively for 50 minutes — well inside any
    // real token's ~60-90 minute lifetime, re-acquired early rather than
    // risking a send failing mid-lifetime.
    this.cachedToken = { value, expiresAt: Date.now() + 50 * 60_000 };
    return value;
  }
}
