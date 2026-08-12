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

export const PAYSTACK_PROVIDER_CODE = 'PAYSTACK';
export const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

interface ResolvedPaystackConfig {
  secretKey: string;
}

/**
 * Release IE.2. Checkpoint A built registration, config resolution, and
 * credential validation (the health-check driver in the sibling file).
 * Checkpoint B added `initializePayment`, Checkpoint C added
 * `verifyPayment`, Checkpoint E adds `refundPayment` below — all three
 * PaymentProvider methods are now real. (Checkpoint D, in the sibling
 * paystack-webhook.handler.ts, is a separate class implementing a
 * separate interface — PaymentWebhookHandler — not a method here.)
 *
 * amount/currency are passed through to Paystack unchanged in
 * `initializePayment` — this framework's own documented convention
 * (payment-provider.interface.ts) is that `amount` is always the minor
 * currency unit already (kobo for NGN, cents for USD, etc.), which is
 * exactly what Paystack's API itself expects, so no conversion happens
 * here.
 *
 * Resolves its secret key from an IntegrationProvider row (category
 * PAYMENT, providerCode "PAYSTACK") via IntegrationsService, exactly the
 * pattern AwsS3StorageProvider (storage/providers/aws-s3-storage.provider.ts)
 * established for Release IB — PAYMENT_PAYSTACK_PROVIDER_ID (env) points
 * at that row's id. No new credential-storage mechanism, no env var
 * holding a raw secret key.
 *
 * Registers itself into PaymentProviderRegistry via onModuleInit()
 * (rather than a module-load-time static assignment, the way
 * INTEGRATION_DRIVER_REGISTRY's stateless health-check drivers do) —
 * this class needs constructor-injected IntegrationsService, which only
 * exists once Nest's DI container has constructed it; see
 * PaymentProviderRegistry's own doc comment for why that rules out the
 * static-object pattern for payment providers specifically.
 */
interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackRefundResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    amount: number;
    currency: string;
    status: string;
    /** Present on GET /refund/:id (not on the POST /refund response) — the original charge's reference, i.e. what PaymentTransaction.reference stores. */
    transaction?: { reference?: string };
    [key: string]: unknown;
  };
}

/**
 * Paystack's refund status vocabulary, mapped to this framework's
 * RefundStatus union (payment-provider.interface.ts) the same
 * deliberate-narrowing way mapPaystackStatus handles transaction status
 * above — kept as a SEPARATE function rather than reusing
 * mapPaystackStatus, because refunds and transactions are different
 * Paystack resources with their own (overlapping but not identical)
 * status vocabularies; "success" (a transaction status) and "processed"
 * (a refund status) both mean "done", but conflating the two functions
 * would make either one wrong the moment either vocabulary changes:
 *  - "processed"            -> SUCCESSFUL
 *  - "failed"               -> FAILED
 *  - everything else ("pending", "processing", or any future value) -> PENDING
 */
export function mapPaystackRefundStatus(paystackRefundStatus: string): RefundStatus {
  switch (paystackRefundStatus) {
    case 'processed':
      return 'SUCCESSFUL';
    case 'failed':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    gateway_response?: string;
    [key: string]: unknown;
  };
}

/**
 * Paystack's own transaction.status vocabulary is wider than this
 * framework's PaymentStatus union (payment-provider.interface.ts) —
 * mapped down deliberately. Exported (not file-private) because
 * PaystackWebhookHandler (paystack-webhook.handler.ts, Checkpoint D)
 * needs the identical mapping for the `status` field on a webhook
 * event's `data` object — same vocabulary, same meaning, one function
 * rather than two copies that could drift:
 *  - "success"   -> SUCCESSFUL
 *  - "abandoned" -> ABANDONED (customer left the hosted checkout page)
 *  - "failed"    -> FAILED
 *  - "reversed"  -> FAILED (a chargeback/reversal on a completed charge —
 *                   closer to "this money did not end up with us" than
 *                   any in-flight state; a genuine refund is tracked
 *                   separately via PaymentRefund, this is Paystack
 *                   reversing the ORIGINAL charge, not us initiating one)
 *  - everything else ("pending", "queued", "ongoing", "processing", or
 *    any future value Paystack adds) -> PENDING, the safe default for
 *    "not yet resolved" rather than guessing
 */
