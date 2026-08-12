/**
 * Vendor-agnostic payment gateway abstraction (Release IE.1, Checkpoint
 * A — abstraction only).
 *
 * Same role StorageProvider (storage/storage.interface.ts) plays for
 * files and IntegrationProviderDriver (integrations/integration-provider-driver.interface.ts)
 * plays for health checks: every caller that needs to take a payment
 * depends on this interface, never on a concrete Paystack/Flutterwave/
 * Stripe class, so adding a new gateway later is a new provider class +
 * one registry entry, not a rewrite of every caller.
 *
 * Deliberately scoped to ONLY the interface + its supporting types.
 * Nothing here is wired up yet — no concrete provider, no registry, no
 * Prisma model, no controller/service, no queue/worker, no webhook
 * handling. Those are separate checkpoints (B through I) by design, so
 * this file has no other code depending on it yet and nothing to
 * meaningfully unit-test on its own (it's types + one const token).
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - amount is always the currency's minor unit (kobo/cents/etc.) as an
 *    integer, matching how Paystack/Flutterwave/Stripe all operate —
 *    never a float major-unit amount, to avoid rounding bugs.
 *  - reference is always caller-supplied and must be idempotent (the
 *    same reference passed twice should not create two charges) —
 *    Checkpoint C's Prisma model should enforce this with a unique
 *    constraint, not just document it here.
 *  - PaymentStatus below is a plain string union, not a Prisma enum,
 *    since no schema exists yet (Checkpoint C). Whichever checkpoint
 *    adds the Prisma enum should keep its values in sync with this one
 *    rather than inventing a second vocabulary.
 */

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'ABANDONED';
export type RefundStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface InitializePaymentParams {
  /** Caller-supplied, must be idempotent — see design notes above. */
  reference: string;
  /** Integer, minor currency unit (e.g. kobo, cents). */
  amount: number;
  /** ISO 4217 currency code, e.g. "NGN", "USD". */
  currency: string;
  customerEmail: string;
  description?: string;
  /** Where the provider should redirect the customer after a hosted checkout completes, if applicable. */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  reference: string;
  /** Hosted checkout page URL — set for redirect-based providers (e.g. Paystack, Flutterwave); undefined for a pure server-side charge flow. */
  authorizationUrl?: string;
  /** The provider's own transaction id/reference, if it assigns one distinct from `reference`. */
  providerReference?: string;
}

export interface VerifyPaymentResult {
  reference: string;
  status: PaymentStatus;
  /** Integer, minor currency unit — should match what was requested; a mismatch is the caller's signal to investigate, not something this interface resolves. */
  amount: number;
  currency: string;
  paidAt?: Date;
  providerReference?: string;
  /** The provider's full raw response, kept for audit/debugging — never parsed by callers, only stored. */
  raw?: Record<string, unknown>;
}

export interface RefundPaymentParams {
  /** The original payment's reference. */
  reference: string;
  /** Omit for a full refund. */
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  reference: string;
  refundReference: string;
  status: RefundStatus;
  amount: number;
}

export interface PaymentProvider {
  initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult>;
  /**
   * Release IE.2, Checkpoint G — Worker Integration (refund reconciliation).
   * The refund counterpart to verifyPayment: re-checks a refund's
   * CURRENT status with the provider directly, for the same reason
   * verifyPayment exists alongside webhook-driven updates — a webhook
   * can be missed/delayed, so a background job needs a synchronous way
   * to re-ask "what's this refund's status right now" rather than only
   * ever waiting on the next webhook delivery attempt.
   */
  verifyRefund(refundReference: string): Promise<RefundPaymentResult>;
}

/** DI token for the active payment provider — not yet bound anywhere (see Checkpoint B, Provider Registry). */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
