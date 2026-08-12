import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IntegrationsService } from '../../integrations/integrations.service';
import { TransferProviderRegistry } from '../transfer-provider.registry';
import { InitiateTransferParams, InitiateTransferResult, TransferProvider, TransferStatus, VerifyTransferResult } from '../transfer-provider.interface';

export const PAYSTACK_TRANSFER_PROVIDER_CODE = 'PAYSTACK';
const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

interface ResolvedPaystackConfig {
  secretKey: string;
}

interface PaystackRecipientResponse {
  status: boolean;
  message: string;
  data?: { recipient_code: string };
}

interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data?: { transfer_code: string; reference: string; status: string; amount: number };
}

/**
 * Enterprise Banking APIs, Transfer APIs — the first concrete
 * TransferProvider, filling the gap BankTransferController's own
 * Checkpoint C left open ("no provider wiring yet").
 *
 * REUSES THE EXISTING PAYSTACK CREDENTIAL ROW: same
 * PAYMENT_PAYSTACK_PROVIDER_ID env var and IntegrationProvider row
 * (category PAYMENT, providerCode "PAYSTACK", credentials {secretKey})
 * PaystackProvider (payments/providers/paystack.provider.ts) already
 * resolves — one Paystack secret key authorizes both charging customers
 * and sending transfers on Paystack's own API, so there is no second
 * credential to store. This is a SEPARATE class implementing a
 * SEPARATE interface (TransferProvider, not PaymentProvider) registered
 * into a SEPARATE registry (TransferProviderRegistry, not
 * PaymentProviderRegistry) — see transfer-provider.interface.ts's own
 * doc comment for why inbound payments and outbound transfers are kept
 * as sibling abstractions rather than one merged interface. Both
 * classes happen to use the code "PAYSTACK", which is safe: they live
 * in different registries with no shared namespace, the same way
 * MonoProvider's "MONO" code coexists with any future "MONO" entry a
 * different provider-registry domain might use.
 *
 * PAYSTACK-SPECIFIC WRINKLE — TWO-STEP TRANSFER: unlike
 * initializePayment (a single POST), Paystack requires a "transfer
 * recipient" to exist before a transfer can reference it. initiateTransfer()
 * therefore does two sequential Paystack calls: POST /transferrecipient
 * (create/re-create the recipient every call — Paystack does not
 * require recipient reuse and offers no simple "does this recipient
 * already exist for this account+bank" lookup, so no caching is
 * attempted here; a future checkpoint could add a Prisma-backed
 * recipient cache keyed on (recipientAccountNumber, recipientBankCode)
 * if the extra API call proves costly in practice) followed by POST
 * /transfer using the resulting recipient_code. A failure in the first
 * call surfaces before the second is attempted, and reference/idempotency
 * live entirely in the second call — retrying a failed initiateTransfer
 * with the SAME `params.reference` is safe on Paystack's own side
 * (Paystack itself deduplicates by reference on /transfer), even though
 * a recipient row is harmlessly recreated on the retry.
 *
 * UNIT CONVERSION: TransferProvider's own interface doc says `amount` is
 * a major-unit decimal (matching BankProvider's convention), but
 * Paystack's /transfer endpoint — like every other Paystack money
 * endpoint — expects minor units (kobo). Converted here via
 * Math.round(amount * 100), the one place in this class where that
 * conversion needs to happen; PaymentProvider/PaystackProvider never
 * needed this conversion because that interface's own convention is
 * already minor-unit, matching Paystack directly.
 */
@Injectable()
export class PaystackTransferProvider implements TransferProvider, OnModuleInit {
  private readonly logger = new Logger(PaystackTransferProvider.name);
  private resolved: Promise<ResolvedPaystackConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: TransferProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(PAYSTACK_TRANSFER_PROVIDER_CODE, this);
    this.logger.log(`Registered transfer provider "${PAYSTACK_TRANSFER_PROVIDER_CODE}"`);
  }

  async initiateTransfer(params: InitiateTransferParams): Promise<InitiateTransferResult> {
    const { secretKey } = await this.getConfig();

    const recipientRes = await fetch(`${PAYSTACK_API_BASE_URL}/transferrecipient`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'nuban',
        name: params.recipientName ?? params.recipientAccountNumber,
        account_number: params.recipientAccountNumber,
        bank_code: params.recipientBankCode,
        currency: params.currency,
      }),
    });
    const recipientJson = (await recipientRes.json().catch(() => ({}))) as PaystackRecipientResponse;
    if (!recipientRes.ok || !recipientJson.status || !recipientJson.data) {
      throw new Error(`Paystack create transfer recipient failed: HTTP ${recipientRes.status} — ${recipientJson.message ?? 'unknown error'}`);
    }

    const transferRes = await fetch(`${PAYSTACK_API_BASE_URL}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(params.amount * 100),
        recipient: recipientJson.data.recipient_code,
        reference: params.reference,
        reason: params.narration,
      }),
    });
    const transferJson = (await transferRes.json().catch(() => ({}))) as PaystackTransferResponse;
    if (!transferRes.ok || !transferJson.status || !transferJson.data) {
      throw new Error(`Paystack initiate transfer failed: HTTP ${transferRes.status} — ${transferJson.message ?? 'unknown error'}`);
    }

    this.logger.log(`Initiated Paystack transfer reference=${params.reference} transferCode=${transferJson.data.transfer_code}`);

    return {
      providerTransferId: transferJson.data.transfer_code,
      status: mapPaystackTransferStatus(transferJson.data.status),
    };
  }

  async verifyTransfer(reference: string): Promise<VerifyTransferResult> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${PAYSTACK_API_BASE_URL}/transfer/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const json = (await res.json().catch(() => ({}))) as PaystackTransferResponse;
    if (!res.ok || !json.status || !json.data) {
      throw new Error(`Paystack verify transfer failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    this.logger.log(`Verified Paystack transfer reference=${reference} status=${json.data.status}`);

    const status = mapPaystackTransferStatus(json.data.status);
    return {
      providerTransferId: json.data.transfer_code,
      status,
      completedAt: status === 'SUCCESSFUL' ? new Date() : undefined,
      failureReason: status === 'FAILED' ? json.message : undefined,
    };
  }

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
        'PAYMENT_PAYSTACK_PROVIDER_ID is not set. PaystackTransferProvider reuses the same IntegrationProvider row as ' +
          'PaystackProvider (category PAYMENT, providerCode "PAYSTACK") — credentials {secretKey}.',
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

/**
 * Paystack's own /transfer status vocabulary, mapped to TransferProvider's
 * narrower TransferStatus union — a THIRD such mapping function in this
 * codebase (alongside mapPaystackStatus for payments, mapPaystackRefundStatus
 * for refunds), kept separate for the identical reason those two are
 * kept separate from each other: transfers are yet another distinct
 * Paystack resource with its own status vocabulary.
 *  - "success"                -> SUCCESSFUL
 *  - "failed"                 -> FAILED
 *  - "reversed"                -> REVERSED (Paystack reversed a transfer that had gone out — distinct from FAILED, matches TransferStatus's own REVERSED case)
 *  - everything else ("pending", "otp" — awaiting OTP confirmation on
 *    Paystack's side, "processing") -> PENDING, the safe default
 */
export function mapPaystackTransferStatus(paystackTransferStatus: string): TransferStatus {
  switch (paystackTransferStatus) {
    case 'success':
      return 'SUCCESSFUL';
    case 'failed':
      return 'FAILED';
    case 'reversed':
      return 'REVERSED';
    default:
      return 'PENDING';
  }
}
