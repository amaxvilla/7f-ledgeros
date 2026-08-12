/**
 * Vendor-agnostic bank/open-banking webhook abstraction (Release IF.1,
 * Checkpoint G).
 *
 * Deliberately mirrors PaymentWebhookHandler (payments/payment-webhook-handler.interface.ts)
 * almost exactly, for the same reason that interface gives for itself:
 * a real bank-integration webhook handler needs injected dependencies
 * (IntegrationsService, to resolve its provider's own webhook secret),
 * so it has to register into a registry at runtime rather than being a
 * bare function — see BankWebhookHandlerRegistry.
 *
 * NOT folded into PaymentWebhookHandler itself, even though the shape is
 * nearly identical, because the two are keyed by different providerCode
 * vocabularies resolved from different registries at different routes
 * (`/payments/webhook/:providerCode` against PaymentWebhookHandlerRegistry
 * vs `/bank-integration/webhook/:providerCode` against this one) — a
 * bank provider and a payment provider could even share a providerCode
 * string coincidentally (they don't today: MONO vs PAYSTACK/FLUTTERWAVE)
 * without any ambiguity, since which registry a request resolves against
 * is fixed by which route it hit.
 *
 * Design notes for later checkpoints/providers to stay consistent with:
 *  - verifySignature takes the RAW request body — same reasoning
 *    PaymentWebhookHandler's own doc comment gives (re-serializing an
 *    already-parsed body before verifying is a common way to make a
 *    check pass when it shouldn't). NOTE: unlike every payment provider
 *    in this codebase, Mono's own scheme (see MonoWebhookHandler) is a
 *    plain shared-secret HEADER comparison, not an HMAC computed over
 *    the body — rawBody is still threaded through here so a future
 *    provider that DOES use body-HMAC (Okra, Stitch, ...) doesn't need
 *    the interface widened later.
 *  - parseEvent is only ever called AFTER verifySignature has returned
 *    true — identical ordering to PaymentWebhookHandler.
 *  - ParsedBankWebhookEvent is a discriminated union, same shape
 *    ParsedPaymentWebhookEvent uses for charge-vs-refund, so a handler
 *    that recognises a payload it has nothing useful to do with can
 *    return `{ kind: 'ignored', eventType }` rather than being forced to
 *    throw — data-sync-only notifications (Mono's own
 *    `account_updated`) are the first example; a throw is still correct
 *    for a payload the handler doesn't recognise AT ALL (see
 *    MonoWebhookHandler.parseEvent).
 */

/**
 * A linked account's consent/connection status changed at the provider's
 * end — the only event kind this checkpoint acts on. providerAccountId
 * is the PROVIDER's own account id (Mono's monoAccountId, not this
 * system's MonoLinkedAccount.id) — the same "provider's own id, caller
 * maps it back" convention PaymentWebhookEvent.reference documents for
 * payments.
 */
export interface BankLinkStatusWebhookEvent {
  providerAccountId: string;
  status: 'ACTIVE' | 'REQUIRES_REAUTH';
  raw: Record<string, unknown>;
}

export type ParsedBankWebhookEvent =
  | { kind: 'link_status'; event: BankLinkStatusWebhookEvent }
  | { kind: 'ignored'; eventType: string };

export interface BankWebhookHandler {
  /**
   * @param rawBody the exact bytes the provider sent, before any JSON parsing.
   * @param headers all request headers, lowercased-key (Express's default).
   */
  verifySignature(
    rawBody: string | Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<boolean> | boolean;

  /** Only ever called once verifySignature has returned true. */
  parseEvent(rawBody: string | Buffer): ParsedBankWebhookEvent;
}
