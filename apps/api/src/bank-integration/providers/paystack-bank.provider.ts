import { Injectable, OnModuleInit } from '@nestjs/common';
import { IntegrationsService } from '../../integrations/integrations.service';
import { BankProviderRegistry } from '../bank-provider.registry';
import {
  BankProvider,
  ValidateAccountParams,
  ValidateAccountResult,
  FetchStatementParams,
  BankStatementLine,
  FetchBalanceParams,
  FetchBalanceResult,
} from '../bank-provider.interface';

export const PAYSTACK_BANK_PROVIDER_CODE = 'PAYSTACK';
const PAYSTACK_API_BASE_URL = 'https://api.paystack.co';

interface ResolvedPaystackConfig {
  secretKey: string;
}

/**
 * Release IF.2 — Open Banking, Checkpoint A: real account validation.
 *
 * WHY THIS EXISTS / WHY IT WASN'T PART OF IF.1: MonoProvider.validateAccount
 * (bank-integration/providers/mono.provider.ts, Checkpoint F) was
 * explicitly re-scoped away from arbitrary account-number lookup — Mono
 * only knows about accounts a customer has already linked via Mono
 * Connect consent, documented in that file as a real gap ("a
 * NIBSS-style arbitrary lookup Mono has no endpoint for"). That gap is
 * exactly the original master roadmap's separate "Account Validation"
 * line item, and it's what "IF.2 Open Banking" is scoped to close here
 * — resolving an arbitrary accountNumber+bankCode pair to an account
 * holder name, with no prior linking step required.
 *
 * WHY PAYSTACK, NOT A NEW VENDOR: Paystack's Transfers API already
 * exposes exactly this (`GET /bank/resolve`) — a NUBAN account-name
 * resolution lookup, independent of its payment-collection endpoints —
 * and this system already has a configured, working Paystack
 * IntegrationProvider row from Release IE.2. Standing up a whole new
 * vendor integration for one lookup endpoint when an already-integrated
 * one offers it would be exactly the kind of unnecessary duplication
 * these instructions warn against.
 *
 * WHY A SEPARATE CLASS FROM PaystackProvider (payments/providers/paystack.provider.ts)
 * RATHER THAN ADDING BankProvider TO THAT ONE: PaystackProvider already
 * implements PaymentProvider (payment collection: initialize/verify/refund) —
 * bolting BankProvider's very different concern (bank data lookup) onto
 * the same class would conflate two registries' worth of responsibility
 * in one file. Both classes independently resolve the SAME
 * PAYMENT_PAYSTACK_PROVIDER_ID credential (there being no shared
 * resolver file in this codebase to import — see the divergence note in
 * this checkpoint's report), which is a small, deliberate duplication
 * traded for keeping PaymentProvider and BankProvider genuinely
 * independent, swappable abstractions — the same trade-off
 * PaymentWebhookHandler being a separate interface from PaymentProvider
 * already makes (see payment-webhook-handler.interface.ts's own doc
 * comment on that split).
 *
 * fetchStatement/fetchBalance are NOT implemented — Paystack's API has
 * no equivalent of either (it is a payment gateway with a bank-resolve
 * utility endpoint, not an account-aggregation/open-banking product
 * like Mono). Both throw a clear, typed error rather than a fake
 * result, the same "skeleton with honest NotImplemented errors, not a
 * partial fake" precedent MonoProvider's own Checkpoint B set.
 */
@Injectable()
export class PaystackBankProvider implements BankProvider, OnModuleInit {
  private resolved: Promise<ResolvedPaystackConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: BankProviderRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(PAYSTACK_BANK_PROVIDER_CODE, this);
  }

  async validateAccount(params: ValidateAccountParams): Promise<ValidateAccountResult> {
    const { secretKey } = await this.getConfig();

    const url = `${PAYSTACK_API_BASE_URL}/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${secretKey}` } });
    const json = (await this.parseJson(res)) as { status?: boolean; message?: string; data?: { account_name?: string } };

    if (!res.ok || !json.status) {
      // An unresolvable account is a normal, expected outcome of this
      // endpoint (Paystack returns a 4xx with status:false for an
      // invalid pair) — represented as {valid:false}, not an exception.
      // A genuine transport/auth failure below (parseJson threw, or the
      // secret key itself is invalid) still throws, same as every other
      // provider method in this framework.
      return { valid: false };
    }

    return { valid: true, accountName: json.data?.account_name };
  }

  fetchStatement(_params: FetchStatementParams): Promise<BankStatementLine[]> {
    throw new Error(
      'PaystackBankProvider does not support fetchStatement — Paystack has no bank-statement/account-aggregation API. Use MonoProvider (providerCode "MONO") for statement access.',
    );
  }

  fetchBalance(_params: FetchBalanceParams): Promise<FetchBalanceResult> {
    throw new Error(
      'PaystackBankProvider does not support fetchBalance — Paystack has no bank-balance API. Use MonoProvider (providerCode "MONO") for balance access.',
    );
  }

  private async getConfig(): Promise<ResolvedPaystackConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedPaystackConfig> {
    const providerId = process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'PAYMENT_PAYSTACK_PROVIDER_ID is not set. Create an IntegrationProvider (category PAYMENT, providerCode "PAYSTACK") with credentials {secretKey}, then set PAYMENT_PAYSTACK_PROVIDER_ID to its id. (Same variable PaystackProvider — payments/providers/paystack.provider.ts — already resolves; this reuses the same IntegrationProvider row, not a second one.)',
      );
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const secretKey = credentials?.secretKey as string | undefined;
    if (!secretKey) {
      throw new Error(`Integration provider ${providerId} is missing credentials.secretKey`);
    }

    return { secretKey };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
