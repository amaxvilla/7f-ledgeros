/**
 * Vendor-agnostic outbound-bank-transfer abstraction (Enterprise Banking
 * APIs release, Transfer APIs — Checkpoint A: abstraction only).
 *
 * Deliberately a SIBLING to PaymentProvider (payments/payment-provider.interface.ts),
 * not an extension of it: PaymentProvider is inbound money collection
 * (a customer pays the business); this is outbound (the business pays
 * someone else). Same domain family, opposite direction, different
 * risk profile — kept as separate interfaces/registries the same way
 * BankProvider (read-only: validate/statement/balance) is already kept
 * separate from PaymentProvider rather than folded into it.
 *
 * SCOPE DECISION, explicitly confirmed rather than assumed: this
 * abstraction and its first concrete provider carry NO mandatory
 * approval gate and NO hardcoded transaction/daily limit. Both are left
 * as OPTIONAL, admin-configurable behavior for a later checkpoint (the
 * TransferPolicy/BankTransfer service layer) to add on top of this
 * interface if and when an admin turns them on — not baked into the
 * provider contract itself, so a business that wants zero friction gets
 * it, and a business that later wants approval-gated or limit-capped
 * transfers can enable that without this interface changing. This
 * mirrors FacilityService's own decommission-approval pattern in
 * spirit (Workflow Engine reuse is available, not forced) rather than
 * literally reusing it here — a transfer's approval, if enabled, is a
 * pre-initiation gate on whoever calls initiateTransfer(), not a step
 * initiateTransfer() itself performs.
 *
 * PROVIDER CHOICE, also explicitly confirmed as flexible: multiple
 * providers can be registered simultaneously (Paystack Transfers,
 * Flutterwave Transfers, or a dedicated bank-transfer API), the same
 * multi-provider shape PaymentProviderRegistry/BankProviderRegistry
 * already support — no provider is assumed as "the" transfer provider
 * at this layer.
 */

export interface InitiateTransferParams {
  /** Major-unit decimal — matches BankProvider's convention (see that
   *  file's design notes), NOT PaymentProvider's minor-unit convention,
   *  since this operates on the same bank-account data BankProvider
   *  already established that convention for. */
  amount: number;
  /** ISO 4217 currency code, e.g. "NGN". */
  currency: string;
  recipientAccountNumber: string;
  recipientBankCode: string;
  /** The recipient name as validated (e.g. via BankProvider.validateAccount / PaystackBankProvider) — providers may reject a mismatch. */
  recipientName?: string;
  /** Caller-supplied idempotency key. Providers MUST treat repeated calls with the same reference as the same transfer, not a duplicate — the exact same idempotency contract PaymentProvider.initializePayment's own reference already carries. */
  reference: string;
  narration?: string;
}

export interface InitiateTransferResult {
  /** The provider's own opaque id for this transfer. */
  providerTransferId: string;
  status: TransferStatus;
}

export type TransferStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';

export interface VerifyTransferResult {
  providerTransferId: string;
  status: TransferStatus;
  /** Present once the provider has a final settled status. */
  completedAt?: Date;
  failureReason?: string;
}

export interface TransferProvider {
  initiateTransfer(params: InitiateTransferParams): Promise<InitiateTransferResult>;
  /** Re-checks a transfer's CURRENT status with the provider directly —
   *  same reasoning PaymentProvider.verifyPayment/verifyRefund already
   *  established: a webhook can be missed or delayed. */
  verifyTransfer(reference: string): Promise<VerifyTransferResult>;
}

/** DI token for the active transfer provider — not yet bound anywhere (registry supports multiple providers registered by code instead; see TransferProviderRegistry). */
export const TRANSFER_PROVIDER = Symbol('TRANSFER_PROVIDER');
