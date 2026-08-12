import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MonoLinkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { MonoProvider } from './providers/mono.provider';
import { LinkMonoAccountDto } from './dto/link-mono-account.dto';
import { BankReconciliationService } from '../bank-reconciliation/bank-reconciliation.service';

/**
 * Release IF.1, Checkpoint C — Mono Connect account linking.
 *
 * The missing piece MonoProvider's Checkpoint B doc comment called out:
 * turns a Mono Connect widget's one-time `code` into a persisted
 * MonoLinkedAccount row, scoped to an existing BankAccount the same way
 * AccountsPayableService.findInvoice scopes a VendorInvoice — via
 * RowLevelSecurityService.canAccess() against the *related* BankAccount
 * (this table has no entityId column of its own), not an RlsBodyCheck
 * decorator (that decorator's own doc comment says to use canAccess()
 * directly for existing-row references like bankAccountId, rather than
 * a body field that names a new entity).
 *
 * validateAccount was a stub in MonoProvider through this checkpoint,
 * re-scoped and implemented independently in Checkpoint F — but
 * fetchStatement/fetchBalance were already implemented for real in
 * Checkpoint D, and this class now (Checkpoint E — Statement
 * Import & Balance Sync) puts them to use for the linked accounts this
 * class creates: getBalance() is a thin pass-through, and importStatement()
 * composes MonoProvider.fetchStatement + fetchBalance into the exact
 * ImportBankStatementDto shape BankReconciliationService.importStatement
 * already accepts — reusing that service entirely rather than writing a
 * second path that creates BankStatement rows.
 */
@Injectable()
export class MonoLinkedAccountService {
  private readonly logger = new Logger(MonoLinkedAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly monoProvider: MonoProvider,
    private readonly bankReconciliation: BankReconciliationService,
  ) {}

  async link(dto: LinkMonoAccountDto, linkedById: string, scope: SecurityScope) {
    const bankAccount = await this.assertBankAccountAccess(dto.bankAccountId, scope, 'post');

    const { monoAccountId } = await this.monoProvider.exchangeConnectCode(dto.code);

    const existing = await this.prisma.monoLinkedAccount.findUnique({ where: { monoAccountId } });
    if (existing) {
      throw new ConflictException('This Mono account is already linked to a bank account');
    }

    // Display-only metadata — a failure fetching it must not lose the
    // link that already succeeded above (see fetchAccountMeta's own doc
    // comment on why this is best-effort).
    let meta: { institutionName?: string; accountNumberMasked?: string; currency?: string } = {};
    try {
      meta = await this.monoProvider.fetchAccountMeta(monoAccountId);
    } catch (err) {
      this.logger.warn(`Linked Mono account ${monoAccountId} but could not fetch its display metadata: ${(err as Error).message}`);
    }

    return this.prisma.monoLinkedAccount.create({
      data: {
        bankAccountId: bankAccount.id,
        monoAccountId,
        institutionName: meta.institutionName,
        accountNumberMasked: meta.accountNumberMasked,
        currency: meta.currency,
        linkedById,
      },
    });
  }

  async findByBankAccount(bankAccountId: string, scope: SecurityScope) {
    await this.assertBankAccountAccess(bankAccountId, scope, 'view');
    return this.prisma.monoLinkedAccount.findMany({
      where: { bankAccountId },
      orderBy: { linkedAt: 'desc' },
    });
  }

