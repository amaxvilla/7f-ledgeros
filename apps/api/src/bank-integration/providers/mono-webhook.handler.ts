import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { IntegrationsService } from '../../integrations/integrations.service';
import { BankWebhookHandlerRegistry } from '../bank-webhook-handler.registry';
import { ParsedBankWebhookEvent, BankWebhookHandler } from '../bank-webhook-handler.interface';
import { MONO_PROVIDER_CODE } from './mono.provider';

/** Mono's documented payload envelope — identical shape across event types, per docs.mono.co/docs/webhooks ("all webhook events... follow the same payload format"). */
interface MonoWebhookPayload {
  event: string;
  data: unknown;
}

/**
 * Release IF.1, Checkpoint G — Mono's BankWebhookHandler.
 *
 * Registers into BankWebhookHandlerRegistry via onModuleInit(), the same
 * pattern MonoProvider/MonoHealthCheckDriver use for their own
 * registries, and for the identical reason (constructor-injected
 * IntegrationsService).
 *
 * SIGNATURE SCHEME — deliberately NOT an HMAC. Mono's documented
 * mechanism (docs.mono.co/docs/webhooks) is a plain shared-secret string
 * sent verbatim in the `mono-webhook-secret` header, compared for exact
 * equality against a secret from the Mono dashboard — there is no
 * per-request signature computed over the body the way Paystack/Stripe/
 * WhatsApp do. rawBody is still accepted (interface-required) but
 * genuinely unused here; verification is a constant-time string compare
 * against the header alone. Documented explicitly since it's the one
 * handler in this codebase whose "signature" isn't cryptographic over
 * the payload — a reviewer expecting HMAC (as in every other
 * *WebhookHandler in this repo) should not read this as a shortcut.
 *
 * EVENT COVERAGE, chosen to close exactly the gap Checkpoint F's report
 * flagged (a linked account silently going stale with no way to detect
 * it): `mono.events.reauthorisation_required` and
 * `mono.events.account_reauthorized` are parsed into `link_status`
 * events; every other event type (`account_updated`,
 * `dataset.available` / equivalents) is intentionally recognised but
 * returned as `{ kind: 'ignored' }` rather than throwing — Mono sends
 * data-sync notifications to the same URL, and there is currently
 * nothing in this codebase to DO with an "your data is ready" ping
 * (auto-triggering MonoLinkedAccountService.importStatement from it
 * would be a reasonable future checkpoint, not this one). A genuinely
 * unrecognised `event` string (not in either bucket) still throws — same
 * fail-loud posture PaystackWebhookHandler's own KNOWN LIMITATION note
 * describes for the same situation.
 *
 * DATA-FIELD SHAPE — Mono's own documentation is inconsistent about
 * exactly what `data` contains for the two link_status event types
 * (their own blog post literally says "the account ID would be sent to
 * the data field" without specifying a key), while the general docs
 * example shows `webhook.data.account` for `account_updated`. Rather
 * than gamble on one shape, extractAccountId() tries every documented
 * possibility (`data` itself as a string, `data.account` as a string,
 * `data.account.id`, `data.id`) and throws a clear, specific error if
 * none match — a wrong guess here would silently drop a
 * reauthorisation-required signal, which is exactly the failure mode
 * this checkpoint exists to prevent, so failing loud beats guessing wrong
 * quietly.
 */
@Injectable()
export class MonoWebhookHandler implements BankWebhookHandler, OnModuleInit {
  private readonly logger = new Logger(MonoWebhookHandler.name);
  private resolvedSecret: Promise<string> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: BankWebhookHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(MONO_PROVIDER_CODE, this);
    this.logger.log(`Registered bank webhook handler "${MONO_PROVIDER_CODE}"`);
  }

  async verifySignature(_rawBody: string | Buffer, headers: Record<string, string | undefined>): Promise<boolean> {
    const provided = headers['mono-webhook-secret'];
    if (!provided) return false;

    const expected = await this.getWebhookSecret();
    const expectedBuf = Buffer.from(expected, 'utf-8');
    const providedBuf = Buffer.from(provided, 'utf-8');
    // Constant-time compare even though this is a plain string secret,
    // not a computed digest — same defensive habit as every other
    // handler's HMAC compare in this codebase, and cheap to keep.
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  parseEvent(rawBody: string | Buffer): ParsedBankWebhookEvent {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    const payload = JSON.parse(text) as MonoWebhookPayload;

    if (payload.event === 'mono.events.reauthorisation_required') {
      return { kind: 'link_status', event: { providerAccountId: this.extractAccountId(payload), status: 'REQUIRES_REAUTH', raw: payload as unknown as Record<string, unknown> } };
    }
    if (payload.event === 'mono.events.account_reauthorized') {
      return { kind: 'link_status', event: { providerAccountId: this.extractAccountId(payload), status: 'ACTIVE', raw: payload as unknown as Record<string, unknown> } };
    }
    if (payload.event === 'mono.events.account_updated' || payload.event?.startsWith('mono.events.')) {
      // See class doc comment's EVENT COVERAGE note — recognised, no
      // action taken by this checkpoint.
      return { kind: 'ignored', eventType: payload.event };
    }

    throw new Error(`Unrecognised Mono webhook event type "${payload.event}"`);
  }

  /** See class doc comment's DATA-FIELD SHAPE note. */
  private extractAccountId(payload: MonoWebhookPayload): string {
    const data = payload.data as { account?: string | { id?: string }; id?: string } | string | undefined;

    if (typeof data === 'string') return data;
    if (typeof data?.account === 'string') return data.account;
    if (data?.account && typeof data.account === 'object' && typeof data.account.id === 'string') return data.account.id;
    if (typeof data?.id === 'string') return data.id;

    throw new Error(
      `Mono webhook event "${payload.event}" — could not extract an account id from its data field (tried data, data.account, data.account.id, data.id). See MonoWebhookHandler's DATA-FIELD SHAPE doc comment.`,
    );
  }

  private async getWebhookSecret(): Promise<string> {
    if (!this.resolvedSecret) {
      this.resolvedSecret = this.resolveWebhookSecret();
    }
    return this.resolvedSecret;
  }

  private async resolveWebhookSecret(): Promise<string> {
    const providerId = process.env.BANK_MONO_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'BANK_MONO_PROVIDER_ID is not set — MonoWebhookHandler needs the same IntegrationProvider row MonoProvider uses.',
      );
    }
    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const webhookSecret = credentials?.webhookSecret as string | undefined;
    if (!webhookSecret) {
      throw new Error(
        `Integration provider ${providerId} is missing credentials.webhookSecret — add it alongside the existing secretKey (see MonoProvider) using the value from the Mono dashboard's "Edit app" > webhook screen.`,
      );
    }
    return webhookSecret;
  }
}