export function mapPaystackStatus(paystackStatus: string): PaymentStatus {
  switch (paystackStatus) {
    case 'success':
      return 'SUCCESSFUL';
    case 'abandoned':
      return 'ABANDONED';
    case 'failed':
    case 'reversed':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

@Injectable()
export class PaystackProvider implements PaymentProvider, OnModuleInit {
  private readonly logger = new Logger(PaystackProvider.name);
  private resolved: Promise<ResolvedPaystackConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(PAYSTACK_PROVIDER_CODE, this);
    this.logger.log(`Registered payment provider "${PAYSTACK_PROVIDER_CODE}"`);
  }

  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${PAYSTACK_API_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.customerEmail,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as PaystackInitializeResponse;

    if (!res.ok || !json.status || !json.data) {
      throw new Error(`Paystack initialize transaction failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Initialized Paystack transaction reference=${params.reference}`);

    return {
      reference: params.reference,
      authorizationUrl: json.data.authorization_url,
      // access_code, not data.reference (which just echoes params.reference
      // back) — this is the field genuinely distinct to Paystack's own
      // side, matching what InitializePaymentResult.providerReference
      // documents ("the provider's own transaction id/reference, if it
      // assigns one distinct from `reference`").
      providerReference: json.data.access_code,
    };
  }

  /**
   * Release IE.2, Checkpoint C — Payment verification / Transaction
   * synchronization. Calls Paystack's GET /transaction/verify/:reference
   * (the reference is the SAME caller-supplied one passed to
   * initializePayment, not Paystack's own numeric id — Paystack accepts
   * either, this framework only ever has the former) and maps the
   * result back through mapPaystackStatus above.
   *
   * This is the piece PaymentsService.verifyPayment() (payments.service.ts)
   * already calls — that method, the PaymentTransaction row update, and
   * the audit log entry were all built in Checkpoint IE.1/D; this
   * checkpoint only fills in what provider.verifyPayment() actually does
   * for Paystack specifically.
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${PAYSTACK_API_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const json = (await res.json().catch(() => ({}))) as PaystackVerifyResponse;

    if (!res.ok || !json.status || !json.data) {
      throw new Error(`Paystack verify transaction failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Verified Paystack transaction reference=${reference} status=${json.data.status}`);

    return {
      reference,
      status: mapPaystackStatus(json.data.status),
      amount: json.data.amount,
      currency: json.data.currency,
      paidAt: json.data.paid_at ? new Date(json.data.paid_at) : undefined,
      // Paystack's own internal transaction id — distinct from both
      // `reference` and the access_code initializePayment recorded;
      // this is the value later checkpoints (webhook signature lookups,
      // support/reconciliation tooling) should treat as Paystack's
      // canonical id for a completed transaction.
      providerReference: String(json.data.id),
      raw: json.data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Release IE.2, Checkpoint E — Refund support / charge reversal.
   * Calls Paystack's POST /refund with `transaction` set to our
   * caller-supplied reference (Paystack accepts either the reference or
   * its own numeric transaction id here; same reasoning as
   * verifyPayment for using reference). Omitting `amount` triggers a
   * full refund on Paystack's side — matches
   * RefundPaymentParams.amount's own "omit for a full refund" contract
   * (payment-provider.interface.ts), so no default is substituted here.
   *
   * This is the piece PaymentsService.refundPayment() (payments.service.ts)
   * already calls after its own SUCCESSFUL-status/amount-ceiling checks —
   * those checks, the PaymentRefund row creation, and the audit log
   * entry were all built in Checkpoint IE.1/D; this checkpoint only
   * fills in what provider.refundPayment() actually does for Paystack.
   */
  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${PAYSTACK_API_BASE_URL}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: params.reference,
        amount: params.amount,
        customer_note: params.reason,
        merchant_note: params.reason,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as PaystackRefundResponse;

    if (!res.ok || !json.status || !json.data) {
      throw new Error(`Paystack refund failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Refunded Paystack transaction reference=${params.reference} refundId=${json.data.id} status=${json.data.status}`);

    return {
      reference: params.reference,
      // Paystack's own refund id — distinct from both the original
      // transaction's reference and its own providerReference, this is
      // what PaymentRefund.refundReference stores (payments.service.ts).
      refundReference: String(json.data.id),
      status: mapPaystackRefundStatus(json.data.status),
      amount: json.data.amount,
    };
  }

  /**
   * Release IE.2, Checkpoint G — Worker Integration (refund reconciliation).
   * Calls Paystack's GET /refund/:id — refundReference IS Paystack's own
   * refund id (see refundPayment's comment on what refundReference
   * stores), so no reference-vs-id ambiguity here the way verifyPayment
   * has for transactions.
   *
   * This is the piece PaymentsService.verifyRefund() (payments.service.ts)
   * calls after its own lookup/RLS checks, the same split verifyPayment
   * already has with PaymentsService.verifyPayment().
   */
  async verifyRefund(refundReference: string): Promise<RefundPaymentResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${PAYSTACK_API_BASE_URL}/refund/${encodeURIComponent(refundReference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const json = (await res.json().catch(() => ({}))) as PaystackRefundResponse;

    if (!res.ok || !json.status || !json.data) {
      throw new Error(`Paystack verify refund failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Verified Paystack refund refundReference=${refundReference} status=${json.data.status}`);

    return {
      // Paystack's GET /refund/:id nests the original transaction's own
      // reference at data.transaction.reference — falling back to
      // refundReference itself only in the unexpected case that field
      // is absent, so this always returns a string rather than throwing
      // over a field PaymentsService.verifyRefund() doesn't actually use
      // (it already has the transaction reference from its own lookup).
      reference: json.data.transaction?.reference ?? refundReference,
      refundReference: String(json.data.id),
      status: mapPaystackRefundStatus(json.data.status),
      amount: json.data.amount,
    };
  }

  /**
   * Resolved once per process lifetime, same tradeoff/rationale as
   * AwsS3StorageProvider.getConfig() — credential rotation takes effect
   * on next deploy/restart, not live.
   */
  async getConfig(): Promise<ResolvedPaystackConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedPaystackConfig> {
    const providerId = process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'PAYMENT_PAYSTACK_PROVIDER_ID is not set. Create an IntegrationProvider (category PAYMENT, providerCode "PAYSTACK") with credentials {secretKey}, then set PAYMENT_PAYSTACK_PROVIDER_ID to its id.',
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
