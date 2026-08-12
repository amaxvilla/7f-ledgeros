import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PaymentProviderRegistry } from '../payment-provider.registry';
import {
  InitializePaymentParams,
  InitializePaymentResult,
  PaymentProvider,
  PaymentStatus,
  RefundPaymentParams,
  RefundPaymentResult,
  RefundStatus,
  VerifyPaymentResult,
} from '../payment-provider.interface';

export const FLUTTERWAVE_PROVIDER_CODE = 'FLUTTERWAVE';
export const FLUTTERWAVE_API_BASE_URL = 'https://api.flutterwave.com/v3';

interface ResolvedFlutterwaveConfig {
  secretKey: string;
}

/**
 * Flutterwave's own API expects `amount` in the currency's MAJOR unit
 * (e.g. 5000.00 for ₦5,000) — unlike Paystack, which (like this
 * framework's own convention — see payment-provider.interface.ts's
 * design notes) takes the minor unit directly. Every method that talks
 * to Flutterwave converts at the boundary so nothing outside this file
 * ever has to know Flutterwave is the odd one out. Assumes a 2-decimal
 * currency (kobo/cents-style, i.e. divide/multiply by 100) — correct
 * for NGN/USD/GHS/KES and every other currency this codebase currently
 * handles; a 0-decimal or 3-decimal currency would need a per-currency
 * divisor here instead of a flat 100, which is a real gap if one is
 * ever added, not something the current implementation resolves.
 */
function toFlutterwaveMajorUnits(minorUnitAmount: number): number {
  return minorUnitAmount / 100;
}

export function fromFlutterwaveMajorUnits(majorUnitAmount: number): number {
  return Math.round(majorUnitAmount * 100);
}

interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data?: {
    link: string;
  };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    [key: string]: unknown;
  };
}

/** Release IE.3, Checkpoint F. POST /transactions/:id/refund's response shape. */
interface FlutterwaveRefundResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    amount_refunded: number;
    status: string;
    [key: string]: unknown;
  };
}

/**
 * Release IE.3, Checkpoint G. GET /refunds/:id's response shape —
 * structurally identical to FlutterwaveRefundResponse above (both wrap
 * the same refund-resource fields), kept as its own named type anyway
 * so a future divergence between the "create" and "fetch" response
 * shapes doesn't silently affect both call sites at once.
 */
type FlutterwaveRefundStatusResponse = FlutterwaveRefundResponse;

/**
 * Release IE.3, Checkpoint C. Flutterwave's own transaction-status
 * vocabulary — distinct from PaymentStatus's own union and from
 * Paystack's ('success'/'abandoned'/'failed'/'reversed') vocabulary, so
 * this mapping is deliberately its own function rather than reused from
 * mapPaystackStatus, matching the same "don't let one gateway's status
 * strings leak past its own file" boundary that file's own mapping
 * respects. Unrecognized values default to PENDING for the same reason
 * mapPaystackStatus does: an in-progress/unknown state should never be
 * mistaken for a definitive SUCCESSFUL or FAILED outcome.
 */
