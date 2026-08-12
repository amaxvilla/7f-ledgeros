import { PaymentStatus, RefundStatus } from './payment-provider.interface';

/**
 * Vendor-agnostic payment webhook abstraction (Release IE.1, Checkpoint
 * F — abstraction only).
 *
 * Same role PaymentProvider (payment-provider.interface.ts) plays for
 * outbound calls (initialize/verify/refund): every caller that needs to
 * process an inbound provider callback depends on this interface, never
 * on a concrete Paystack/Flutterwave/Stripe webhook class. Kept as a
 * SEPARATE interface from PaymentProvider rather than extra methods
 * bolted onto it, because the two run in different processes at
 * different times — PaymentProvider methods are called synchronously
 * from PaymentsService inside an authenticated request; a
 * PaymentWebhookHandler is called from an unauthenticated HTTP endpoint
 * a third party hits directly, the same split TwilioWebhookService
 * (sms/twilio-webhook.service.ts) keeps from TwilioSmsService.
 *
 * Deliberately scoped to ONLY the interface + its supporting types +
 * the registry concrete handlers will register into, mirroring
 * Checkpoints A+B. Nothing here is wired up yet — no controller/route,
 * no concrete provider's handler, no PaymentTransaction row is ever
 * updated by anything in this checkpoint. That wiring (a generic
 * POST /payments/webhook/:providerCode endpoint that resolves a handler
 * from PaymentWebhookHandlerRegistry, verifies the signature, parses the
 * event, and calls into PaymentsService) is a later checkpoint, the same
 * way Checkpoint A's PaymentProvider interface waited for Checkpoint D
 * to have a real caller.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - verifySignature takes the RAW request body, not a parsed object —
 *    every provider's signature scheme (Paystack: HMAC-SHA512 over the
 *    raw JSON string; Stripe: HMAC-SHA256 over "timestamp.rawBody";
 *    Twilio: HMAC-SHA1 over the URL + sorted form params, see
 *    sms/twilio-signature.util.ts) is defined over bytes exactly as sent
 *    on the wire. Re-serializing an already-parsed body before
 *    verifying is a common and subtle way to make signature checks pass
 *    when they shouldn't (whitespace/key-order differences change the
 *    bytes but not the parsed shape) — so this interface forces the raw
 *    form to be threaded all the way through.
 *  - parseEvent is only ever called AFTER verifySignature has returned
 *    true — same "verify, then trust" ordering
 *    TwilioWebhookController.status() already uses.
 *  - status uses the same PaymentStatus vocabulary PaymentProvider does
 *    (imported from payment-provider.interface.ts), not a second one —
 *    a webhook event is just an async, provider-initiated version of
 *    what verifyPayment() returns synchronously.
 *  - reference must be the same caller-supplied reference
 *    PaymentTransaction.reference stores, not a provider-internal id —
 *    whatever concrete handler is built later is responsible for
 *    mapping the provider's own transaction id back to it if the two
 *    differ, the same way TwilioWebhookService.applyStatusCallback()
 *    looks up by providerMessageId rather than assuming Twilio's id
 *    matches a local one.
 */

export interface PaymentWebhookEvent {
  /** The original caller-supplied reference — matches PaymentTransaction.reference. */
  reference: string;
  status: PaymentStatus;
  /** Integer, minor currency unit — present when the provider includes it on the event; not all callback types carry an amount (e.g. a pure "charge.dispute" event). */
  amount?: number;
  currency?: string;
  paidAt?: Date;
  providerReference?: string;
  /** The provider's full raw parsed payload, kept for audit/debugging — never re-serialized for signature checks (see interface docstring). */
  raw: Record<string, unknown>;
}

/**
 * Release IE.2, Checkpoint E — a webhook event about a refund's async
 * status (Paystack: `refund.processed`/`refund.failed`/`refund.pending`),
 * as distinct from a charge event above. Refunds and charges are
 * different Paystack resources with their own reference vocabularies —
 * refundReference matches PaymentRefund.refundReference, NOT
 * PaymentTransaction.reference — so this is a separate type rather than
 * overloading PaymentWebhookEvent.reference to sometimes mean one and
 * sometimes the other.
 */
export interface PaymentRefundWebhookEvent {
  /** Matches PaymentRefund.refundReference — the provider's own refund id, same value RefundPaymentResult.refundReference returned at initiation. */
  refundReference: string;
  status: RefundStatus;
  raw: Record<string, unknown>;
}

/**
 * Release IE.2, Checkpoint E — parseEvent's return type, widened from a
 * bare PaymentWebhookEvent to this discriminated union. Before this
 * checkpoint, any non-charge-shaped event (including every refund
 * event) had nowhere to go and PaystackWebhookHandler.parseEvent threw —
 * see that class's now-narrowed KNOWN LIMITATION note. PaymentWebhookEvent
 * itself is unchanged (no new field) — only parseEvent's return type and
 * PaymentWebhookController's dispatch after it needed to change to add
 * a second event shape.
 */
export type ParsedPaymentWebhookEvent =
  | { kind: 'charge'; event: PaymentWebhookEvent }
  | { kind: 'refund'; event: PaymentRefundWebhookEvent };

export interface PaymentWebhookHandler {
  /**
   * @param rawBody the exact bytes the provider sent, before any JSON parsing.
   * @param headers all request headers, lowercased-key (Express's default). Every
   *   provider signs differently — Paystack via `x-paystack-signature`, Stripe via
   *   `stripe-signature`, some via a signature header plus a separate timestamp
   *   header — so the handler is responsible for pulling whatever header(s) it
   *   needs out of this map itself, rather than the generic controller
   *   (payment-webhook.controller.ts) guessing a single header name for every
   *   provider. Missing header(s) this handler needs is just another way
   *   verification fails: return false, don't throw.
   */
  verifySignature(
    rawBody: string | Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<boolean> | boolean;

  /** Only ever called once verifySignature has returned true. */
  parseEvent(rawBody: string | Buffer): ParsedPaymentWebhookEvent;
}