  /**
   * Release IF.1, Checkpoint I — Dashboard integration: linked-account
   * counts by status, plus the two operationally-actionable lists an
   * admin actually needs surfaced — accounts Mono has flagged
   * REQUIRES_REAUTH (Checkpoint G) and ACTIVE accounts
   * MonoStatementSyncProcessor (Checkpoint H) hasn't synced recently.
   *
   * Entity-scoped rather than bank-account-scoped like
   * findByBankAccount above, since this is a rollup across every linked
   * account for an entity, not one account's own detail — checks RLS
   * against the caller-supplied entityId directly (ForbiddenException
   * on a miss), the exact same assertEntityAccess-shaped check
   * PaymentsService.getOverview uses for its own dashboard widget, NOT
   * the NotFoundException-on-miss pattern assertBankAccountAccess above
   * uses — that pattern exists to hide whether one specific *row*
   * (a bankAccountId someone might be guessing at) exists; there's no
   * equivalent row to hide here, the entityId itself is the caller's
   * own input.
   *
   * STALE_AFTER_HOURS is deliberately looser than
   * MonoStatementSyncProcessor's own 6-hour cadence — flagging every
   * account between 6 and 24 hours old would make a single missed or
   * still-in-flight scheduled run look like an incident when it isn't.
   */
  async getOverview(scope: SecurityScope, entityId: string) {
    if (!this.rowLevelSecurity.canAccess(scope, { entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new ForbiddenException(`No access to bank-linked-account data for entity ${entityId}`);
    }

    const STALE_AFTER_HOURS = 24;
    const staleCutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600 * 1000);

    const accounts = await this.prisma.monoLinkedAccount.findMany({
      where: { bankAccount: { entityId } },
      select: {
        id: true,
        institutionName: true,
        accountNumberMasked: true,
        status: true,
        lastSyncedAt: true,
        reauthRequiredAt: true,
      },
    });

    const byStatus = { ACTIVE: 0, REVOKED: 0, REQUIRES_REAUTH: 0 };
    for (const account of accounts) {
      byStatus[account.status] += 1;
    }

    const needsReauth = accounts
      .filter((account) => account.status === MonoLinkStatus.REQUIRES_REAUTH)
      .map((account) => ({
        id: account.id,
        institutionName: account.institutionName,
        accountNumberMasked: account.accountNumberMasked,
        reauthRequiredAt: account.reauthRequiredAt,
      }));

    const staleActiveAccounts = accounts
      .filter((account) => account.status === MonoLinkStatus.ACTIVE && (!account.lastSyncedAt || account.lastSyncedAt < staleCutoff))
      .map((account) => ({
        id: account.id,
        institutionName: account.institutionName,
        accountNumberMasked: account.accountNumberMasked,
        lastSyncedAt: account.lastSyncedAt,
      }));

    return {
      entityId,
      totalLinked: accounts.length,
      byStatus,
      needsReauth,
      staleActiveAccounts,
    };
  }

  async revoke(id: string, scope: SecurityScope) {
    const linked = await this.prisma.monoLinkedAccount.findUnique({
      where: { id },
      include: { bankAccount: true },
    });
    if (!linked) throw new NotFoundException('Linked Mono account not found');

    if (!this.rowLevelSecurity.canAccess(scope, { entityId: linked.bankAccount.entityId }, { dimensions: ['entity', 'businessUnit'], mode: 'post' })) {
      throw new NotFoundException('Linked Mono account not found');
    }

    if (linked.status === MonoLinkStatus.REVOKED) {
      return linked; // idempotent — already revoked, nothing further to do
    }

    return this.prisma.monoLinkedAccount.update({
      where: { id },
      data: { status: MonoLinkStatus.REVOKED, revokedAt: new Date() },
    });
  }

  /**
   * Release IF.1, Checkpoint G. Applies a MonoWebhookHandler `link_status`
   * event to the matching MonoLinkedAccount — looked up by
   * monoAccountId (BankWebhookHandler's providerAccountId), NOT this
   * table's own `id`, since Mono has no notion of our internal id.
   *
   * No SecurityScope/RLS check here, unlike every other method in this
   * class — same reasoning TwilioWebhookService.applyStatusCallback and
   * PaymentsService.applyWebhookEvent already establish: this is called
   * from an unauthenticated webhook route (BankWebhookController), not a
   * user request, so there is no scope to check against. Idempotent by
   * construction (re-applying the same status is a no-op update), so a
   * provider's documented at-least-once retry behaviour is safe.
   *
   * Silently no-ops (logs and returns) when no MonoLinkedAccount matches
   * the given monoAccountId — same posture PaymentsService.applyWebhookEvent
   * takes on an unmatched reference: a callback for an account this
   * system doesn't (or no longer) know about is not this method's error
   * to raise, and returning null lets the caller (BankWebhookController)
   * still respond 2xx so Mono doesn't retry a callback that will never
   * resolve to a match.
   */
  async applyLinkStatusWebhookEvent(monoAccountId: string, status: 'ACTIVE' | 'REQUIRES_REAUTH') {
    const linked = await this.prisma.monoLinkedAccount.findUnique({ where: { monoAccountId } });
    if (!linked) {
      this.logger.warn(`Received a Mono link-status webhook for unknown monoAccountId "${monoAccountId}" — no MonoLinkedAccount matches it`);
      return null;
    }
    if (linked.status === MonoLinkStatus.REVOKED) {
      // A revoked link is a deliberate, user-initiated end state (see
      // revoke() above) — a stray reauth-related callback arriving after
      // that must not resurrect it back to ACTIVE/REQUIRES_REAUTH.
      this.logger.warn(`Received a Mono link-status webhook (${status}) for monoAccountId "${monoAccountId}", but its MonoLinkedAccount is REVOKED — ignoring`);
      return linked;
    }

    return this.prisma.monoLinkedAccount.update({
      where: { monoAccountId },
      data: {
        status: status === 'REQUIRES_REAUTH' ? MonoLinkStatus.REQUIRES_REAUTH : MonoLinkStatus.ACTIVE,
        reauthRequiredAt: status === 'REQUIRES_REAUTH' ? new Date() : null,
      },
    });
  }

  private async assertBankAccountAccess(bankAccountId: string, scope: SecurityScope, mode: 'view' | 'post') {
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
    if (!bankAccount) throw new NotFoundException(`Bank account ${bankAccountId} not found`);

    // NotFoundException rather than ForbiddenException on a scope miss —
    // same information-hiding reasoning AccountsPayableService.findInvoice
    // already uses: a caller with no grant on this entity shouldn't be
    // able to distinguish "doesn't exist" from "not yours to see".
    if (!this.rowLevelSecurity.canAccess(scope, { entityId: bankAccount.entityId }, { dimensions: ['entity', 'businessUnit'], mode })) {
      throw new NotFoundException(`Bank account ${bankAccountId} not found`);
    }

    return bankAccount;
  }

  /** Resolves an ACTIVE linked account by id, RLS-checked against its BankAccount — same pattern as revoke(). */
  private async requireActiveLinkedAccount(id: string, scope: SecurityScope, mode: 'view' | 'post') {
    const linked = await this.prisma.monoLinkedAccount.findUnique({ where: { id }, include: { bankAccount: true } });
    if (!linked) throw new NotFoundException('Linked Mono account not found');

    if (!this.rowLevelSecurity.canAccess(scope, { entityId: linked.bankAccount.entityId }, { dimensions: ['entity', 'businessUnit'], mode })) {
      throw new NotFoundException('Linked Mono account not found');
    }
    if (linked.status !== MonoLinkStatus.ACTIVE) {
      throw new ConflictException(`Linked account ${id} is ${linked.status}, not ACTIVE`);
    }

    return linked;
  }

  /**
   * Release IF.1, Checkpoint E. Thin pass-through to
   * MonoProvider.fetchBalance for one specific linked account — the RLS
   * check + ACTIVE-status check are the only things this adds over
   * calling the provider directly.
   */
  async getBalance(linkedAccountId: string, scope: SecurityScope) {
    const linked = await this.requireActiveLinkedAccount(linkedAccountId, scope, 'view');
    // bankCode is part of BankProvider's shared interface but unused by
    // MonoProvider (BankAccount has no bankCode column — see
    // resolveActiveLinkedAccount's doc comment in mono.provider.ts).
    return this.monoProvider.fetchBalance({ accountNumber: linked.bankAccount.accountNumber, bankCode: '' });
  }

  /**
   * Release IF.1, Checkpoint E. Pulls a Mono statement for [fromDate,
   * toDate] and hands it to BankReconciliationService.importStatement —
   * the exact same BankStatement-creation path a manually-uploaded CSV
   * goes through (bank-statement-import.processor.ts), so reconciliation,
   * dashboard, and reporting all see a Mono-sourced statement no
   * differently from any other. This method's only job is translating
   * MonoProvider's shape into ImportBankStatementDto's.
   *
   * openingBalance is derived (closingBalance minus the net of this
   * period's lines) rather than fetched, since Mono has no
   * "balance-as-of-a-past-date" endpoint — only a current balance. This
   * is exact when toDate is "now" (the common case: pulling the latest
   * statement) and an approximation otherwise; documented here rather
   * than silently presented as exact.
   */
  async importStatement(linkedAccountId: string, fromDate: string, toDate: string, userId: string, scope: SecurityScope) {
    const linked = await this.requireActiveLinkedAccount(linkedAccountId, scope, 'post');
    const { accountNumber } = linked.bankAccount;

    const [lines, currentBalance] = await Promise.all([
      this.monoProvider.fetchStatement({ accountNumber, bankCode: '', fromDate, toDate }),
      this.monoProvider.fetchBalance({ accountNumber, bankCode: '' }),
    ]);

    if (lines.length === 0) {
      throw new ConflictException(`Mono reported no transactions for this account between ${fromDate} and ${toDate}`);
    }

    const netChange = lines.reduce((sum, line) => sum + line.amount, 0);
    const closingBalance = currentBalance.balance;
    const openingBalance = closingBalance - netChange;

    return this.bankReconciliation.importStatement(
      {
        entityId: linked.bankAccount.entityId,
        bankAccountId: linked.bankAccountId,
        statementDate: toDate,
        periodStart: fromDate,
        periodEnd: toDate,
        openingBalance,
        closingBalance,
        lines: lines.map((line) => ({
          transactionDate: line.transactionDate.toISOString(),
          description: line.description,
          reference: line.reference,
          amount: line.amount,
        })),
      },
      userId,
    );
  }
}