export function mapFlutterwaveStatus(flutterwaveStatus: string): PaymentStatus {
  switch (flutterwaveStatus) {
    case 'successful':
      return 'SUCCESSFUL';
    case 'failed':
      return 'FAILED';
    case 'pending':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

/**
 * Release IE.3, Checkpoint F. Flutterwave's refund-status vocabulary is
 * its own, distinct from mapFlutterwaveStatus's charge-status vocabulary
 * above (a refund's "completed" is not the same word as a charge's
 * "successful") and from mapPaystackRefundStatus's own vocabulary
 * ('processed'/'failed') — same "don't let one gateway's/one
 * resource-type's status strings leak past its own mapping" boundary
 * mapFlutterwaveStatus's own doc comment already keeps.
 */
export function mapFlutterwaveRefundStatus(flutterwaveRefundStatus: string): RefundStatus {
  switch (flutterwaveRefundStatus) {
    case 'completed':
      return 'SUCCESSFUL';
    case 'failed':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

/**
 * Release IE.3, Checkpoint A — Flutterwave Provider (skeleton).
 * Release IE.3, Checkpoint B added initializePayment.
 * Release IE.3, Checkpoint C added verifyPayment.
 * Release IE.3, Checkpoint F added refundPayment.
 * Release IE.3, Checkpoint G added verifyRefund — every PaymentProvider
 * method is now implemented for Flutterwave.
 *
 * Deliberately mirrors PaystackProvider's own Checkpoint A exactly, down
 * to the doc comment structure: registration into PaymentProviderRegistry,
 * config resolution off an IntegrationProvider row via IntegrationsService
 * (category PAYMENT, providerCode "FLUTTERWAVE" — PAYMENT_FLUTTERWAVE_PROVIDER_ID
 * env points at that row's id, same pattern, no new credential-storage
 * mechanism), and a health-check driver in the sibling file.
 *
 * Registers itself into PaymentProviderRegistry via onModuleInit() for
 * the identical reason PaystackProvider does — needs constructor-injected
 * IntegrationsService, which only exists once Nest's DI container has
 * constructed it.
 */
@Injectable()
export class FlutterwaveProvider implements PaymentProvider, OnModuleInit {
  private readonly logger = new Logger(FlutterwaveProvider.name);
  private resolved: Promise<ResolvedFlutterwaveConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(FLUTTERWAVE_PROVIDER_CODE, this);
    this.logger.log(`Registered payment provider "${FLUTTERWAVE_PROVIDER_CODE}"`);
  }

  /**
   * Release IE.3, Checkpoint B. Calls Flutterwave's POST /payments (the
   * "Standard" hosted-checkout flow — same category of flow as
   * PaystackProvider.initializePayment's POST /transaction/initialize).
   *
   * Two things Flutterwave does differently from Paystack here, both
   * handled at this boundary rather than leaking into callers:
   *  - amount must be converted to major units — see
   *    toFlutterwaveMajorUnits's doc comment.
   *  - Flutterwave's tx_ref is the SAME caller-supplied `reference` this
   *    framework already uses everywhere (no separate access_code-style
   *    field the way Paystack returns one) — Flutterwave doesn't assign
   *    its own distinct transaction id until the payment actually
   *    completes, which is why providerReference is left undefined here
   *    (matches InitializePaymentResult.providerReference's own "if it
   *    assigns one distinct from reference" contract) rather than a
   *    placeholder value.
   */
  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${FLUTTERWAVE_API_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: params.reference,
        amount: toFlutterwaveMajorUnits(params.amount),
        currency: params.currency,
        redirect_url: params.callbackUrl,
        customer: { email: params.customerEmail },
        meta: params.metadata,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as FlutterwaveInitializeResponse;

    if (!res.ok || json.status !== 'success' || !json.data) {
      throw new Error(`Flutterwave initialize payment failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Initialized Flutterwave payment reference=${params.reference}`);

    return {
      reference: params.reference,
      authorizationUrl: json.data.link,
    };
  }

  /**
   * Release IE.3, Checkpoint C — Payment verification / Transaction
   * synchronization. Calls Flutterwave's GET
   * /transactions/verify_by_reference?tx_ref=... — the reference-based
   * verify endpoint, not GET /transactions/:id/verify (which needs
   * Flutterwave's own numeric id, which this framework never has at
   * verify time) — same reasoning PaystackProvider.verifyPayment()'s
   * doc comment gives for using our own reference throughout.
   *
   * This is the piece PaymentsService.verifyPayment() (payments.service.ts,
   * built in Release IE.1) already calls generically for every provider
   * — this checkpoint only fills in what verification means for
   * Flutterwave specifically.
   *
   * Flutterwave has no distinct "paid at" timestamp the way Paystack
   * does; data.created_at (when Flutterwave created the transaction
   * record) is used as the closest available proxy, only when the
   * mapped status is SUCCESSFUL — an honest limitation, not treated as
   * an exact payment-confirmation time.
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(
      `${FLUTTERWAVE_API_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    const json = (await res.json().catch(() => ({}))) as FlutterwaveVerifyResponse;

    if (!res.ok || json.status !== 'success' || !json.data) {
      throw new Error(`Flutterwave verify transaction failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    const status = mapFlutterwaveStatus(json.data.status);
    this.logger.log(`Verified Flutterwave transaction reference=${reference} status=${json.data.status}`);

    return {
      reference,
      status,
      amount: fromFlutterwaveMajorUnits(json.data.amount),
      currency: json.data.currency,
      paidAt: status === 'SUCCESSFUL' && json.data.created_at ? new Date(json.data.created_at) : undefined,
      providerReference: String(json.data.id),
      raw: json.data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Release IE.3, Checkpoint F — Refund Processing.
   *
   * Flutterwave's refund endpoint is POST /transactions/:id/refund,
   * keyed by Flutterwave's OWN numeric transaction id — unlike
   * Paystack's /refund endpoint (PaystackProvider.refundPayment), which
   * accepts the caller's own reference directly. RefundPaymentParams
   * only carries `reference` (our tx_ref), so this method's first step
   * is resolving Flutterwave's id the same way verifyPayment() already
   * does — a verify_by_reference call — before it can call the refund
   * endpoint at all. This is an extra round-trip Paystack's own
   * implementation doesn't need, not an oversight; it's a real
   * consequence of Flutterwave's own API shape, called out here rather
   * than silently absorbed.
   *
   * amount, if provided, is converted to Flutterwave's major-unit
   * convention the same way initializePayment's is (toFlutterwaveMajorUnits) —
   * omitted entirely (not sent as 0 or undefined-cast-to-0) for a full
   * refund, matching Flutterwave's own documented "omit amount for a
   * full refund" contract.
   */
  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const { secretKey } = await this.getConfig();
    const transactionId = await this.resolveTransactionId(params.reference, secretKey);

    const body: Record<string, unknown> = {};
    if (params.amount !== undefined) {
      body.amount = toFlutterwaveMajorUnits(params.amount);
    }

    const res = await fetch(`${FLUTTERWAVE_API_BASE_URL}/transactions/${transactionId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as FlutterwaveRefundResponse;

    if (!res.ok || json.status !== 'success' || !json.data) {
      throw new Error(`Flutterwave refund failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Refunded Flutterwave transaction reference=${params.reference} refundId=${json.data.id} status=${json.data.status}`);

    return {
      reference: params.reference,
      // Flutterwave's own refund resource id — same "the provider's own
      // id for THIS refund, not the original transaction" contract
      // PaystackProvider.refundPayment()'s own refundReference follows.
      refundReference: String(json.data.id),
      status: mapFlutterwaveRefundStatus(json.data.status),
      amount: fromFlutterwaveMajorUnits(json.data.amount_refunded),
    };
  }

  /**
   * Release IE.3, Checkpoint G — Refund Verification / Synchronization.
   *
   * Calls Flutterwave's GET /refunds/:id, keyed by Flutterwave's own
   * refund resource id — the same value refundPayment() above already
   * returns as refundReference (json.data.id from the POST
   * /transactions/:id/refund response), so this is a direct lookup, no
   * extra resolveTransactionId-style round trip the way refundPayment()
   * itself needed. Mirrors PaystackProvider.verifyRefund()'s shape
   * exactly, including its "reference" fallback: Flutterwave's refund
   * resource doesn't nest the original transaction's tx_ref the way
   * Paystack's data.transaction.reference does (only a numeric tx_id
   * this framework has no use for without another API call this
   * checkpoint doesn't make), and PaymentsService.verifyRefund() (the
   * only caller) never reads RefundPaymentResult.reference off this
   * result anyway — it already has the transaction from its own lookup
   * before calling here.
   */
  async verifyRefund(refundReference: string): Promise<RefundPaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${FLUTTERWAVE_API_BASE_URL}/refunds/${encodeURIComponent(refundReference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const json = (await res.json().catch(() => ({}))) as FlutterwaveRefundStatusResponse;

    if (!res.ok || json.status !== 'success' || !json.data) {
      throw new Error(`Flutterwave verify refund failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Verified Flutterwave refund refundReference=${refundReference} status=${json.data.status}`);

    return {
      reference: refundReference,
      refundReference: String(json.data.id),
      status: mapFlutterwaveRefundStatus(json.data.status),
      amount: fromFlutterwaveMajorUnits(json.data.amount_refunded),
    };
  }

  /**
   * Shared by refundPayment above — resolves our own tx_ref to
   * Flutterwave's numeric transaction id via the same
   * verify_by_reference call verifyPayment() makes. Kept as its own
   * method (rather than calling this.verifyPayment(reference) and
   * reading .providerReference off the result) so a future caller
   * needing just the id doesn't have to pay for a full
   * VerifyPaymentResult mapping it doesn't need — and so this stays
   * correct even if verifyPayment()'s own return shape changes later.
   */
  private async resolveTransactionId(reference: string, secretKey: string): Promise<string> {
    const res = await fetch(
      `${FLUTTERWAVE_API_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const json = (await res.json().catch(() => ({}))) as FlutterwaveVerifyResponse;

    if (!res.ok || json.status !== 'success' || !json.data) {
      throw new Error(
        `Flutterwave refund failed: could not resolve transaction id for reference "${reference}" — HTTP ${res.status} — ${json.message ?? 'unknown error'}`,
      );
    }
    return String(json.data.id);
  }

  /**
   * Resolved once per process lifetime, same tradeoff/rationale as
   * PaystackProvider.getConfig() / AwsS3StorageProvider.getConfig() —
   * credential rotation takes effect on next deploy/restart, not live.
   * Exposed (not private) the same way PaystackProvider.getConfig() is,
   * for FlutterwaveHealthCheckDriver's sibling use and for future
   * checkpoints' methods to call.
   */
  async getConfig(): Promise<ResolvedFlutterwaveConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedFlutterwaveConfig> {
    const providerId = process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'PAYMENT_FLUTTERWAVE_PROVIDER_ID is not set. Create an IntegrationProvider (category PAYMENT, providerCode "FLUTTERWAVE") with credentials {secretKey}, then set PAYMENT_FLUTTERWAVE_PROVIDER_ID to its id.',
      );
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const secretKey = credentials?.secretKey as string | undefined;
    if (!secretKey) {
      throw new Error(`Integration provider ${providerId} is missing credentials.secretKey`);
    }

    return { secretKey };
  }
}
