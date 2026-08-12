import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PaymentWebhookHandlerRegistry } from '../payment-webhook-handler.registry';
import { ParsedPaymentWebhookEvent, PaymentWebhookHandler } from '../payment-webhook-handler.interface';
import { FLUTTERWAVE_PROVIDER_CODE, fromFlutterwaveMajorUnits, mapFlutterwaveStatus, mapFlutterwaveRefundStatus } from './flutterwave.provider';

interface FlutterwaveChargeWebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    [key: string]: unknown;
  };
}

/**
 * Release IE.3, Checkpoint H — Flutterwave's refund.* webhook shape.
 * data.id is the SAME refund id FlutterwaveProvider.refundPayment()
 * already returns as refundReference at initiation (and the same id
 * verifyRefund's GET /refunds/:id — Checkpoint G — polls by), same
 * "data.id matches what refundPayment already returned" relationship
 * PaystackRefundWebhookPayload's own doc comment describes for Paystack.
 */
interface FlutterwaveRefundWebhookPayload {
  event: string;
  data: {
    id: number;
    status: string;
    [key: string]: unknown;
  };
}

/**
 * Release IE.3, Checkpoint D — Flutterwave's PaymentWebhookHandler
 * (charge events). Release IE.3, Checkpoint H added refund-event
 * parsing below, the same "charge first, refund is its own later
 * checkpoint" split PaystackWebhookHandler's own D/E had.
 *
 * Registers into PaymentWebhookHandlerRegistry via onModuleInit(), same
 * pattern FlutterwaveProvider (flutterwave.provider.ts) and
 * PaystackWebhookHandler both use, for the identical reason: it needs
 * constructor-injected IntegrationsService.
 *
 * Signature scheme is genuinely different from Paystack's, not just a
 * different header name — Flutterwave does NOT sign the payload with
 * HMAC. Instead you configure a static "Secret Hash" string in the
 * Flutterwave dashboard, and every webhook request echoes that exact
 * string back verbatim in the `verif-hash` header; verification is a
 * constant-time string comparison against the configured value, not a
 * digest computation. Stored as credentials.webhookSecretHash on the
 * SAME IntegrationProvider row FlutterwaveProvider already reads
 * credentials.secretKey from (PAYMENT_FLUTTERWAVE_PROVIDER_ID) — it's a
 * second credential on the same gateway connection, not a separate
 * integration to configure.
 *
 * KNOWN LIMITATION (same honesty this codebase already gives Paystack's
 * own handler for its own, narrower version of the same limitation):
 * parseEvent only understands charge-shaped and refund-shaped events.
 * Flutterwave also sends transfer.*, subscription.*, and other event
 * types to the same configured webhook URL if enabled; this handler
 * throws on anything without the fields either shape needs rather than
 * silently ignoring it, which surfaces as a 500 to Flutterwave (who will
 * retry). Safe today because only charge and refund events are enabled
 * on the Flutterwave dashboard for this integration; general event-type
 * filtering is a real gap for whichever later checkpoint enables
 * additional Flutterwave event types.
 *
 * The refund.* event-name detection below is Flutterwave's documented
 * webhook naming convention for its refund lifecycle notifications —
 * mirrored after Paystack's own `event.startsWith('refund.')` dispatch
 * for the same reason: covers whichever specific refund.* variant
 * (completed/failed/pending-style) Flutterwave sends without this
 * handler needing to enumerate each one by name.
 */
@Injectable()
export class FlutterwaveWebhookHandler implements PaymentWebhookHandler, OnModuleInit {
  private readonly logger = new Logger(FlutterwaveWebhookHandler.name);
  private resolvedSecretHash: Promise<string> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: PaymentWebhookHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(FLUTTERWAVE_PROVIDER_CODE, this);
    this.logger.log(`Registered payment webhook handler "${FLUTTERWAVE_PROVIDER_CODE}"`);
  }

  async verifySignature(_rawBody: string | Buffer, headers: Record<string, string | undefined>): Promise<boolean> {
    const provided = headers['verif-hash'];
    if (!provided) return false;

    const expected = await this.getSecretHash();

    // A plain string comparison, not an HMAC digest — see the class doc
    // comment. Still done in constant time (via Buffer.from + timingSafeEqual)
    // rather than `===`, the same defensive habit every other signature
    // check in this codebase (Paystack, Twilio, WhatsApp) uses, even
    // though a shared-secret string is a lower-value timing-attack target
    // than an HMAC key.
    const expectedBuf = Buffer.from(expected, 'utf-8');
    const providedBuf = Buffer.from(provided, 'utf-8');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  parseEvent(rawBody: string | Buffer): ParsedPaymentWebhookEvent {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    const payload = JSON.parse(text) as { event: string; data?: Record<string, unknown> };

    if (payload.event?.startsWith('refund.')) {
      return { kind: 'refund', event: this.parseRefundEvent(payload as FlutterwaveRefundWebhookPayload) };
    }
    // Default to charge parsing — same "anything not explicitly refund.*
    // falls through to charge parsing, including truly unsupported event
    // types" posture PaystackWebhookHandler.parseEvent uses, per the
    // class doc comment's KNOWN LIMITATION note.
    return { kind: 'charge', event: this.parseChargeEvent(payload as FlutterwaveChargeWebhookPayload) };
  }

  private parseChargeEvent(payload: FlutterwaveChargeWebhookPayload) {
    if (!payload.data?.tx_ref || !payload.data?.status) {
      // See the class doc comment's KNOWN LIMITATION note.
      throw new Error(
        `Flutterwave webhook event "${payload.event}" has no data.tx_ref/data.status — only charge- and refund-shaped events are supported by this handler yet`,
      );
    }

    const status = mapFlutterwaveStatus(payload.data.status);
    return {
      reference: payload.data.tx_ref,
      status,
      amount: fromFlutterwaveMajorUnits(payload.data.amount),
      currency: payload.data.currency,
      paidAt: status === 'SUCCESSFUL' && payload.data.created_at ? new Date(payload.data.created_at) : undefined,
      providerReference: String(payload.data.id),
      raw: payload.data as unknown as Record<string, unknown>,
    };
  }

  /** Release IE.3, Checkpoint H. data.id matches the refundReference FlutterwaveProvider.refundPayment() returned at initiation — see FlutterwaveRefundWebhookPayload's doc comment. */
  private parseRefundEvent(payload: FlutterwaveRefundWebhookPayload) {
    if (payload.data?.id === undefined || !payload.data?.status) {
      throw new Error(`Flutterwave webhook event "${payload.event}" has no data.id/data.status — cannot match it to a PaymentRefund`);
    }

    return {
      refundReference: String(payload.data.id),
      status: mapFlutterwaveRefundStatus(payload.data.status),
      raw: payload.data as unknown as Record<string, unknown>,
    };
  }

  private async getSecretHash(): Promise<string> {
    if (!this.resolvedSecretHash) {
      this.resolvedSecretHash = this.resolveSecretHash();
    }
    return this.resolvedSecretHash;
  }

  private async resolveSecretHash(): Promise<string> {
    const providerId = process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'PAYMENT_FLUTTERWAVE_PROVIDER_ID is not set — FlutterwaveWebhookHandler needs the same IntegrationProvider FlutterwaveProvider uses.',
      );
    }
    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const webhookSecretHash = credentials?.webhookSecretHash as string | undefined;
    if (!webhookSecretHash) {
      throw new Error(
        `Integration provider ${providerId} is missing credentials.webhookSecretHash — set it to the same "Secret Hash" value configured in the Flutterwave dashboard's webhook settings.`,
      );
    }
    return webhookSecretHash;
  }
}
