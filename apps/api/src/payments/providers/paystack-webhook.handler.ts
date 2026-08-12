import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PaymentWebhookHandlerRegistry } from '../payment-webhook-handler.registry';
import { ParsedPaymentWebhookEvent, PaymentWebhookHandler } from '../payment-webhook-handler.interface';
import { PAYSTACK_PROVIDER_CODE, mapPaystackStatus, mapPaystackRefundStatus } from './paystack.provider';

interface PaystackChargeWebhookPayload {
  event: string;
  data: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    [key: string]: unknown;
  };
}

/** Paystack's refund.* webhook shape — data.id is the SAME refund id PaystackProvider.refundPayment() returned as refundReference at initiation. */
interface PaystackRefundWebhookPayload {
  event: string;
  data: {
    id: number;
    status: string;
    [key: string]: unknown;
  };
}

/**
 * Release IE.2, Checkpoint D — Paystack's PaymentWebhookHandler.
 *
 * Registers into PaymentWebhookHandlerRegistry via onModuleInit(), the
 * same pattern PaystackProvider (paystack.provider.ts) uses to register
 * into PaymentProviderRegistry, and for the identical reason: it needs
 * constructor-injected IntegrationsService to resolve its credentials,
 * which rules out a module-load-time static object (see
 * PaymentWebhookHandlerRegistry's own doc comment).
 *
 * Signature scheme (Paystack's documented convention): HMAC-SHA512 over
 * the raw request body, keyed with the SAME secret key
 * PaystackProvider uses for outbound calls — Paystack does not issue a
 * separate webhook-signing secret the way Meta/WhatsApp does (see
 * whatsapp-signature.util.ts) — compared against the
 * `x-paystack-signature` header. Resolved via the identical
 * PAYMENT_PAYSTACK_PROVIDER_ID env var PaystackProvider reads, since
 * it's genuinely the same credential, not a second one to configure.
 *
 * KNOWN LIMITATION, flagged rather than silently handled: parseEvent
 * only understands charge-shaped events (`charge.success` / `charge.failed`
 * / similar) and refund-shaped events (`refund.processed` / `refund.failed`
 * / `refund.pending` — added Checkpoint E). Paystack sends other event
 * types (transfer.*, subscription.*, dispute.*, etc.) to the same webhook
 * URL if they're enabled for the account; this handler will throw on those
 * rather than silently ignoring them, which surfaces as a 500 to Paystack
 * (who will retry). For now this is safe because only charge and refund
 * events are needed for this repo's PaymentTransaction/PaymentRefund sync
 * and nothing else is configured on the Paystack dashboard for this
 * endpoint — but general event-type filtering (return null / a "not
 * applicable" result instead of throwing) is a real gap for whichever
 * later checkpoint enables additional Paystack event types.
 */
@Injectable()
export class PaystackWebhookHandler implements PaymentWebhookHandler, OnModuleInit {
  private readonly logger = new Logger(PaystackWebhookHandler.name);
  private resolvedSecret: Promise<string> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: PaymentWebhookHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(PAYSTACK_PROVIDER_CODE, this);
    this.logger.log(`Registered payment webhook handler "${PAYSTACK_PROVIDER_CODE}"`);
  }

  async verifySignature(rawBody: string | Buffer, headers: Record<string, string | undefined>): Promise<boolean> {
    const signature = headers['x-paystack-signature'];
    if (!signature) return false;

    const secretKey = await this.getSecretKey();
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');
    const expectedHex = crypto.createHmac('sha512', secretKey).update(bodyBuffer).digest('hex');

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const providedBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  parseEvent(rawBody: string | Buffer): ParsedPaymentWebhookEvent {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    const parsed = JSON.parse(text) as { event: string; data?: Record<string, unknown> };

    if (parsed.event?.startsWith('refund.')) {
      return { kind: 'refund', event: this.parseRefundEvent(parsed as PaystackRefundWebhookPayload) };
    }
    // Default to charge parsing for backward compatibility with any
    // event.startsWith('charge.') payload — and, same as before this
    // checkpoint, for anything else too (see KNOWN LIMITATION above),
    // since narrowing that further is out of scope for this checkpoint.
    return { kind: 'charge', event: this.parseChargeEvent(parsed as PaystackChargeWebhookPayload) };
  }

  private parseChargeEvent(payload: PaystackChargeWebhookPayload) {
    if (!payload.data?.reference || !payload.data?.status) {
      // See the class doc comment's KNOWN LIMITATION note — a non-charge,
      // non-refund event reaching this branch is the scenario this throw covers.
      throw new Error(
        `Paystack webhook event "${payload.event}" has no data.reference/data.status — only charge- and refund-shaped events are supported by this handler yet`,
      );
    }

    return {
      reference: payload.data.reference,
      status: mapPaystackStatus(payload.data.status),
      amount: payload.data.amount,
      currency: payload.data.currency,
      paidAt: payload.data.paid_at ? new Date(payload.data.paid_at) : undefined,
      providerReference: String(payload.data.id),
      raw: payload.data as unknown as Record<string, unknown>,
    };
  }

  /** Release IE.2, Checkpoint E. data.id matches the refundReference PaystackProvider.refundPayment() returned at initiation — see PaystackRefundWebhookPayload's doc comment. */
  private parseRefundEvent(payload: PaystackRefundWebhookPayload) {
    if (payload.data?.id === undefined || !payload.data?.status) {
      throw new Error(`Paystack webhook event "${payload.event}" has no data.id/data.status — cannot match it to a PaymentRefund`);
    }

    return {
      refundReference: String(payload.data.id),
      status: mapPaystackRefundStatus(payload.data.status),
      raw: payload.data as unknown as Record<string, unknown>,
    };
  }

  private async getSecretKey(): Promise<string> {
    if (!this.resolvedSecret) {
      this.resolvedSecret = this.resolveSecretKey();
    }
    return this.resolvedSecret;
  }

  private async resolveSecretKey(): Promise<string> {
    const providerId = process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'PAYMENT_PAYSTACK_PROVIDER_ID is not set — PaystackWebhookHandler needs the same IntegrationProvider credentials PaystackProvider uses.',
      );
    }
    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const secretKey = credentials?.secretKey as string | undefined;
    if (!secretKey) {
      throw new Error(`Integration provider ${providerId} is missing credentials.secretKey`);
    }
    return secretKey;
  }
}
