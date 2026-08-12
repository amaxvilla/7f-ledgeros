import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MonoLinkStatus } from '@prisma/client';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BankProviderRegistry } from '../bank-provider.registry';
import {
  BankProvider,
  BankStatementLine,
  FetchBalanceParams,
  FetchBalanceResult,
  FetchStatementParams,
  ValidateAccountParams,
  ValidateAccountResult,
} from '../bank-provider.interface';

export const MONO_PROVIDER_CODE = 'MONO';
export const MONO_API_BASE_URL = 'https://api.withmono.com/v2';

interface ResolvedMonoConfig {
  secretKey: string;
}

/**
 * Release IF.1, Checkpoint B — Mono Provider (skeleton).
 *
 * Deliberately mirrors FlutterwaveProvider's own Checkpoint A exactly
 * (payments/providers/flutterwave.provider.ts): registration into
 * BankProviderRegistry, config resolution off an IntegrationProvider row
 * via IntegrationsService (category BANKING, providerCode "MONO" —
 * BANK_MONO_PROVIDER_ID env points at that row's id, same pattern, no
 * new credential-storage mechanism), and a health-check driver in the
 * sibling file.
 *
 * IMPORTANT ARCHITECTURAL NOTE surfaced by actually implementing this
 * checkpoint (not assumed at Checkpoint A): unlike a payment gateway's
 * NIBSS-backed "resolve any account number" endpoint (what
 * BankProvider.validateAccount's shape was modeled on), Mono is an
 * ACCOUNT-LINKING aggregator — every one of its data endpoints
 * (statement, balance, account details) requires a Mono `accountId`
 * obtained via a one-time Mono Connect consent flow the end customer
 * completes, not an arbitrary accountNumber+bankCode a caller can query
 * on demand. There is currently no Prisma model to store that mapping
 * (which real BankAccount a given Mono accountId belongs to, and its
 * consent/token state), and no Mono Connect callback endpoint to obtain
 * one in the first place — both are needed before any of the three
 * BankProvider methods can be genuinely implemented against Mono, not
 * just this one file.
 *
 * Given that, this checkpoint intentionally stays a skeleton — registered,
 * config-resolving, credential-validated (see MonoHealthCheckDriver) —
 * with all three BankProvider methods throwing a clear NotImplemented
 * error rather than a fake/partial implementation that looks done but
 * silently can't work end-to-end. Real implementations land in
 * subsequent checkpoints alongside the Prisma model + Connect callback
 * they depend on: see the Checkpoint Report's "Remaining Checkpoints"
 * for the proposed split (C: MonoLinkedAccount model + Connect exchange
 * endpoint, D: fetchBalance + fetchStatement against a linked account,
 * E: validateAccount — likely re-scoped, since Mono has no direct
 * equivalent; may end up meaning "is this Mono accountId linked and
 * active" rather than a NIBSS-style arbitrary lookup).
 *
 * ADDENDUM — Release IF.1, Checkpoint D: fetchBalance/fetchStatement are
 * now implemented for real (see resolveActiveLinkedAccount()'s own doc
 * comment for a second architectural note this checkpoint surfaced —
 * this file's own bankCode claim above doesn't hold against the actual
 * BankAccount schema). validateAccount was re-scoped and implemented in
 * Checkpoint F (see that method's own doc comment) — every BankProvider
 * method is now a real implementation, no stubs remain in this class.
 */
