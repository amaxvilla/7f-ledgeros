/**
 * Vendor-agnostic bank/open-banking gateway abstraction (Release IF.1,
 * Checkpoint A — abstraction only).
 *
 * Same role PaymentProvider (payments/payment-provider.interface.ts)
 * plays for payment gateways: every caller that needs to validate a
 * bank account, pull a statement, or check a balance depends on this
 * interface, never on a concrete Mono/Okra/Stitch (or a specific bank's
 * direct API) class — adding a new provider later is a new class + one
 * registry entry, not a rewrite of every caller.
 *
 * Deliberately scoped to ONLY the interface + its supporting types.
 * Nothing here is wired up yet — no concrete provider, no registry
 * binding beyond the empty BankProviderRegistry (Checkpoint A also
 * includes that, the same way PaymentProviderRegistry started alongside
 * PaymentProvider rather than as its own separate checkpoint), no
 * Prisma model, no controller/service, no queue/worker. Those are later
 * checkpoints by design.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - amount/balance are plain major-unit decimals (e.g. 15000.50 naira),
 *    NOT integer minor units. This deliberately does NOT match
 *    PaymentProvider's minor-unit convention (see that file's own design
 *    notes) — it matches the EXISTING bank-reconciliation module instead
 *    (BankStatement.openingBalance/closingBalance,
 *    bank-statement-import.processor.ts's parsed CSV `amount` field are
 *    both plain decimals already). A later checkpoint feeding
 *    BankStatementLine into BankReconciliationService.importStatement
 *    should not need a unit conversion at that boundary.
 *  - accountNumber + bankCode together identify an account, not a
 *    provider-specific account id — bankCode is the local bank/routing
 *    code scheme (e.g. Nigeria's NIBSS 3-digit codes), matching how
 *    BankAccount is already keyed in the Prisma schema today.
 *  - fetchStatement takes an inclusive [fromDate, toDate] ISO-date
 *    range, mirroring ImportBankStatementDto's existing
 *    periodStart/periodEnd fields rather than inventing a different
 *    range shape.
 */

export interface ValidateAccountParams {
  accountNumber: string;
  bankCode: string;
}

export interface ValidateAccountResult {
  valid: boolean;
  /** The account holder's name on record with the bank, if the provider resolves one — undefined when valid is false. */
  accountName?: string;
}

export interface FetchStatementParams {
  accountNumber: string;
  bankCode: string;
  /** ISO date, inclusive. */
  fromDate: string;
  /** ISO date, inclusive. */
  toDate: string;
}

export interface BankStatementLine {
  transactionDate: Date;
  description: string;
  /** The bank's own reference/narration code for this line, if any. */
  reference?: string;
  /** Signed, major-unit decimal — positive for credit, negative for debit, matching the sign convention parseStatementCsv already expects. */
  amount: number;
  /** Running balance immediately after this transaction, if the provider supplies one. */
  balanceAfter?: number;
}

export interface FetchBalanceParams {
  accountNumber: string;
  bankCode: string;
}

export interface FetchBalanceResult {
  /** Major-unit decimal — see design notes above. */
  balance: number;
  /** ISO 4217 currency code, e.g. "NGN". */
  currency: string;
  asOf: Date;
}

export interface BankProvider {
  validateAccount(params: ValidateAccountParams): Promise<ValidateAccountResult>;
  fetchStatement(params: FetchStatementParams): Promise<BankStatementLine[]>;
  fetchBalance(params: FetchBalanceParams): Promise<FetchBalanceResult>;
}

/** DI token for the active bank provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const BANK_PROVIDER = Symbol('BANK_PROVIDER');
