import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IfrsNarrativeNoteType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { SchedulingService } from '../pmo/scheduling.service';
import { RiskIssueService } from '../pmo/risk-issue.service';

/** Row shape of vw_statement_profit_loss (see sql/views/vw_statement_profit_loss.sql). */
export interface ProfitAndLossViewRow {
  account_id: string;
  account_code: string;
  account_name: string;
  statement_section: string;
  amount: number;
  period_name: string;
}

/** Row shape of vw_statement_of_financial_position (see sql/views/vw_statement_of_financial_position.sql). */
export interface FinancialPositionViewRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_category: string;
  ifrs_mapping: string | null;
  statement_section: string;
  opening_balance: number;
  closing_balance: number;
  period_name: string;
}

/** Row shape of vw_statement_cash_flow (see sql/views/vw_statement_cash_flow.sql). */
export interface CashFlowViewRow {
  account_id: string;
  account_name: string;
  ifrs_mapping: string | null;
  account_category: string;
  account_type: string;
  cash_flow_section: string;
  opening_balance: number;
  period_net_movement: number;
  closing_balance: number;
}

/** Row shape of vw_statement_changes_in_equity (see sql/views/vw_statement_changes_in_equity.sql). */
export interface ChangesInEquityViewRow {
  account_id: string;
  account_name: string;
  account_category: string;
  ifrs_mapping: string | null;
  period_name: string;
  opening_balance: number;
  period_net_movement: number;
  closing_balance: number;
}

/** Row shape of vw_crm_pipeline (see sql/views/vw_crm_pipeline.sql). */
export interface CrmPipelineViewRow {
  lead_id: string;
  entity_id: string;
  lead_name: string;
  source: string;
  lead_status: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  prospect_id: string | null;
  prospect_status: string | null;
  budget_min: number | null;
  budget_max: number | null;
  lost_reason: string | null;
  days_in_pipeline: number;
}

/** Release (Fixed Assets Core) — row shape of vw_fixed_asset_register. */
export interface FixedAssetRegisterViewRow {
  fixed_asset_id: string;
  entity_id: string;
  asset_tag: string;
  asset_name: string;
  category_name: string;
  acquisition_date: Date;
  acquisition_cost: number;
  residual_value: number;
  useful_life_years: number;
  status: string;
  department_id: string | null;
  cost_center_id: string | null;
  location_name: string | null;
  last_depreciated_period: Date | null;
  accumulated_depreciation: number;
  net_book_value: number;
}

/**
 * Phase 3B — Statement of Changes in Equity components. The schema's
 * AccountCategory enum only distinguishes SHARE_CAPITAL / RETAINED_EARNINGS
 * / OTHER_EQUITY; these six are recovered from ifrs_mapping/account_name
 * via `classifyEquityRow`, same heuristic pattern as
 * vw_financial_ratios/buildCashFlow use for their own finer distinctions.
 */
type EquityComponent =
  | 'shareCapital'
  | 'sharePremium'
  | 'retainedEarnings'
  | 'revaluationReserve'
  | 'foreignCurrencyTranslationReserve'
  | 'otherReserves';

const EQUITY_COMPONENTS: EquityComponent[] = [
  'shareCapital',
  'sharePremium',
  'retainedEarnings',
  'revaluationReserve',
  'foreignCurrencyTranslationReserve',
  'otherReserves',
];

type EquityRow = Record<EquityComponent, number> & { total: number };

// Thin read-only wrappers around the views in sql/views/*.sql. All
// queries use Prisma's tagged-template $queryRaw, which parameterizes
// interpolated values automatically — entityId below is never
// string-concatenated into the SQL.
//
// Phase 2: these views can't be filtered with RowLevelSecurityService's
// Prisma `where`-object output (they're raw SQL, not a Prisma model query),
// so each method instead calls `assertEntityAccess` up front — the same
// canAccess() check the Prisma-backed modules use, just invoked directly
// against the single entityId every report is parameterized by.
/**
 * Same account-name/ifrs_mapping heuristic used throughout Phase 3A
 * (see vw_financial_ratios.sql's header comment) to recover a
 * finer-grained role than account_category alone provides. Centralized
 * here so the Cash Flow statement and the Ratios view apply an
 * identical rule rather than two subtly different ones.
 */