@Injectable()
export class MonoProvider implements BankProvider, OnModuleInit {
  private readonly logger = new Logger(MonoProvider.name);
  private resolved: Promise<ResolvedMonoConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: BankProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.registry.register(MONO_PROVIDER_CODE, this);
    this.logger.log(`Registered bank provider "${MONO_PROVIDER_CODE}"`);
  }

  /**
   * Release IF.1, Checkpoint F — the re-scoping this file's own class doc
   * comment (and mono-linked-account.service.ts's Checkpoint E doc
   * comment) flagged as still outstanding.
   *
   * Mono has no NIBSS-style "resolve any account number against the
   * banking network" endpoint — the only account-level truth Mono can
   * offer is "has this specific account already been linked via Mono
   * Connect, and is that link still ACTIVE" (see this file's class doc
   * comment for why). So `valid` here means exactly that, not "the bank
   * confirms this account number is real" the way a payment gateway's
   * NIBSS-backed resolve would. accountName is the linked BankAccount's
   * own self-reported accountName — NOT a bank-verified name Mono
   * returned — since Mono's account-meta response (fetchAccountMeta
   * above) has no account-holder-name field this codebase currently
   * captures. Both caveats are Mono-specific, so they live here rather
   * than on ValidateAccountResult itself (bank-provider.interface.ts
   * stays vendor-agnostic — a future provider with a real NIBSS-style
   * lookup wouldn't share either caveat).
   *
   * Deliberately non-throwing on "not linked" / "ambiguous" — unlike
   * resolveActiveLinkedAccount (used by fetchStatement/fetchBalance,
   * where an unlinked account is a caller error), returning
   * `{ valid: false }` is the expected, ordinary result for an account
   * nobody has linked yet, the same way a real NIBSS lookup returns
   * `{ valid: false }` rather than throwing for an unresolvable number.
   */
  async validateAccount(params: ValidateAccountParams): Promise<ValidateAccountResult> {
    const candidates = await this.prisma.monoLinkedAccount.findMany({
      where: { status: MonoLinkStatus.ACTIVE, bankAccount: { accountNumber: params.accountNumber } },
      include: { bankAccount: true },
    });

    if (candidates.length !== 1) {
      // Covers both "not linked" (0) and the same ambiguous-collision
      // case resolveActiveLinkedAccount's doc comment describes (>1) —
      // validateAccount's contract has no room to distinguish the two
      // (just a boolean), so both honestly resolve to "not valid".
      return { valid: false };
    }

    return { valid: true, accountName: candidates[0].bankAccount.accountName };
  }

  /**
   * Release IF.1, Checkpoint D. Pulls transactions in [fromDate, toDate]
   * for the account currently linked to this accountNumber, via Mono's
   * GET /accounts/:id/transactions (paginate=false to get the full range
   * in one call rather than implementing cursor pagination in this
   * checkpoint — acceptable for the statement-import volumes this
   * codebase's own bank-reconciliation module already handles via CSV,
   * but a real gap if a linked account ever has an unusually large
   * transaction count; flagged here rather than silently truncating).
   *
   * Sign convention matches BankStatementLine's own doc comment
   * (positive credit, negative debit) — Mono reports `type` as
   * 'credit'|'debit' and `amount` as an unsigned minor-unit (kobo)
   * integer; both get folded into one signed major-unit decimal here so
   * every downstream consumer (parseStatementCsv's existing convention)
   * only ever has to handle one shape.
   */
  async fetchStatement(params: FetchStatementParams): Promise<BankStatementLine[]> {
    const { secretKey } = await this.getConfig();
    const linked = await this.resolveActiveLinkedAccount(params.accountNumber);

    const url = new URL(`${MONO_API_BASE_URL}/accounts/${linked.monoAccountId}/transactions`);
    url.searchParams.set('start', params.fromDate);
    url.searchParams.set('end', params.toDate);
    url.searchParams.set('paginate', 'false');

    const res = await fetch(url.toString(), { headers: { 'mono-sec-key': secretKey } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Mono statement fetch failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }

    const json = (await res.json()) as {
      data?: { _id?: string; narration?: string; amount?: number; type?: 'credit' | 'debit'; balance?: number; date?: string }[];
    };

    return (json.data ?? []).map((line) => {
      const sign = line.type === 'debit' ? -1 : 1;
      return {
        transactionDate: new Date(line.date ?? params.fromDate),
        description: line.narration ?? '',
        reference: line._id,
        amount: sign * ((line.amount ?? 0) / 100),
        balanceAfter: line.balance != null ? line.balance / 100 : undefined,
      };
    });
  }

  /**
   * Release IF.1, Checkpoint D. Mono's balance endpoint reports in kobo
   * (minor units) like everything else in its API — converted to a
   * major-unit decimal here per this file's own design notes
   * (bank-provider.interface.ts), so BankProvider callers never see a
   * minor-unit number regardless of which concrete provider they're
   * talking to.
   */
  async fetchBalance(params: FetchBalanceParams): Promise<FetchBalanceResult> {
    const { secretKey } = await this.getConfig();
    const linked = await this.resolveActiveLinkedAccount(params.accountNumber);

    const res = await fetch(`${MONO_API_BASE_URL}/accounts/${linked.monoAccountId}/balance`, {
      headers: { 'mono-sec-key': secretKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Mono balance fetch failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }

    const json = (await res.json()) as { balance?: number; currency?: string };
    if (json.balance == null) {
      throw new Error('Mono balance fetch succeeded but returned no balance');
    }

    return {
      balance: json.balance / 100,
      currency: json.currency ?? linked.currency ?? 'NGN',
      asOf: new Date(),
    };
  }

  /** Exposed for MonoHealthCheckDriver's sibling use and for future checkpoints' methods to call. */
  async getConfig(): Promise<ResolvedMonoConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  /**
   * Release IF.1, Checkpoint C — the code-exchange step of Mono Connect.
   * `code` is the short-lived, single-use code the Mono Connect widget
   * hands the frontend on successful consent; exchanging it here (not
   * client-side) keeps the secret key server-only, same reasoning as
   * every other provider in this codebase never accepting a raw secret
   * from a request body. Returns Mono's own account id — the value
   * MonoLinkedAccountService stores as `monoAccountId` and every future
   * checkpoint's fetchStatement/fetchBalance will key off.
   */
  async exchangeConnectCode(code: string): Promise<{ monoAccountId: string }> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${MONO_API_BASE_URL}/account/auth`, {
      method: 'POST',
      headers: { 'mono-sec-key': secretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Mono Connect code exchange failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }

    const json = (await res.json()) as { id?: string };
    if (!json.id) {
      throw new Error('Mono Connect code exchange succeeded but returned no account id');
    }
    return { monoAccountId: json.id };
  }

  /**
   * Release IF.1, Checkpoint C — fetches the linked account's institution
   * name, masked account number, and currency for display purposes right
   * after linking (GET /v2/accounts/:id). Best-effort: a failure here
   * doesn't fail the link itself (the account is already linked at this
   * point via exchangeConnectCode) — MonoLinkedAccountService falls back
   * to nulls for these display-only fields on error rather than losing
   * the link.
   */
  async fetchAccountMeta(monoAccountId: string): Promise<{ institutionName?: string; accountNumberMasked?: string; currency?: string }> {
    const { secretKey } = await this.getConfig();

    const res = await fetch(`${MONO_API_BASE_URL}/accounts/${monoAccountId}`, {
      headers: { 'mono-sec-key': secretKey },
    });
    if (!res.ok) {
      throw new Error(`Mono account lookup failed: HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      account?: { institution?: { name?: string }; accountNumber?: string; currency?: string };
    };
    const accountNumber = json.account?.accountNumber;
    return {
      institutionName: json.account?.institution?.name,
      accountNumberMasked: accountNumber ? `****${accountNumber.slice(-4)}` : undefined,
      currency: json.account?.currency,
    };
  }

  /**
   * Release IF.1, Checkpoint D. Resolves BankProvider's accountNumber+
   * bankCode params (bank-provider.interface.ts's shape, unchanged since
   * it's shared with every other future BankProvider) down to the
   * currently-ACTIVE MonoLinkedAccount for that account.
   *
   * ARCHITECTURAL NOTE surfaced by actually implementing this: that
   * interface's own design note claims accountNumber+bankCode together
   * "match how BankAccount is already keyed in the Prisma schema" — that
   * doesn't hold. BankAccount has accountNumber but no bankCode column
   * at all (see prisma/schema.prisma). So `bankCode` is accepted here
   * (required by the interface) but NOT used to narrow the match —
   * resolution is by accountNumber alone against every ACTIVE
   * MonoLinkedAccount's bankAccount.accountNumber. Two consequences
   * worth a caller knowing:
   *  - if two different BankAccount rows (necessarily in different
   *    Entities, since (entityId, accountNumber) is unique) happen to
   *    share an accountNumber, this throws an ambiguous-match error
   *    rather than silently picking one — same fail-loud posture as
   *    BankProviderRegistry.get() on an unknown code.
   *  - a caller cannot use bankCode to disambiguate that collision today.
   * A future checkpoint should either add a real bankCode column to
   * BankAccount (making this exact case resolvable) or drop bankCode
   * from the shared interface if no provider ends up needing it.
   */
  private async resolveActiveLinkedAccount(accountNumber: string) {
    const candidates = await this.prisma.monoLinkedAccount.findMany({
      where: { status: MonoLinkStatus.ACTIVE, bankAccount: { accountNumber } },
      include: { bankAccount: true },
    });

    if (candidates.length === 0) {
      throw new Error(`No active Mono-linked account found for accountNumber "${accountNumber}". Link it first via POST /bank-integration/mono/link.`);
    }
    if (candidates.length > 1) {
      throw new Error(
        `Ambiguous Mono-linked account for accountNumber "${accountNumber}" — ${candidates.length} active links matched across different entities. See resolveActiveLinkedAccount's doc comment.`,
      );
    }

    return candidates[0];
  }

  private async resolveConfig(): Promise<ResolvedMonoConfig> {
    const providerId = process.env.BANK_MONO_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'BANK_MONO_PROVIDER_ID is not set. Create an IntegrationProvider (category BANKING, providerCode "MONO") with credentials {secretKey}, then set BANK_MONO_PROVIDER_ID to its id.',
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
