import { Injectable, Logger } from '@nestjs/common';
import { acquireGoogleAccessToken } from '@7f/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MailComposer = require('nodemailer/lib/mail-composer');
import type { SendMailParams } from './mail.service';

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Release IC.3 — Gmail API Driver.
 *
 * Sibling to MailService's nodemailer-SMTP path and
 * MicrosoftGraphMailService, not a replacement for either — MailService.send()
 * delegates here only when the resolved IntegrationProvider's
 * providerCode is 'GMAIL_EMAIL'.
 *
 * Gmail's API takes a base64url-encoded raw RFC 2822 MIME message
 * rather than a JSON body like Graph's sendMail — reuses nodemailer's
 * own MailComposer (already an installed dependency via nodemailer
 * itself, see mail.service.ts) to build that MIME message instead of
 * hand-rolling multipart/alternative encoding here.
 *
 * Token caching mirrors MicrosoftGraphMailService exactly: cached in
 * memory, re-acquired conservatively before real expiry rather than
 * once per send.
 */
@Injectable()
export class GmailMailService {
  private readonly logger = new Logger(GmailMailService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  async send(params: SendMailParams, config: GmailConfig): Promise<{ delivered: boolean; messageId?: string }> {
    const accessToken = await this.getToken(config);
    const raw = await this.buildRawMessage(params);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gmail messages.send failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }

    const json = (await res.json()) as { id?: string };
    this.logger.log(`[gmail-mail] sent to=${params.to.join(',')} subject="${params.subject}"`);
    return { delivered: true, messageId: json.id };
  }

  private async buildRawMessage(params: SendMailParams): Promise<string> {
    const mail = new MailComposer({
      to: params.to.join(','),
      cc: params.cc?.join(','),
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    const message: Buffer = await new Promise((resolve, reject) => {
      mail.compile().build((err: Error | null, msg: Buffer) => (err ? reject(err) : resolve(msg)));
    });
    return message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async getToken(config: GmailConfig): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }
    const value = await acquireGoogleAccessToken(config.clientId, config.clientSecret, config.refreshToken);
    // Google access tokens are typically valid ~60 minutes; cache
    // conservatively for 50, same margin MicrosoftGraphMailService uses.
    this.cachedToken = { value, expiresAt: Date.now() + 50 * 60_000 };
    return value;
  }
}