function nameMatches(row: { ifrs_mapping: string | null; account_name: string }, ...needles: string[]): boolean {
  const haystack = `${row.ifrs_mapping ?? ''} ${row.account_name}`.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly scheduling: SchedulingService,
    private readonly riskIssue: RiskIssueService,
  ) {}

  private assertEntityAccess(scope: SecurityScope, entityId: string) {
    if (!this.rowLevelSecurity.canAccess(scope, { entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new ForbiddenException(`No access to reporting data for entity ${entityId}`);
    }
  }

  budgetVsActual(scope: SecurityScope, entityId: string, fiscalYear?: number) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_budget_vs_actual
        WHERE entity_id = ${entityId}
        ${fiscalYear ? Prisma.sql`AND fiscal_year = ${fiscalYear}` : Prisma.empty}
        ORDER BY account_code
      `,
    );
  }

  projectProfitability(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_project_profitability WHERE entity_id = ${entityId} ORDER BY profit_amount DESC`,
    );
  }

  vendorAging(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_vendor_aging WHERE entity_id = ${entityId} ORDER BY days_past_due DESC`,
    );
  }

  customerAging(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_customer_aging WHERE entity_id = ${entityId} ORDER BY days_past_due DESC`,
    );
  }

  cashForecast(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_cash_forecast WHERE entity_id = ${entityId} ORDER BY horizon_days`,
    );
  }

  bankReconciliationSummary(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_bank_reconciliation_summary WHERE entity_id = ${entityId}`,
    );
  }

  consolidatedTrialBalance(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_consolidated_trial_balance WHERE entity_id = ${entityId} ORDER BY account_code`,
    );
  }

  // ---------------------------------------------------------------------
  // Phase 3A — IFRS & Statutory Financial Reporting
  // ---------------------------------------------------------------------

  /**
   * Statutory, period-scoped Trial Balance (vw_trial_balance): opening
   * balance, period debit/credit movement, and closing balance per
   * account, for one entity and (optionally) one fiscal period. Omitting
   * fiscalPeriodId returns every period on record for the entity, which
   * is what multi-period / comparative reporting reads from.
   */
  trialBalance(scope: SecurityScope, entityId: string, fiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_trial_balance
        WHERE entity_id = ${entityId}
        ${fiscalPeriodId ? Prisma.sql`AND fiscal_period_id = ${fiscalPeriodId}` : Prisma.empty}
        ORDER BY period_start, account_code
      `,
    );
  }

  /**
   * Line-level General Ledger report (vw_general_ledger) with a running
   * balance per account, optionally narrowed to a single account and/or
   * date range. Backs both the "General Ledger Report" (all accounts) and
   * "Account Ledger" (accountId supplied) deliverables from the same view.
   */
  generalLedger(
    scope: SecurityScope,
    entityId: string,
    filters: { accountId?: string; fiscalPeriodId?: string; dateFrom?: string; dateTo?: string } = {},
  ) {
    this.assertEntityAccess(scope, entityId);
    const { accountId, fiscalPeriodId, dateFrom, dateTo } = filters;
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_general_ledger
        WHERE entity_id = ${entityId}
        ${accountId ? Prisma.sql`AND account_id = ${accountId}` : Prisma.empty}
        ${fiscalPeriodId ? Prisma.sql`AND fiscal_period_id = ${fiscalPeriodId}` : Prisma.empty}
        ${dateFrom ? Prisma.sql`AND entry_date >= ${new Date(dateFrom)}` : Prisma.empty}
        ${dateTo ? Prisma.sql`AND entry_date <= ${new Date(dateTo)}` : Prisma.empty}
        ORDER BY entry_date, journal_number, line_number
      `,
    );
  }

  /**
   * Statement of Profit or Loss for one entity, one fiscal period (a period
   * flow, not a cumulative balance — see vw_statement_profit_loss's header
   * comment). Pass comparativeFiscalPeriodId to get last year's/last
   * period's figures alongside the current ones for comparative reporting.
   */
  async statementOfProfitOrLoss(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildProfitOrLoss(entityId, fiscalPeriodId);
    if (!comparativeFiscalPeriodId) return { current };
    const comparative = await this.buildProfitOrLoss(entityId, comparativeFiscalPeriodId);
    return { current, comparative };
  }

  /**
   * Statement of Financial Position for one entity as at the end of one
   * fiscal period (a point-in-time snapshot — uses closing_balance, see
   * vw_statement_of_financial_position's header comment). Pass
   * comparativeFiscalPeriodId for a prior-period comparative column.
   *
   * `balances` mirrors ConsolidationService.getConsolidatedBalanceSheet's
   * own honesty check: total assets vs total liabilities + equity. This
   * repo has no year-end close journal that sweeps REVENUE/EXPENSE into
   * Retained Earnings, so within a fiscal year `balances` will correctly
   * read false until either a closing entry is posted or the caller adds
   * the current period's net income themselves — this method reports the
   * ledger as it stands rather than injecting a computed plug figure.
   */
  async statementOfFinancialPosition(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildFinancialPosition(entityId, fiscalPeriodId);
    if (!comparativeFiscalPeriodId) return { current };
    const comparative = await this.buildFinancialPosition(entityId, comparativeFiscalPeriodId);
    return { current, comparative };
  }

  private async fetchPlRows(entityId: string, fiscalPeriodId: string): Promise<ProfitAndLossViewRow[]> {
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_statement_profit_loss
        WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId}
        ORDER BY account_code
      `,
    );
  }

  private async buildProfitOrLoss(entityId: string, fiscalPeriodId: string) {
    const rows = await this.fetchPlRows(entityId, fiscalPeriodId);

    const section = (name: string) => rows.filter((r) => r.statement_section === name);
    const sum = (list: ProfitAndLossViewRow[]) => list.reduce((total, r) => total + Number(r.amount), 0);

    const revenue = section('REVENUE');
    const costOfSales = section('COST_OF_SALES');
    const operatingExpense = section('OPERATING_EXPENSE');
    const financeExpense = section('FINANCE_EXPENSE');
    const taxExpense = section('TAX_EXPENSE');

    const totalRevenue = sum(revenue);
    const totalCostOfSales = sum(costOfSales);
    const grossProfit = totalRevenue - totalCostOfSales;
    const totalOperatingExpense = sum(operatingExpense);
    const operatingProfit = grossProfit - totalOperatingExpense;
    const totalFinanceExpense = sum(financeExpense);
    const profitBeforeTax = operatingProfit - totalFinanceExpense;
    const totalTaxExpense = sum(taxExpense);
    const netProfit = profitBeforeTax - totalTaxExpense;

    return {
      entityId,
      fiscalPeriodId,
      periodName: rows[0]?.period_name ?? null,
      revenue,
      totalRevenue,
      costOfSales,
      totalCostOfSales,
      grossProfit,
      operatingExpense,
      totalOperatingExpense,
      operatingProfit,
      financeExpense,
      totalFinanceExpense,
      profitBeforeTax,
      taxExpense,
      totalTaxExpense,
      netProfit,
    };
  }

  private async fetchSofpRows(entityId: string, fiscalPeriodId: string): Promise<FinancialPositionViewRow[]> {
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_statement_of_financial_position
        WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId}
        ORDER BY account_code
      `,
    );
  }

  private async buildFinancialPosition(entityId: string, fiscalPeriodId: string) {
    const rows = await this.fetchSofpRows(entityId, fiscalPeriodId);

    const section = (name: string) => rows.filter((r) => r.statement_section === name);
    const sum = (list: FinancialPositionViewRow[]) =>
      list.reduce((total, r) => total + Number(r.closing_balance), 0);

    const currentAssets = section('ASSETS_CURRENT');
    const nonCurrentAssets = section('ASSETS_NON_CURRENT');
    const currentLiabilities = section('LIABILITIES_CURRENT');
    const nonCurrentLiabilities = section('LIABILITIES_NON_CURRENT');
    const equity = section('EQUITY');

    const totalCurrentAssets = sum(currentAssets);
    const totalNonCurrentAssets = sum(nonCurrentAssets);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalCurrentLiabilities = sum(currentLiabilities);
    const totalNonCurrentLiabilities = sum(nonCurrentLiabilities);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    const totalEquity = sum(equity);

    return {
      entityId,
      fiscalPeriodId,
      periodName: rows[0]?.period_name ?? null,
      currentAssets,
      totalCurrentAssets,
      nonCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      currentLiabilities,
      totalCurrentLiabilities,
      nonCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      equity,
      totalEquity,
      balances: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  /**
   * Statement of Cash Flows (vw_statement_cash_flow) for one entity, one
   * fiscal period. Supports both IAS 7 presentations:
   *  - INDIRECT (default): reconciles net profit to net cash from
   *    operations via non-cash addbacks and working-capital movements.
   *  - DIRECT: reconstructs the major operating cash receipt/payment
   *    lines (customers, suppliers, operating expenses, interest, tax)
   *    from the same underlying account movements.
   * Both methods are built from the exact same period_net_movement
   * figures, just partitioned differently, so operatingActivities is
   * guaranteed to match between them — verified below via
   * `reconcilesToIndirect` rather than assumed.
   */
  async statementOfCashFlows(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    method: 'INDIRECT' | 'DIRECT' = 'INDIRECT',
  ) {
    this.assertEntityAccess(scope, entityId);
    return this.buildCashFlow(entityId, fiscalPeriodId, method);
  }

  private async buildCashFlow(entityId: string, fiscalPeriodId: string, method: 'INDIRECT' | 'DIRECT') {
    const rows: CashFlowViewRow[] = await this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_statement_cash_flow
        WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId}
      `,
    );
    const { netProfit, totalOperatingExpense, totalFinanceExpense, totalTaxExpense, totalRevenue, totalCostOfSales } =
      await this.buildProfitOrLoss(entityId, fiscalPeriodId);

    const sumMovement = (list: CashFlowViewRow[]) => list.reduce((t, r) => t + Number(r.period_net_movement), 0);

    const cashRows = rows.filter((r) => r.cash_flow_section === 'CASH_AND_EQUIVALENTS');
    const openingCash = cashRows.reduce((t, r) => t + Number(r.opening_balance), 0);
    const closingCash = cashRows.reduce((t, r) => t + Number(r.closing_balance), 0);

    const depreciationAmortization = rows.filter(
      (r) => r.cash_flow_section === 'OPERATING_PL' && nameMatches(r, 'depreciation', 'amorti'),
    );
    const depreciationAddback = sumMovement(depreciationAmortization);

    const nonCashCurrentAssets = rows.filter(
      (r) => r.account_category === 'CURRENT_ASSET' && r.cash_flow_section !== 'CASH_AND_EQUIVALENTS',
    );
    const currentLiabilities = rows.filter((r) => r.account_category === 'CURRENT_LIABILITY');
    const workingCapitalChange = -sumMovement(nonCashCurrentAssets) + sumMovement(currentLiabilities);

    const operatingActivities = netProfit + depreciationAddback + workingCapitalChange;

    const investingRows = rows.filter((r) => r.cash_flow_section === 'INVESTING');
    const investingActivities = -sumMovement(investingRows);

    const financingRows = rows.filter((r) => r.cash_flow_section === 'FINANCING');
    const financingActivities = sumMovement(financingRows);

    const netChangeInCash = operatingActivities + investingActivities + financingActivities;
    const reconcilesToLedger = Math.abs(openingCash + netChangeInCash - closingCash) < 0.01;

    const base = {
      entityId,
      fiscalPeriodId,
      method,
      openingCash,
      operatingActivities,
      investingActivities,
      financingActivities,
      netChangeInCash,
      closingCash,
      reconcilesToLedger,
    };

    if (method === 'INDIRECT') {
      return {
        ...base,
        operating: { netProfit, depreciationAddback, workingCapitalChange },
        investing: { netMovementInNonCurrentAssets: -investingActivities },
        financing: { netMovementInFinancingAccounts: financingActivities },
      };
    }

    // DIRECT — same rows, partitioned by presumed trade role. Receivables/
    // Inventory/Payables identification reuses the vw_financial_ratios
    // heuristic (name/ifrs_mapping match), with an explicit "other"
    // bucket for anything the heuristic doesn't tag, so no movement is
    // silently dropped and the total is provably identical to INDIRECT.
    const receivables = nonCashCurrentAssets.filter((r) => nameMatches(r, 'receivable'));
    const inventory = nonCashCurrentAssets.filter((r) => nameMatches(r, 'inventory'));
    const otherCurrentAssets = nonCashCurrentAssets.filter(
      (r) => !nameMatches(r, 'receivable') && !nameMatches(r, 'inventory'),
    );
    const payables = currentLiabilities.filter((r) => nameMatches(r, 'payable'));
    const otherCurrentLiabilities = currentLiabilities.filter((r) => !nameMatches(r, 'payable'));

    const receivablesMovement = sumMovement(receivables);
    const inventoryMovement = sumMovement(inventory);
    const otherCurrentAssetMovement = sumMovement(otherCurrentAssets);
    const payablesMovement = sumMovement(payables);
    const otherCurrentLiabilityMovement = sumMovement(otherCurrentLiabilities);

    const cashReceivedFromCustomers = totalRevenue - receivablesMovement;
    const cashPaidToSuppliers = -(totalCostOfSales + inventoryMovement - payablesMovement);
    const cashPaidForOperatingExpenses = -(totalOperatingExpense - depreciationAddback);
    const netMovementInOtherWorkingCapital = -otherCurrentAssetMovement + otherCurrentLiabilityMovement;
    const interestPaid = -totalFinanceExpense;
    const taxPaid = -totalTaxExpense;

    const directOperatingTotal =
      cashReceivedFromCustomers +
      cashPaidToSuppliers +
      cashPaidForOperatingExpenses +
      netMovementInOtherWorkingCapital +
      interestPaid +
      taxPaid;

    return {
      ...base,
      operating: {
        cashReceivedFromCustomers,
        cashPaidToSuppliers,
        cashPaidForOperatingExpenses,
        netMovementInOtherWorkingCapital,
        interestPaid,
        taxPaid,
        // Must equal `operatingActivities` above by construction — both are
        // the same GL movements partitioned differently. If this is ever
        // false it means an account fell outside every bucket above, and
        // that should be investigated rather than hidden.
        reconcilesToIndirect: Math.abs(directOperatingTotal - operatingActivities) < 0.01,
      },
      investing: { netMovementInNonCurrentAssets: -investingActivities },
      financing: { netMovementInFinancingAccounts: financingActivities },
    };
  }

  /**
   * Financial Ratios (vw_financial_ratios) for one entity/fiscal period.
   * See that view's header comment for the documented heuristic used to
   * recover Inventory/Receivables/Payables/Debt/D&A from account_category,
   * which has no finer tag for those — ratios here inherit that caveat.
   */
  financialRatios(scope: SecurityScope, entityId: string, fiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_financial_ratios
        WHERE entity_id = ${entityId}
        ${fiscalPeriodId ? Prisma.sql`AND fiscal_period_id = ${fiscalPeriodId}` : Prisma.empty}
        ORDER BY period_start
      `,
    );
  }

  /**
   * Segment Reporting (vw_segment_reporting) across Entity, Project,
   * Department, Cost Centre, Funding Source, and Business Unit. Pass
   * segmentType to narrow to one dimension (e.g. 'PROJECT'); omitting it
   * returns all six, distinguished by the segment_type column.
   */
  segmentReporting(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    segmentType?: string,
  ) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_segment_reporting
        WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId}
        ${segmentType ? Prisma.sql`AND segment_type = ${segmentType}` : Prisma.empty}
        ORDER BY segment_type, segment_name
      `,
    );
  }

  // ---------------------------------------------------------------------
  // Phase 3B — Statement of Comprehensive Income & Changes in Equity
  // ---------------------------------------------------------------------

  /**
   * Statement of Comprehensive Income (IAS 1): Profit or Loss (reuses
   * buildProfitOrLoss verbatim — this is not a parallel P&L calculation)
   * plus Other Comprehensive Income. OCI is deliberately scoped to the two
   * IAS 1 example items this schema can actually identify — Revaluation
   * Reserve and Foreign Currency Translation Reserve movements, both
   * recovered via buildChangesInEquity's ifrs_mapping/name heuristic.
   * "Other Equity Reserves" movements are NOT included here because this
   * repo has no way to determine whether a given movement in that
   * catch-all bucket is genuinely OCI (e.g. FVOCI fair value gains) or a
   * transaction with owners — see buildChangesInEquity's doc comment.
   * Comparative period support mirrors every other Phase 3A/3B statement.
   */
  async statementOfComprehensiveIncome(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildComprehensiveIncome(entityId, fiscalPeriodId);
    if (!comparativeFiscalPeriodId) return { current };
    const comparative = await this.buildComprehensiveIncome(entityId, comparativeFiscalPeriodId);
    return { current, comparative };
  }

  /**
   * Statement of Changes in Equity (IAS 1): opening/movement/closing grid
   * across the six components in `EQUITY_COMPONENTS`. Built entirely from
   * vw_statement_changes_in_equity (itself built on
   * vw_statement_of_financial_position), so `closing` here is guaranteed
   * to tie back to the Balance Sheet's Equity section —
   * `reconcilesToBalanceSheet` checks this explicitly rather than
   * assuming it.
   */
  async statementOfChangesInEquity(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildChangesInEquity(entityId, fiscalPeriodId);
    if (!comparativeFiscalPeriodId) return { current };
    const comparative = await this.buildChangesInEquity(entityId, comparativeFiscalPeriodId);
    return { current, comparative };
  }

  private async buildComprehensiveIncome(entityId: string, fiscalPeriodId: string) {
    const profitOrLoss = await this.buildProfitOrLoss(entityId, fiscalPeriodId);
    const equity = await this.buildChangesInEquity(entityId, fiscalPeriodId, profitOrLoss.netProfit);

    const oci = {
      revaluationReserve: equity.oci.revaluationReserve,
      foreignCurrencyTranslationReserve: equity.oci.foreignCurrencyTranslationReserve,
      total: equity.oci.revaluationReserve + equity.oci.foreignCurrencyTranslationReserve,
    };
    const totalComprehensiveIncome = profitOrLoss.netProfit + oci.total;

    return { ...profitOrLoss, oci, totalComprehensiveIncome };
  }

  /**
   * Classifies one vw_statement_changes_in_equity row into an
   * EquityComponent (and flags whether it's a dividend movement, which is
   * a transaction with owners, not OCI or retained profit). Documented
   * limitation, same class as vw_financial_ratios': an equity account
   * named/mapped unconventionally (not matching 'premium'/'revalu'/
   * 'translation'/'dividend') falls into the broadest applicable bucket
   * (shareCapital or otherReserves) rather than being dropped — nothing
   * is silently excluded from the statement, but a misnamed account could
   * land in the wrong column.
   */
  private classifyEquityRow(row: ChangesInEquityViewRow): { component: EquityComponent; isDividend: boolean } {
    if (row.account_category === 'SHARE_CAPITAL') {
      return { component: nameMatches(row, 'premium') ? 'sharePremium' : 'shareCapital', isDividend: false };
    }
    if (row.account_category === 'RETAINED_EARNINGS') {
      return { component: 'retainedEarnings', isDividend: nameMatches(row, 'dividend') };
    }
    // OTHER_EQUITY
    if (nameMatches(row, 'revalu')) return { component: 'revaluationReserve', isDividend: false };
    if (nameMatches(row, 'translation', 'fctr', 'foreign currency')) {
      return { component: 'foreignCurrencyTranslationReserve', isDividend: false };
    }
    return { component: 'otherReserves', isDividend: false };
  }

  private emptyEquityRow(): EquityRow {
    return {
      shareCapital: 0,
      sharePremium: 0,
      retainedEarnings: 0,
      revaluationReserve: 0,
      foreignCurrencyTranslationReserve: 0,
      otherReserves: 0,
      total: 0,
    };
  }

  private withTotal(row: Omit<EquityRow, 'total'>): EquityRow {
    const total = EQUITY_COMPONENTS.reduce((sum, component) => sum + row[component], 0);
    return { ...row, total };
  }

  /**
   * Builds the Statement of Changes in Equity grid for one entity/period.
   *
   * `precomputedNetProfit`, when supplied by buildComprehensiveIncome
   * (which already ran buildProfitOrLoss for its own P&L section), avoids
   * this method re-running that same query; called on its own (from
   * statementOfChangesInEquity), it computes net profit itself.
   *
   * `otherMovements` is a plug (closing − opening − profitForYear − oci −
   * dividends) rather than a separately-identified figure, which is why
   * the grid always foots exactly: for shareCapital/sharePremium it *is*
   * the whole movement (this repo has no "share issuance" journal source
   * tag to separate it out further); for otherReserves it's the whole
   * movement (no OCI/dividend driver is assumed for that catch-all
   * bucket — see classifyEquityRow); for retainedEarnings/
   * revaluationReserve/foreignCurrencyTranslationReserve it should be ~0
   * and a nonzero value there flags a movement this heuristic couldn't
   * explain (e.g. a prior-period adjustment posted directly to Retained
   * Earnings) rather than being hidden.
   */
  private async buildChangesInEquity(entityId: string, fiscalPeriodId: string, precomputedNetProfit?: number) {
    const netProfit =
      precomputedNetProfit ?? (await this.buildProfitOrLoss(entityId, fiscalPeriodId)).netProfit;

    const rows: ChangesInEquityViewRow[] = await this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_statement_changes_in_equity
        WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId}
        ORDER BY account_code
      `,
    );

    const opening = this.emptyEquityRow();
    const closing = this.emptyEquityRow();
    const dividends = this.emptyEquityRow();
    const oci = this.emptyEquityRow();
    const profitForYear = this.emptyEquityRow();
    profitForYear.retainedEarnings = netProfit;

    for (const row of rows) {
      const { component, isDividend } = this.classifyEquityRow(row);
      opening[component] += Number(row.opening_balance);
      closing[component] += Number(row.closing_balance);

      if (isDividend) {
        dividends[component] += Number(row.period_net_movement);
      } else if (component === 'revaluationReserve' || component === 'foreignCurrencyTranslationReserve') {
        oci[component] += Number(row.period_net_movement);
      }
    }

    const otherMovements = this.emptyEquityRow();
    for (const component of EQUITY_COMPONENTS) {
      otherMovements[component] =
        closing[component] - opening[component] - profitForYear[component] - oci[component] - dividends[component];
    }

    const openingTotal = this.withTotal(opening);
    const closingTotal = this.withTotal(closing);

    // Cross-check against the Balance Sheet's own Equity total, same habit
    // as statementOfFinancialPosition's `balances` and
    // statementOfCashFlows' `reconcilesToLedger` — reported, not assumed.
    const position = await this.buildFinancialPosition(entityId, fiscalPeriodId);
    const reconcilesToBalanceSheet = Math.abs(position.totalEquity - closingTotal.total) < 0.01;

    return {
      entityId,
      fiscalPeriodId,
      periodName: rows[0]?.period_name ?? null,
      components: EQUITY_COMPONENTS,
      opening: openingTotal,
      profitForYear: this.withTotal(profitForYear),
      oci: this.withTotal(oci),
      dividends: this.withTotal(dividends),
      otherMovements: this.withTotal(otherMovements),
      closing: closingTotal,
      totalComprehensiveIncome: netProfit + oci.revaluationReserve + oci.foreignCurrencyTranslationReserve,
      reconcilesToBalanceSheet,
    };
  }

  // ---------------------------------------------------------------------
  // Phase 3C — IFRS Notes to the Financial Statements
  //
  // 21 of the 28 requested notes are built entirely from
  // vw_statement_of_financial_position / vw_statement_profit_loss (via
  // fetchSofpRows/fetchPlRows above — the exact same queries
  // statementOfFinancialPosition/statementOfProfitOrLoss already run, not
  // a re-derivation), classified by ifrs_mapping/account_name using the
  // same nameMatches() heuristic Phase 3A/3B established for
  // vw_financial_ratios and classifyEquityRow. No new SQL views were
  // needed — both views' header comments already describe them as built
  // to serve as "the Notes-to-Financial-Statements drill-down for any
  // balance-sheet line."
  //
  // The remaining 7 (Reporting Entity Information, Basis of Preparation,
  // Significant Accounting Policies, Related Party Transactions,
  // Commitments, Contingent Liabilities, Subsequent Events) are narrative
  // disclosures that by definition aren't derivable from journal postings
  // — see IfrsNoteDisclosure's schema doc comment — and are stored/edited
  // directly rather than computed.
  //
  // Deliberately NOT built: a bespoke "consolidated" notes aggregator.
  // vw_consolidated_trial_balance's own header comment warns it performs
  // no intercompany eliminations and says as much: building a second
  // consolidation on top of it here "would create a second, divergent
  // source of truth" — the real eliminated consolidation already lives in
  // the Consolidation module. ifrsNotesForEntities() below covers
  // multi-entity reporting (looping this same per-entity engine, each
  // entity's own unconsolidated figures); a true consolidated notes pack
  // is a follow-on that should call into ConsolidationService, not this
  // module.
  // ---------------------------------------------------------------------

  private static readonly GL_DERIVED_SOFP_NOTE_KEYS = [
    'propertyPlantEquipment',
    'intangibleAssets',
    'investmentProperty',
    'cashAndCashEquivalents',
    'tradeAndOtherReceivables',
    'inventories',
    'prepayments',
    'otherCurrentAssets',
    'tradeAndOtherPayables',
    'borrowings',
    'leaseLiabilities',
    'deferredRevenue',
    'shareCapital',
    'sharePremium',
    'retainedEarnings',
    'otherEquityReserves',
  ] as const;

  private static readonly GL_DERIVED_PL_NOTE_KEYS = [
    'revenueByCategory',
    'costOfSales',
    'operatingExpenses',
    'financeCosts',
    'incomeTax',
  ] as const;

  private static readonly NARRATIVE_NOTE_KEYS = [
    'reportingEntityInformation',
    'basisOfPreparation',
    'significantAccountingPolicies',
    'relatedPartyTransactions',
    'commitments',
    'contingentLiabilities',
    'subsequentEvents',
  ] as const;

  private static readonly NARRATIVE_NOTE_TYPE_BY_KEY: Record<
    (typeof ReportingService.NARRATIVE_NOTE_KEYS)[number],
    IfrsNarrativeNoteType
  > = {
    reportingEntityInformation: IfrsNarrativeNoteType.REPORTING_ENTITY_INFORMATION,
    basisOfPreparation: IfrsNarrativeNoteType.BASIS_OF_PREPARATION,
    significantAccountingPolicies: IfrsNarrativeNoteType.SIGNIFICANT_ACCOUNTING_POLICIES,
    relatedPartyTransactions: IfrsNarrativeNoteType.RELATED_PARTY_TRANSACTIONS,
    commitments: IfrsNarrativeNoteType.COMMITMENTS,
    contingentLiabilities: IfrsNarrativeNoteType.CONTINGENT_LIABILITIES,
    subsequentEvents: IfrsNarrativeNoteType.SUBSEQUENT_EVENTS,
  };

  static readonly IFRS_NOTE_KEYS = [
    ...ReportingService.GL_DERIVED_SOFP_NOTE_KEYS,
    ...ReportingService.GL_DERIVED_PL_NOTE_KEYS,
    ...ReportingService.NARRATIVE_NOTE_KEYS,
  ];

  /**
   * Classifies one Statement of Financial Position row into exactly one
   * note (or null — surfaced in `reconciliation.unclassified`, never
   * silently dropped; see the "missing account handling" tests). Order
   * matters: most-specific match wins, so e.g. "Lease Liability" is
   * checked before the generic liability bucket exists (there is no
   * generic liability bucket — every CURRENT_LIABILITY/NON_CURRENT_LIABILITY
   * row either matches a specific note or falls through to
   * `tradeAndOtherPayables` as the residual, same design as
   * `otherCurrentAssets` for assets).
   */
  private classifySofpRow(
    row: FinancialPositionViewRow,
  ): (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number] | null {
    if (row.account_category === 'SHARE_CAPITAL') {
      return nameMatches(row, 'premium') ? 'sharePremium' : 'shareCapital';
    }
    if (row.account_category === 'RETAINED_EARNINGS') return 'retainedEarnings';
    if (row.account_category === 'OTHER_EQUITY') return 'otherEquityReserves';

    if (nameMatches(row, 'lease liability', 'ifrs 16', 'right-of-use')) return 'leaseLiabilities';
    if (nameMatches(row, 'deferred revenue', 'contract liability', 'ifrs 15')) return 'deferredRevenue';
    if (nameMatches(row, 'loan', 'borrowing', 'facility', 'debenture', 'bond payable')) return 'borrowings';
    if (nameMatches(row, 'investment property', 'ias 40')) return 'investmentProperty';
    if (nameMatches(row, 'intangible', 'goodwill', 'software licence', 'software license', 'ias 38')) {
      return 'intangibleAssets';
    }
    if (nameMatches(row, 'property, plant', 'ppe', 'fixed asset', 'ias 16')) return 'propertyPlantEquipment';
    if (nameMatches(row, 'cash', 'bank', 'ias 7')) return 'cashAndCashEquivalents';
    if (nameMatches(row, 'prepaid', 'prepayment')) return 'prepayments';
    if (nameMatches(row, 'inventor', 'stock', 'ias 2')) return 'inventories';
    if (nameMatches(row, 'receivable', 'debtor', 'ifrs 9')) return 'tradeAndOtherReceivables';

    if (row.account_category === 'CURRENT_ASSET') return 'otherCurrentAssets';
    if (row.account_category === 'CURRENT_LIABILITY' || row.account_category === 'NON_CURRENT_LIABILITY') {
      return 'tradeAndOtherPayables';
    }
    return null; // e.g. an unmapped NON_CURRENT_ASSET — see reconciliation.unclassified
  }

  private classifyPlRow(row: ProfitAndLossViewRow): (typeof ReportingService.GL_DERIVED_PL_NOTE_KEYS)[number] | null {
    switch (row.statement_section) {
      case 'REVENUE':
        return 'revenueByCategory';
      case 'COST_OF_SALES':
        return 'costOfSales';
      case 'OPERATING_EXPENSE':
        return 'operatingExpenses';
      case 'FINANCE_EXPENSE':
        return 'financeCosts';
      case 'TAX_EXPENSE':
        return 'incomeTax';
      default:
        return null;
    }
  }

  /** The three notes that are asset *rollforwards* (cost, accumulated
   *  depreciation/amortisation, and net book value) rather than a flat
   *  balance — PPE, Intangibles, Investment Property. `contraNeedles`
   *  distinguishes the accumulated-depreciation/amortisation contra
   *  accounts from the gross cost accounts within the note's rows.
   *
   *  Honesty note: `netAdditionsAndDisposals` is a NET figure. Neither
   *  vw_statement_of_financial_position nor the underlying JournalLine
   *  grain tags an individual movement as "addition" vs "disposal" — that
   *  would need a transaction-type tag this schema doesn't carry. Reporting
   *  a fabricated gross split would be less honest than reporting the net
   *  movement and saying so, which is what this does.
   */
  private isRollforwardNoteKey(
    key: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number],
  ): key is 'propertyPlantEquipment' | 'intangibleAssets' | 'investmentProperty' {
    return key === 'propertyPlantEquipment' || key === 'intangibleAssets' || key === 'investmentProperty';
  }

  private buildRollforwardNote(rows: FinancialPositionViewRow[]) {
    const isContra = (r: FinancialPositionViewRow) =>
      nameMatches(r, 'accumulated depreciation', 'accum. depreciation', 'accumulated amortisation', 'accumulated amortization', 'accum. amort');
    const cost = rows.filter((r) => !isContra(r));
    const contra = rows.filter(isContra);
    const sum = (list: FinancialPositionViewRow[], field: 'opening_balance' | 'closing_balance') =>
      list.reduce((total, r) => total + Number(r[field]), 0);

    const openingCost = sum(cost, 'opening_balance');
    const closingCost = sum(cost, 'closing_balance');
    const openingAccumulatedDepreciation = sum(contra, 'opening_balance');
    const closingAccumulatedDepreciation = sum(contra, 'closing_balance');

    return {
      accounts: rows,
      openingCost,
      netAdditionsAndDisposals: closingCost - openingCost,
      closingCost,
      openingAccumulatedDepreciation,
      depreciationOrAmortisationChargeForYear: closingAccumulatedDepreciation - openingAccumulatedDepreciation,
      closingAccumulatedDepreciation,
      netBookValueOpening: openingCost - openingAccumulatedDepreciation,
      netBookValueClosing: closingCost - closingAccumulatedDepreciation,
    };
  }

  private buildFlatSofpNote(rows: FinancialPositionViewRow[]) {
    return {
      accounts: rows,
      openingTotal: rows.reduce((t, r) => t + Number(r.opening_balance), 0),
      closingTotal: rows.reduce((t, r) => t + Number(r.closing_balance), 0),
    };
  }

  private buildPlNote(rows: ProfitAndLossViewRow[]) {
    return {
      accounts: rows,
      total: rows.reduce((t, r) => t + Number(r.amount), 0),
    };
  }

  /** Builds every GL-derived note for one entity/period in a single pass
   *  over the SOFP and P&L rows (each row visited once, classified once —
   *  not once per note), plus the reconciliation cross-check. */
  private async buildIfrsNotesForPeriod(entityId: string, fiscalPeriodId: string) {
    const [sofpRows, plRows] = await Promise.all([
      this.fetchSofpRows(entityId, fiscalPeriodId),
      this.fetchPlRows(entityId, fiscalPeriodId),
    ]);

    const sofpByKey = new Map<string, FinancialPositionViewRow[]>();
    const unclassifiedSofp: FinancialPositionViewRow[] = [];
    for (const row of sofpRows) {
      const key = this.classifySofpRow(row);
      if (!key) {
        unclassifiedSofp.push(row);
        continue;
      }
      if (!sofpByKey.has(key)) sofpByKey.set(key, []);
      sofpByKey.get(key)!.push(row);
    }

    const plByKey = new Map<string, ProfitAndLossViewRow[]>();
    const unclassifiedPl: ProfitAndLossViewRow[] = [];
    for (const row of plRows) {
      const key = this.classifyPlRow(row);
      if (!key) {
        unclassifiedPl.push(row);
        continue;
      }
      if (!plByKey.has(key)) plByKey.set(key, []);
      plByKey.get(key)!.push(row);
    }

    const notes: Record<string, unknown> = {};
    for (const key of ReportingService.GL_DERIVED_SOFP_NOTE_KEYS) {
      const rows = sofpByKey.get(key) ?? [];
      notes[key] = this.isRollforwardNoteKey(key) ? this.buildRollforwardNote(rows) : this.buildFlatSofpNote(rows);
    }
    for (const key of ReportingService.GL_DERIVED_PL_NOTE_KEYS) {
      notes[key] = this.buildPlNote(plByKey.get(key) ?? []);
    }

    // Reconciliation: every classified-asset note's closingTotal (or NBV
    // for rollforwards) should sum to the same totalAssets
    // statementOfFinancialPosition reports — same "verified, not assumed"
    // habit as that method's own `balances` flag.
    const assetKeys: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number][] = [
      'propertyPlantEquipment', 'intangibleAssets', 'investmentProperty', 'cashAndCashEquivalents',
      'tradeAndOtherReceivables', 'inventories', 'prepayments', 'otherCurrentAssets',
    ];
    const liabilityKeys: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number][] = [
      'tradeAndOtherPayables', 'borrowings', 'leaseLiabilities', 'deferredRevenue',
    ];
    const equityKeys: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number][] = [
      'shareCapital', 'sharePremium', 'retainedEarnings', 'otherEquityReserves',
    ];
    const noteClosingTotal = (key: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number]) => {
      const note = notes[key] as { closingTotal?: number; netBookValueClosing?: number };
      return note.netBookValueClosing ?? note.closingTotal ?? 0;
    };
    const sumKeys = (keys: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number][]) =>
      keys.reduce((t, k) => t + noteClosingTotal(k), 0);

    const position = await this.buildFinancialPosition(entityId, fiscalPeriodId);
    const notesTotalAssets = sumKeys(assetKeys);
    const notesTotalLiabilities = sumKeys(liabilityKeys);
    const notesTotalEquity = sumKeys(equityKeys);

    return {
      periodName: sofpRows[0]?.period_name ?? plRows[0]?.period_name ?? null,
      notes,
      reconciliation: {
        unclassifiedSofpAccounts: unclassifiedSofp,
        unclassifiedPlAccounts: unclassifiedPl,
        notesTotalAssets,
        notesTotalLiabilities,
        notesTotalEquity,
        assetsReconcileToStatementOfFinancialPosition: Math.abs(notesTotalAssets - position.totalAssets) < 0.01,
        liabilitiesReconcileToStatementOfFinancialPosition:
          Math.abs(notesTotalLiabilities - position.totalLiabilities) < 0.01,
        equityReconcilesToStatementOfFinancialPosition: Math.abs(notesTotalEquity - position.totalEquity) < 0.01,
      },
    };
  }

  private async fetchNarrativeNotes(entityId: string, fiscalPeriodId: string) {
    const rows = await this.prisma.ifrsNoteDisclosure.findMany({ where: { entityId, fiscalPeriodId } });
    const byType = new Map(rows.map((r) => [r.noteType, r]));

    const notes: Record<string, unknown> = {};
    for (const key of ReportingService.NARRATIVE_NOTE_KEYS) {
      const noteType = ReportingService.NARRATIVE_NOTE_TYPE_BY_KEY[key];
      const row = byType.get(noteType);
      notes[key] = {
        content: row?.content ?? null,
        updatedAt: row?.updatedAt ?? null,
        isSet: !!row,
      };
    }
    return notes;
  }

  /**
   * All 28 IFRS notes for one entity/fiscal period. Pass
   * comparativeFiscalPeriodId to add a `comparative` column to every
   * GL-derived note, same convention as every other Phase 3A/3B statement
   * on this service. Narrative notes reflect the current period's
   * disclosure text only (there is no meaningful "comparative" figure for
   * free-text policy narrative the way there is for a balance).
   */
  async ifrsNotes(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    this.assertEntityAccess(scope, entityId);

    const current = await this.buildIfrsNotesForPeriod(entityId, fiscalPeriodId);
    const comparative = comparativeFiscalPeriodId
      ? await this.buildIfrsNotesForPeriod(entityId, comparativeFiscalPeriodId)
      : null;

    const notes: Record<string, unknown> = {};
    for (const key of [...ReportingService.GL_DERIVED_SOFP_NOTE_KEYS, ...ReportingService.GL_DERIVED_PL_NOTE_KEYS]) {
      notes[key] = comparative
        ? { current: current.notes[key], comparative: comparative.notes[key] }
        : { current: current.notes[key] };
    }
    Object.assign(notes, await this.fetchNarrativeNotes(entityId, fiscalPeriodId));

    return {
      entityId,
      fiscalPeriodId,
      periodName: current.periodName,
      comparativeFiscalPeriodId: comparativeFiscalPeriodId ?? null,
      comparativePeriodName: comparative?.periodName ?? null,
      notes,
      reconciliation: current.reconciliation,
    };
  }

  /** One named note (e.g. "propertyPlantEquipment") instead of the full
   *  pack — reuses ifrsNotes() rather than re-implementing note selection,
   *  since this is a reporting endpoint, not a hot path. */
  async ifrsNote(
    scope: SecurityScope,
    entityId: string,
    noteKey: string,
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    if (!(ReportingService.IFRS_NOTE_KEYS as readonly string[]).includes(noteKey)) {
      throw new NotFoundException(
        `Unknown IFRS note "${noteKey}". Valid keys: ${ReportingService.IFRS_NOTE_KEYS.join(', ')}`,
      );
    }
    const all = await this.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
    return {
      entityId: all.entityId,
      fiscalPeriodId: all.fiscalPeriodId,
      periodName: all.periodName,
      comparativeFiscalPeriodId: all.comparativeFiscalPeriodId,
      comparativePeriodName: all.comparativePeriodName,
      note: all.notes[noteKey],
    };
  }

  /**
   * Multi-entity IFRS notes: the full pack for every requested entity the
   * caller has access to. Each entity's figures are its own
   * unconsolidated notes (see the Phase 3C header comment above for why
   * this deliberately doesn't attempt elimination/consolidation itself).
   * Entities outside the caller's RLS scope are reported in
   * `deniedEntityIds` rather than failing the whole batch.
   */
  async ifrsNotesForEntities(
    scope: SecurityScope,
    entityIds: string[],
    fiscalPeriodId: string,
    comparativeFiscalPeriodId?: string,
  ) {
    const results: Record<string, Awaited<ReturnType<ReportingService['ifrsNotes']>>> = {};
    const deniedEntityIds: string[] = [];

    for (const entityId of entityIds) {
      try {
        results[entityId] = await this.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
      } catch (err) {
        if (err instanceof ForbiddenException) {
          deniedEntityIds.push(entityId);
          continue;
        }
        throw err;
      }
    }

    return { fiscalPeriodId, comparativeFiscalPeriodId: comparativeFiscalPeriodId ?? null, entities: results, deniedEntityIds };
  }

  /**
   * Same data as ifrsNotes(), reshaped for the three requested export
   * targets. No PDF engine is built here (explicitly out of scope) — this
   * returns structured data a renderer/exporter consumes.
   *   - 'pdf-ready': the nested ifrsNotes() shape as-is (hierarchical,
   *     matches how a statutory notes pack is actually organized/rendered).
   *   - 'excel-ready' / 'powerbi': one flat row per (note, period, account)
   *     — the shape both tools pivot well from.
   */
  async ifrsNotesExport(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    format: 'pdf-ready' | 'excel-ready' | 'powerbi',
    comparativeFiscalPeriodId?: string,
  ) {
    const result = await this.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
    if (format === 'pdf-ready') return result;

    type FlatRow = {
      noteKey: string;
      period: 'current' | 'comparative';
      accountCode: string | null;
      accountName: string | null;
      amount: number | null;
      content: string | null;
    };
    const flatRows: FlatRow[] = [];

    for (const key of [...ReportingService.GL_DERIVED_SOFP_NOTE_KEYS, ...ReportingService.GL_DERIVED_PL_NOTE_KEYS]) {
      const note = result.notes[key] as { current: unknown; comparative?: unknown };
      for (const [period, data] of [['current', note.current], ['comparative', note.comparative]] as const) {
        if (!data) continue;
        const accounts = (data as { accounts: FinancialPositionViewRow[] | ProfitAndLossViewRow[] }).accounts;
        for (const row of accounts) {
          const amount = 'closing_balance' in row ? Number(row.closing_balance) : Number((row as ProfitAndLossViewRow).amount);
          flatRows.push({
            noteKey: key,
            period,
            accountCode: row.account_code,
            accountName: row.account_name,
            amount,
            content: null,
          });
        }
      }
    }
    for (const key of ReportingService.NARRATIVE_NOTE_KEYS) {
      const note = result.notes[key] as { content: string | null };
      flatRows.push({ noteKey: key, period: 'current', accountCode: null, accountName: null, amount: null, content: note.content });
    }

    return {
      entityId: result.entityId,
      fiscalPeriodId: result.fiscalPeriodId,
      comparativeFiscalPeriodId: result.comparativeFiscalPeriodId,
      format,
      rows: flatRows,
    };
  }

  /**
   * Create/update one narrative note's content. Gated on gl.journal.post
   * (reused rather than adding a new permission code — see
   * ReportingController) since editing a statutory disclosure warrants
   * the same authority level as posting the ledger it accompanies.
   */
  async upsertIfrsNarrativeDisclosure(
    scope: SecurityScope,
    entityId: string,
    fiscalPeriodId: string,
    noteKey: (typeof ReportingService.NARRATIVE_NOTE_KEYS)[number],
    content: string,
    userId: string,
  ) {
    this.assertEntityAccess(scope, entityId);
    const noteType = ReportingService.NARRATIVE_NOTE_TYPE_BY_KEY[noteKey];
    if (!noteType) {
      throw new NotFoundException(
        `Unknown narrative note "${noteKey}". Valid keys: ${ReportingService.NARRATIVE_NOTE_KEYS.join(', ')}`,
      );
    }
    return this.prisma.ifrsNoteDisclosure.upsert({
      where: { entityId_fiscalPeriodId_noteType: { entityId, fiscalPeriodId, noteType } },
      create: { entityId, fiscalPeriodId, noteType, content, updatedById: userId },
      update: { content, updatedById: userId },
    });
  }

  // -------------------------------------------------------------------
  // PHASE 5A — Real Estate Analytics (additive). Reuses assertEntityAccess
  // and the same $queryRaw-over-view pattern as budgetVsActual() /
  // projectProfitability() above rather than introducing a new access
  // check or query style.
  // -------------------------------------------------------------------

  salesVelocity(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_sales_velocity
        WHERE entity_id = ${entityId}
        ${projectId ? Prisma.sql`AND project_id = ${projectId}` : Prisma.empty}
        ORDER BY sale_month DESC
      `,
    );
  }

  inventoryAgeing(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_inventory_ageing
        WHERE entity_id = ${entityId}
        ${projectId ? Prisma.sql`AND project_id = ${projectId}` : Prisma.empty}
        ORDER BY age_days DESC
      `,
    );
  }

  absorptionRate(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_absorption_rate
        WHERE entity_id = ${entityId}
        ${projectId ? Prisma.sql`AND project_id = ${projectId}` : Prisma.empty}
        ORDER BY sale_month DESC
      `,
    );
  }

  unsoldUnitsDashboard(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_unsold_units_dashboard WHERE entity_id = ${entityId} ORDER BY total_unsold_value DESC NULLS LAST`,
    );
  }

  // -------------------------------------------------------------------
  // Release — CRM Reporting Integration (additive). Reuses
  // assertEntityAccess and the same $queryRaw-over-view pattern as the
  // Real Estate Analytics block above.
  //
  // This is deliberately a *second*, RLS-scoped path onto the CRM funnel
  // alongside the pre-existing, unscoped CrmService.getCrmPipelineSummary()
  // that DashboardService.getCrmPipelineOverview() already calls directly
  // — exactly the situation DashboardService.getRealEstateAnalyticsOverview's
  // doc comment describes and explicitly declines to retrofit onto every
  // existing widget. Widening CrmService's own method to take a
  // SecurityScope, or changing the existing /dashboard/crm-pipeline
  // endpoint's contract, is out of scope for an additive release; this adds
  // the properly-scoped alternative instead, the same way Real Estate
  // Analytics did for sales/inventory data.
  // -------------------------------------------------------------------

  async crmPipeline(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);

    const rows = await this.prisma.$queryRaw<CrmPipelineViewRow[]>(
      Prisma.sql`SELECT * FROM vw_crm_pipeline WHERE entity_id = ${entityId}`,
    );

    const leadsByStatus: Record<string, number> = {};
    const leadsBySource: Record<string, number> = {};
    let openDaysTotal = 0;
    let openCount = 0;

    for (const row of rows) {
      leadsByStatus[row.lead_status] = (leadsByStatus[row.lead_status] ?? 0) + 1;
      leadsBySource[row.source] = (leadsBySource[row.source] ?? 0) + 1;
      if (row.lead_status !== 'CONVERTED') {
        openDaysTotal += row.days_in_pipeline;
        openCount += 1;
      }
    }

    const convertedLeads = leadsByStatus['CONVERTED'] ?? 0;
    const disqualifiedLeads = leadsByStatus['DISQUALIFIED'] ?? 0;
    const closedLeads = convertedLeads + disqualifiedLeads;

    const prospectRows = rows.filter((r) => r.prospect_id);
    const prospectsByStatus: Record<string, number> = {};
    let activePipelineValue = 0;
    let wonDaysTotal = 0;
    let wonCount = 0;

    for (const row of prospectRows) {
      const status = row.prospect_status as string;
      prospectsByStatus[status] = (prospectsByStatus[status] ?? 0) + 1;
      if (status !== 'WON' && status !== 'LOST') {
        activePipelineValue += Number(row.budget_max ?? row.budget_min ?? 0);
      }
      if (status === 'WON') {
        wonDaysTotal += row.days_in_pipeline;
        wonCount += 1;
      }
    }

    return {
      entityId,
      totalLeads: rows.length,
      leadsByStatus,
      leadsBySource,
      leadConversionRate: closedLeads > 0 ? convertedLeads / closedLeads : null,
      averageDaysInPipelineForOpenLeads: openCount > 0 ? openDaysTotal / openCount : null,
      totalProspects: prospectRows.length,
      prospectsByStatus,
      activePipelineValue,
      averageDaysToWin: wonCount > 0 ? wonDaysTotal / wonCount : null,
    };
  }

  /**
   * Release (Fixed Asset Reporting Integration) — statutory-grade asset
   * register: every fixed asset for the entity with its cost, accumulated
   * depreciation, and net book value as of the latest posted month,
   * grouped by category. Sits alongside — not replacing —
   * FixedAssetsService.getFixedAssetSummary's lighter Dashboard-widget
   * aggregation, same split as crmPipeline vs getCrmPipelineSummary above.
   */
  async fixedAssetRegister(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);

    const rows = await this.prisma.$queryRaw<FixedAssetRegisterViewRow[]>(
      Prisma.sql`SELECT * FROM vw_fixed_asset_register WHERE entity_id = ${entityId} ORDER BY asset_tag ASC`,
    );

    const byCategory: Record<string, { count: number; acquisitionCost: number; accumulatedDepreciation: number; netBookValue: number }> = {};
    let totalAcquisitionCost = 0;
    let totalAccumulatedDepreciation = 0;
    let totalNetBookValue = 0;

    for (const row of rows) {
      const bucket = byCategory[row.category_name] ?? {
        count: 0,
        acquisitionCost: 0,
        accumulatedDepreciation: 0,
        netBookValue: 0,
      };
      bucket.count += 1;
      bucket.acquisitionCost += Number(row.acquisition_cost);
      bucket.accumulatedDepreciation += Number(row.accumulated_depreciation);
      bucket.netBookValue += Number(row.net_book_value);
      byCategory[row.category_name] = bucket;

      totalAcquisitionCost += Number(row.acquisition_cost);
      totalAccumulatedDepreciation += Number(row.accumulated_depreciation);
      totalNetBookValue += Number(row.net_book_value);
    }

    return {
      entityId,
      assetCount: rows.length,
      byCategory,
      totalAcquisitionCost,
      totalAccumulatedDepreciation,
      totalNetBookValue,
      assets: rows,
    };
  }

  // -------------------------------------------------------------------
  // Release K — PMO Reporting Integration (additive). Unlike every report
  // above, this doesn't query a SQL view — it reuses
  // SchedulingService.getGanttData/computeEarnedValue and
  // RiskIssueService.getRiskIssueSummary directly (their own optional
  // `entityId` param, added in this same release, does the RLS-safe
  // filtering), since duplicating their Prisma queries or critical-path
  // math here would violate "never duplicate logic" for no benefit.
  // Deliberately does NOT call SchedulingService.computeCriticalPath —
  // that method recomputes AND persists ProjectTask.isCritical/
  // totalFloatDays as a side effect, which is not appropriate behaviour
  // for what should be a read-only report endpoint.
  // -------------------------------------------------------------------

  /** Schedule (Gantt shape) + EVM (PV/EV/AC/SV/CV/SPI/CPI) for one project. */
  async pmoProjectPerformance(scope: SecurityScope, entityId: string, projectId: string) {
    this.assertEntityAccess(scope, entityId);

    const [schedule, earnedValue] = await Promise.all([
      this.scheduling.getGanttData(projectId, entityId),
      this.scheduling.computeEarnedValue(projectId, undefined, entityId),
    ]);

    return { entityId, projectId, schedule, earnedValue };
  }

  /** Risk/issue register summary, optionally narrowed to one project. */
  async pmoRiskIssueRegister(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    const summary = await this.riskIssue.getRiskIssueSummary(projectId, entityId);
    return { entityId, projectId, ...summary };
  }

  /**
   * Release IA — every configured integration provider, worst-health-first.
   * No assertEntityAccess call: integration providers are system-wide
   * configuration (most have a null entityId), not RLS-scoped
   * transactional data — access is gated entirely by the
   * `integrations.view` permission on the controller.
   */
  integrationsOverview(entityId?: string) {
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_integrations_overview
        ${entityId ? Prisma.sql`WHERE entity_id = ${entityId}` : Prisma.empty}
        ORDER BY (last_health_check_ok IS FALSE) DESC, category ASC, name ASC
      `,
    );
  }

  /** Release IE.1, Checkpoint H — Payment Framework Reporting Integration.
   * Per-transaction detail with refunds netted out, complementing
   * PaymentsService.getOverview's per-status dashboard summary (Checkpoint G). */
  paymentTransactionsRegister(scope: SecurityScope, entityId: string, status?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_payment_transactions_register
        WHERE entity_id = ${entityId}
        ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty}
        ORDER BY created_at DESC
      `,
    );
  }

  /** Release IF.1, Checkpoint J — Bank Integration Framework Reporting
   * Integration. Per-linked-account detail (every status, not just
   * ACTIVE/REQUIRES_REAUTH), complementing
   * MonoLinkedAccountService.getOverview's dashboard summary (Checkpoint I) —
   * same Dashboard/Reporting split as paymentTransactionsRegister above. */
  monoLinkedAccountsRegister(scope: SecurityScope, entityId: string, status?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`
        SELECT * FROM vw_mono_linked_accounts_register
        WHERE entity_id = ${entityId}
        ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty}
        ORDER BY linked_at DESC
      `,
    );
  }
}
