import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IfrsNarrativeNoteType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { SchedulingService } from '../pmo/scheduling.service';
import { RiskIssueService } from '../pmo/risk-issue.service';

export interface ProfitAndLossViewRow {
  account_id: string;
  account_code: string;
  account_name: string;
  statement_section: string;
  amount: number;
  period_name: string;
}
export interface FinancialPositionViewRow {
  account_id: string; account_code: string; account_name: string; account_category: string;
  ifrs_mapping: string | null; statement_section: string; opening_balance: number; closing_balance: number; period_name: string;
}
export interface CashFlowViewRow {
  account_id: string; account_name: string; ifrs_mapping: string | null; account_category: string;
  account_type: string; cash_flow_section: string; opening_balance: number; period_net_movement: number; closing_balance: number;
}
export interface ChangesInEquityViewRow {
  account_id: string; account_name: string; account_category: string; ifrs_mapping: string | null;
  period_name: string; opening_balance: number; period_net_movement: number; closing_balance: number;
}
export interface CrmPipelineViewRow {
  lead_id: string; entity_id: string; lead_name: string; source: string; lead_status: string;
  assigned_to_id: string | null; assigned_to_name: string | null; prospect_id: string | null;
  prospect_status: string | null; budget_min: number | null; budget_max: number | null;
  lost_reason: string | null; days_in_pipeline: number;
}
export interface FixedAssetRegisterViewRow {
  fixed_asset_id: string; entity_id: string; asset_tag: string; asset_name: string; category_name: string;
  acquisition_date: Date; acquisition_cost: number; residual_value: number; useful_life_years: number;
  status: string; department_id: string | null; cost_center_id: string | null; location_name: string | null;
  last_depreciated_period: Date | null; accumulated_depreciation: number; net_book_value: number;
}

type EquityComponent = 'shareCapital' | 'sharePremium' | 'retainedEarnings' | 'revaluationReserve' | 'foreignCurrencyTranslationReserve' | 'otherReserves';
const EQUITY_COMPONENTS: EquityComponent[] = ['shareCapital','sharePremium','retainedEarnings','revaluationReserve','foreignCurrencyTranslationReserve','otherReserves'];
type EquityRow = Record<EquityComponent, number> & { total: number };

function nameMatches(row: { ifrs_mapping: string | null; account_name: string }, ...needles: string[]): boolean {
  const haystack = `${row.ifrs_mapping ?? ''} ${row.account_name}`.toLowerCase();
  return needles.some((needle) => {
    const escaped = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}`).test(haystack);
  });
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly scheduling: SchedulingService,
    private readonly riskIssue: RiskIssueService,
  ) {}

  private assertEntityAccess(scope: SecurityScope, entityId: string): void {
    if (!this.rowLevelSecurity.canAccess(scope, { entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new ForbiddenException(`No access to reporting data for entity ${entityId}`);
    }
  }

  async budgetVsActual(scope: SecurityScope, entityId: string, fiscalYear?: number) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_budget_vs_actual WHERE entity_id = ${entityId} ${fiscalYear !== undefined ? Prisma.sql`AND fiscal_year = ${fiscalYear}` : Prisma.empty} ORDER BY account_code`,
    );
  }
  async projectProfitability(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_project_profitability WHERE entity_id = ${entityId} ORDER BY profit_amount DESC`);
  }
  async vendorAging(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_vendor_aging WHERE entity_id = ${entityId} ORDER BY days_past_due DESC`);
  }
  async customerAging(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_customer_aging WHERE entity_id = ${entityId} ORDER BY days_past_due DESC`);
  }
  async cashForecast(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_cash_forecast WHERE entity_id = ${entityId} ORDER BY horizon_days`);
  }
  async bankReconciliationSummary(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_bank_reconciliation_summary WHERE entity_id = ${entityId}`);
  }
  async consolidatedTrialBalance(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_consolidated_trial_balance WHERE entity_id = ${entityId} ORDER BY account_code`);
  }

  async trialBalance(scope: SecurityScope, entityId: string, fiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_trial_balance WHERE entity_id = ${entityId} ${fiscalPeriodId ? Prisma.sql`AND fiscal_period_id = ${fiscalPeriodId}` : Prisma.empty} ORDER BY period_start, account_code`,
    );
  }

  async generalLedger(scope: SecurityScope, entityId: string, filters: { accountId?: string; fiscalPeriodId?: string; dateFrom?: string; dateTo?: string } = {}) {
    this.assertEntityAccess(scope, entityId);
    const { accountId, fiscalPeriodId, dateFrom, dateTo } = filters;
    return this.prisma.$queryRaw(
      Prisma.sql`SELECT * FROM vw_general_ledger WHERE entity_id = ${entityId}
        ${accountId ? Prisma.sql`AND account_id = ${accountId}` : Prisma.empty}
        ${fiscalPeriodId ? Prisma.sql`AND fiscal_period_id = ${fiscalPeriodId}` : Prisma.empty}
        ${dateFrom ? Prisma.sql`AND entry_date >= ${new Date(dateFrom)}` : Prisma.empty}
        ${dateTo ? Prisma.sql`AND entry_date <= ${new Date(dateTo)}` : Prisma.empty}
        ORDER BY entry_date, journal_number, line_number`,
    );
  }

  async statementOfProfitOrLoss(scope: SecurityScope, entityId: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildProfitOrLoss(entityId, fiscalPeriodId);
    if (!comparativeFiscalPeriodId) return { current };
    return { current, comparative: await this.buildProfitOrLoss(entityId, comparativeFiscalPeriodId) };
  }

  async statementOfFinancialPosition(scope: SecurityScope, entityId: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildFinancialPosition(entityId, fiscalPeriodId);
    if (!comparativeFiscalPeriodId) return { current };
    return { current, comparative: await this.buildFinancialPosition(entityId, comparativeFiscalPeriodId) };
  }

  private async fetchPlRows(entityId: string, fiscalPeriodId: string): Promise<ProfitAndLossViewRow[]> {
    return this.prisma.$queryRaw<ProfitAndLossViewRow[]>(Prisma.sql`SELECT * FROM vw_statement_profit_loss WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId} ORDER BY account_code`);
  }

  private async buildProfitOrLoss(entityId: string, fiscalPeriodId: string) {
    const rows = await this.fetchPlRows(entityId, fiscalPeriodId);
    const section = (name: string) => rows.filter((r) => r.statement_section === name);
    const sum = (list: ProfitAndLossViewRow[]) => list.reduce((total, r) => total + Number(r.amount), 0);
    const revenue = section('REVENUE'), costOfSales = section('COST_OF_SALES'), operatingExpense = section('OPERATING_EXPENSE');
    const financeExpense = section('FINANCE_EXPENSE'), taxExpense = section('TAX_EXPENSE');
    const totalRevenue = sum(revenue), totalCostOfSales = sum(costOfSales), totalOperatingExpense = sum(operatingExpense);
    const grossProfit = totalRevenue - totalCostOfSales, operatingProfit = grossProfit - totalOperatingExpense;
    const totalFinanceExpense = sum(financeExpense), profitBeforeTax = operatingProfit - totalFinanceExpense;
    const totalTaxExpense = sum(taxExpense), netProfit = profitBeforeTax - totalTaxExpense;
    return { entityId, fiscalPeriodId, periodName: rows[0]?.period_name ?? null, revenue, totalRevenue, costOfSales, totalCostOfSales, grossProfit, operatingExpense, totalOperatingExpense, operatingProfit, financeExpense, totalFinanceExpense, profitBeforeTax, taxExpense, totalTaxExpense, netProfit };
  }

  private async fetchSofpRows(entityId: string, fiscalPeriodId: string): Promise<FinancialPositionViewRow[]> {
    return this.prisma.$queryRaw<FinancialPositionViewRow[]>(Prisma.sql`SELECT * FROM vw_statement_of_financial_position WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId} ORDER BY account_code`);
  }

  private async buildFinancialPosition(entityId: string, fiscalPeriodId: string) {
    const rows = await this.fetchSofpRows(entityId, fiscalPeriodId);

    const section = (name: string) =>
      rows.filter((r) => r.statement_section === name);

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
    const totalLiabilities =
      totalCurrentLiabilities + totalNonCurrentLiabilities;

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
      balances:
        Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }
  async statementOfCashFlows(scope: SecurityScope, entityId: string, fiscalPeriodId: string, method: 'INDIRECT' | 'DIRECT' = 'INDIRECT') {
    this.assertEntityAccess(scope, entityId);
    return this.buildCashFlow(entityId, fiscalPeriodId, method);
  }

  private async buildCashFlow(entityId: string, fiscalPeriodId: string, method: 'INDIRECT' | 'DIRECT') {
    const rows = await this.prisma.$queryRaw<CashFlowViewRow[]>(Prisma.sql`SELECT * FROM vw_statement_cash_flow WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId}`);
    const { netProfit, totalOperatingExpense, totalFinanceExpense, totalTaxExpense, totalRevenue, totalCostOfSales } = await this.buildProfitOrLoss(entityId, fiscalPeriodId);
    const sumMovement = (list: CashFlowViewRow[]) => list.reduce((t, r) => t + Number(r.period_net_movement), 0);
    const cashRows = rows.filter((r) => r.cash_flow_section === 'CASH_AND_EQUIVALENTS');
    const openingCash = cashRows.reduce((t, r) => t + Number(r.opening_balance), 0);
    const closingCash = cashRows.reduce((t, r) => t + Number(r.closing_balance), 0);
    const depreciationAmortization = rows.filter((r) => r.cash_flow_section === 'OPERATING_PL' && nameMatches(r, 'depreciation', 'amorti'));
    const depreciationAddback = sumMovement(depreciationAmortization);
    const nonCashCurrentAssets = rows.filter((r) => r.account_category === 'CURRENT_ASSET' && r.cash_flow_section !== 'CASH_AND_EQUIVALENTS');
    const currentLiabilities = rows.filter((r) => r.account_category === 'CURRENT_LIABILITY');
    const workingCapitalChange = -sumMovement(nonCashCurrentAssets) + sumMovement(currentLiabilities);
    const operatingActivities = netProfit + depreciationAddback + workingCapitalChange;
    const investingActivities = -sumMovement(rows.filter((r) => r.cash_flow_section === 'INVESTING'));
    const financingActivities = sumMovement(rows.filter((r) => r.cash_flow_section === 'FINANCING'));
    const netChangeInCash = operatingActivities + investingActivities + financingActivities;
    const base = { entityId, fiscalPeriodId, method, openingCash, operatingActivities, investingActivities, financingActivities, netChangeInCash, closingCash, reconcilesToLedger: Math.abs(openingCash + netChangeInCash - closingCash) < 0.01 };
    if (method === 'INDIRECT') return { ...base, operating: { netProfit, depreciationAddback, workingCapitalChange }, investing: { netMovementInNonCurrentAssets: -investingActivities }, financing: { netMovementInFinancingAccounts: financingActivities } };
    const receivables = nonCashCurrentAssets.filter((r) => nameMatches(r, 'receivable'));
    const inventory = nonCashCurrentAssets.filter((r) => nameMatches(r, 'inventory'));
    const otherCurrentAssets = nonCashCurrentAssets.filter((r) => !nameMatches(r, 'receivable') && !nameMatches(r, 'inventory'));
    const payables = currentLiabilities.filter((r) => nameMatches(r, 'payable'));
    const otherCurrentLiabilities = currentLiabilities.filter((r) => !nameMatches(r, 'payable'));
    const receivablesMovement = sumMovement(receivables), inventoryMovement = sumMovement(inventory), otherCurrentAssetMovement = sumMovement(otherCurrentAssets);
    const payablesMovement = sumMovement(payables), otherCurrentLiabilityMovement = sumMovement(otherCurrentLiabilities);
    const cashReceivedFromCustomers = totalRevenue - receivablesMovement;
    const cashPaidToSuppliers = -(totalCostOfSales + inventoryMovement - payablesMovement);
    const cashPaidForOperatingExpenses = -(totalOperatingExpense - depreciationAddback);
    const netMovementInOtherWorkingCapital = -otherCurrentAssetMovement + otherCurrentLiabilityMovement;
    const interestPaid = -totalFinanceExpense, taxPaid = -totalTaxExpense;
    const directOperatingTotal = cashReceivedFromCustomers + cashPaidToSuppliers + cashPaidForOperatingExpenses + netMovementInOtherWorkingCapital + interestPaid + taxPaid;
    return { ...base, operating: { cashReceivedFromCustomers, cashPaidToSuppliers, cashPaidForOperatingExpenses, netMovementInOtherWorkingCapital, interestPaid, taxPaid, reconcilesToIndirect: Math.abs(directOperatingTotal - operatingActivities) < 0.01 }, investing: { netMovementInNonCurrentAssets: -investingActivities }, financing: { netMovementInFinancingAccounts: financingActivities } };
  }

  async financialRatios(scope: SecurityScope, entityId: string, fiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_financial_ratios WHERE entity_id = ${entityId} ${fiscalPeriodId ? Prisma.sql`AND fiscal_period_id = ${fiscalPeriodId}` : Prisma.empty} ORDER BY period_start`);
  }
  async segmentReporting(scope: SecurityScope, entityId: string, fiscalPeriodId: string, segmentType?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_segment_reporting WHERE entity_id = ${entityId} AND fiscal_period_id = ${fiscalPeriodId} ${segmentType ? Prisma.sql`AND segment_type = ${segmentType}` : Prisma.empty} ORDER BY segment_type, segment_name`);
  }

  async statementOfComprehensiveIncome(scope: SecurityScope, entityId: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildComprehensiveIncome(entityId, fiscalPeriodId);
    return comparativeFiscalPeriodId ? { current, comparative: await this.buildComprehensiveIncome(entityId, comparativeFiscalPeriodId) } : { current };
  }
  async statementOfChangesInEquity(scope: SecurityScope, entityId: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildChangesInEquity(entityId, fiscalPeriodId);
    return comparativeFiscalPeriodId ? { current, comparative: await this.buildChangesInEquity(entityId, comparativeFiscalPeriodId) } : { current };
  }
  private async buildComprehensiveIncome(entityId: string, fiscalPeriodId: string) {
    const profitOrLoss = await this.buildProfitOrLoss(entityId, fiscalPeriodId);
    const equity = await this.buildChangesInEquity(entityId, fiscalPeriodId, profitOrLoss.netProfit);
    const oci = { revaluationReserve: equity.oci.revaluationReserve, foreignCurrencyTranslationReserve: equity.oci.foreignCurrencyTranslationReserve, total: equity.oci.revaluationReserve + equity.oci.foreignCurrencyTranslationReserve };
    return { ...profitOrLoss, oci, totalComprehensiveIncome: profitOrLoss.netProfit + oci.total };
  }
  private classifyEquityRow(row: ChangesInEquityViewRow): { component: EquityComponent; isDividend: boolean } {
    if (row.account_category === 'SHARE_CAPITAL') return { component: nameMatches(row, 'premium') ? 'sharePremium' : 'shareCapital', isDividend: false };
    if (row.account_category === 'RETAINED_EARNINGS') return { component: 'retainedEarnings', isDividend: nameMatches(row, 'dividend') };
    if (nameMatches(row, 'revalu')) return { component: 'revaluationReserve', isDividend: false };
    if (nameMatches(row, 'translation', 'fctr', 'foreign currency')) return { component: 'foreignCurrencyTranslationReserve', isDividend: false };
    return { component: 'otherReserves', isDividend: false };
  }
  private emptyEquityRow(): EquityRow {
    return { shareCapital: 0, sharePremium: 0, retainedEarnings: 0, revaluationReserve: 0, foreignCurrencyTranslationReserve: 0, otherReserves: 0, total: 0 };
  }
  private withTotal(row: Omit<EquityRow, 'total'>): EquityRow {
    return { ...row, total: EQUITY_COMPONENTS.reduce((sum, component) => sum + row[component], 0) };
  }
  private async buildChangesInEquity(
    entityId: string,
    fiscalPeriodId: string,
    precomputedNetProfit?: number,
  ) {
    const netProfit =
      precomputedNetProfit ??
      (await this.buildProfitOrLoss(entityId, fiscalPeriodId)).netProfit;

    const rows = await this.prisma.$queryRaw<ChangesInEquityViewRow[]>(
      Prisma.sql`
        SELECT *
        FROM vw_statement_changes_in_equity
        WHERE entity_id = ${entityId}
          AND fiscal_period_id = ${fiscalPeriodId}
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
      } else if (
        component === 'revaluationReserve' ||
        component === 'foreignCurrencyTranslationReserve'
      ) {
        oci[component] += Number(row.period_net_movement);
      }
    }

    const position = await this.buildFinancialPosition(
      entityId,
      fiscalPeriodId,
    );

    const retainedEarningsPosition = position.equity.find(
      (row) => row.account_category === 'RETAINED_EARNINGS',
    );

    if (retainedEarningsPosition) {
      opening.retainedEarnings = Number(
        retainedEarningsPosition.opening_balance,
      );
      closing.retainedEarnings = Number(
        retainedEarningsPosition.closing_balance,
      );
    }

    const otherMovements = this.emptyEquityRow();

    for (const component of EQUITY_COMPONENTS) {
      otherMovements[component] =
        closing[component] -
        opening[component] -
        profitForYear[component] -
        oci[component] -
        dividends[component];
    }

    const openingTotal = this.withTotal(opening);
    const closingTotal = this.withTotal(closing);

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
      totalComprehensiveIncome:
        netProfit +
        oci.revaluationReserve +
        oci.foreignCurrencyTranslationReserve,
      reconcilesToBalanceSheet:
        Math.abs(position.totalEquity - closingTotal.total) < 0.01,
    };
  }
  private static readonly GL_DERIVED_SOFP_NOTE_KEYS = ['propertyPlantEquipment','intangibleAssets','investmentProperty','cashAndCashEquivalents','tradeAndOtherReceivables','inventories','prepayments','otherCurrentAssets','tradeAndOtherPayables','borrowings','leaseLiabilities','deferredRevenue','shareCapital','sharePremium','retainedEarnings','otherEquityReserves'] as const;
  private static readonly GL_DERIVED_PL_NOTE_KEYS = ['revenueByCategory','costOfSales','operatingExpenses','financeCosts','incomeTax'] as const;
  private static readonly NARRATIVE_NOTE_KEYS = ['reportingEntityInformation','basisOfPreparation','significantAccountingPolicies','relatedPartyTransactions','commitments','contingentLiabilities','subsequentEvents'] as const;
  private static readonly NARRATIVE_NOTE_TYPE_BY_KEY: Record<(typeof ReportingService.NARRATIVE_NOTE_KEYS)[number], IfrsNarrativeNoteType> = {
    reportingEntityInformation: IfrsNarrativeNoteType.REPORTING_ENTITY_INFORMATION,
    basisOfPreparation: IfrsNarrativeNoteType.BASIS_OF_PREPARATION,
    significantAccountingPolicies: IfrsNarrativeNoteType.SIGNIFICANT_ACCOUNTING_POLICIES,
    relatedPartyTransactions: IfrsNarrativeNoteType.RELATED_PARTY_TRANSACTIONS,
    commitments: IfrsNarrativeNoteType.COMMITMENTS,
    contingentLiabilities: IfrsNarrativeNoteType.CONTINGENT_LIABILITIES,
    subsequentEvents: IfrsNarrativeNoteType.SUBSEQUENT_EVENTS,
  };
  static readonly IFRS_NOTE_KEYS = [...ReportingService.GL_DERIVED_SOFP_NOTE_KEYS, ...ReportingService.GL_DERIVED_PL_NOTE_KEYS, ...ReportingService.NARRATIVE_NOTE_KEYS];

  private classifySofpRow(row: FinancialPositionViewRow): (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number] | null {
    if (row.account_category === 'SHARE_CAPITAL') return nameMatches(row, 'premium') ? 'sharePremium' : 'shareCapital';
    if (row.account_category === 'RETAINED_EARNINGS') return 'retainedEarnings';
    if (row.account_category === 'OTHER_EQUITY') return 'otherEquityReserves';
    if (nameMatches(row, 'lease liability', 'ifrs 16', 'right-of-use')) return 'leaseLiabilities';
    if (nameMatches(row, 'deferred revenue', 'contract liability', 'ifrs 15')) return 'deferredRevenue';
    if (nameMatches(row, 'loan', 'borrowing', 'facility', 'debenture', 'bond payable')) return 'borrowings';
    if (nameMatches(row, 'investment property', 'ias 40')) return 'investmentProperty';
    if (nameMatches(row, 'intangible', 'goodwill', 'software licence', 'software license', 'ias 38')) return 'intangibleAssets';
    if (nameMatches(row, 'property, plant', 'ppe', 'fixed asset', 'ias 16')) return 'propertyPlantEquipment';
    if (nameMatches(row, 'cash', 'bank', 'ias 7')) return 'cashAndCashEquivalents';
    if (nameMatches(row, 'prepaid', 'prepayment')) return 'prepayments';
    if (nameMatches(row, 'inventor', 'stock', 'ias 2')) return 'inventories';
    if (nameMatches(row, 'receivable', 'debtor', 'ifrs 9')) return 'tradeAndOtherReceivables';
    if (row.account_category === 'CURRENT_ASSET') return 'otherCurrentAssets';
    if (row.account_category === 'CURRENT_LIABILITY' || row.account_category === 'NON_CURRENT_LIABILITY') return 'tradeAndOtherPayables';
    return null;
  }
  private classifyPlRow(row: ProfitAndLossViewRow): (typeof ReportingService.GL_DERIVED_PL_NOTE_KEYS)[number] | null {
    switch (row.statement_section) {
      case 'REVENUE': return 'revenueByCategory';
      case 'COST_OF_SALES': return 'costOfSales';
      case 'OPERATING_EXPENSE': return 'operatingExpenses';
      case 'FINANCE_EXPENSE': return 'financeCosts';
      case 'TAX_EXPENSE': return 'incomeTax';
      default: return null;
    }
  }
  private isRollforwardNoteKey(key: (typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS)[number]): key is 'propertyPlantEquipment' | 'intangibleAssets' | 'investmentProperty' {
    return key === 'propertyPlantEquipment' || key === 'intangibleAssets' || key === 'investmentProperty';
  }
  private buildRollforwardNote(rows: FinancialPositionViewRow[]) {
  const isContra = (r: FinancialPositionViewRow): boolean =>
    nameMatches(
      r,
      'accumulated depreciation',
      'accum. depreciation',
      'accumulated amortisation',
      'accumulated amortization',
      'accum. amort',
    );

  const costRows = rows.filter((r) => !isContra(r));
  const contraRows = rows.filter((r) => isContra(r));

  const sum = (
    list: FinancialPositionViewRow[],
    field: 'opening_balance' | 'closing_balance',
  ): number =>
    list.reduce(
      (total, row) => total + Number(row[field] ?? 0),
      0,
    );

  const openingCost = sum(costRows, 'opening_balance');
  const closingCost = sum(costRows, 'closing_balance');

  const openingAccumulatedDepreciation = sum(
    contraRows,
    'opening_balance',
  );

  const closingAccumulatedDepreciation = sum(
    contraRows,
    'closing_balance',
  );

  /*
   * Accumulated depreciation is stored as a negative contra-asset
   * balance in the statement-of-financial-position view.
   *
   * Therefore:
   *
   * NBV = Cost - Accumulated Depreciation
   *
   * Example:
   *   Opening: 1000 - (-200) = 1200
   *   Closing: 1400 - (-350) = 1750
   */
  const netBookValueOpening =
    openingCost - openingAccumulatedDepreciation;

  const netBookValueClosing =
    closingCost - closingAccumulatedDepreciation;

  /*
   * The depreciation/amortisation movement remains the movement
   * in the contra account itself.
   *
   * Example:
   *   -350 - (-200) = -150
   */
  const depreciationOrAmortisationChargeForYear =
    closingAccumulatedDepreciation -
    openingAccumulatedDepreciation;

  return {
    accounts: rows,

    openingCost,

    netAdditionsAndDisposals:
      closingCost - openingCost,

    closingCost,

    openingAccumulatedDepreciation,

    depreciationOrAmortisationChargeForYear,

    closingAccumulatedDepreciation,

    netBookValueOpening,

    netBookValueClosing,
  };
}
  private buildFlatSofpNote(rows: FinancialPositionViewRow[]) {
    return { accounts: rows, openingTotal: rows.reduce((t, r) => t + Number(r.opening_balance), 0), closingTotal: rows.reduce((t, r) => t + Number(r.closing_balance), 0) };
  }
  private buildPlNote(rows: ProfitAndLossViewRow[]) { return { accounts: rows, total: rows.reduce((t, r) => t + Number(r.amount), 0) }; }

  private async buildIfrsNotesForPeriod(entityId: string, fiscalPeriodId: string) {
    const [sofpRows, plRows] = await Promise.all([this.fetchSofpRows(entityId, fiscalPeriodId), this.fetchPlRows(entityId, fiscalPeriodId)]);
    const sofpByKey = new Map<string, FinancialPositionViewRow[]>(), unclassifiedSofp: FinancialPositionViewRow[] = [];
    for (const row of sofpRows) { const key = this.classifySofpRow(row); if (!key) { unclassifiedSofp.push(row); continue; } if (!sofpByKey.has(key)) sofpByKey.set(key, []); sofpByKey.get(key)!.push(row); }
    const plByKey = new Map<string, ProfitAndLossViewRow[]>(), unclassifiedPl: ProfitAndLossViewRow[] = [];
    for (const row of plRows) { const key = this.classifyPlRow(row); if (!key) { unclassifiedPl.push(row); continue; } if (!plByKey.has(key)) plByKey.set(key, []); plByKey.get(key)!.push(row); }
    const notes: Record<string, unknown> = {};
    for (const key of ReportingService.GL_DERIVED_SOFP_NOTE_KEYS) { const rows = sofpByKey.get(key) ?? []; notes[key] = this.isRollforwardNoteKey(key) ? this.buildRollforwardNote(rows) : this.buildFlatSofpNote(rows); }
    for (const key of ReportingService.GL_DERIVED_PL_NOTE_KEYS) notes[key] = this.buildPlNote(plByKey.get(key) ?? []);
    const assetKeys = ['propertyPlantEquipment','intangibleAssets','investmentProperty','cashAndCashEquivalents','tradeAndOtherReceivables','inventories','prepayments','otherCurrentAssets'] as const;
    const liabilityKeys = ['tradeAndOtherPayables','borrowings','leaseLiabilities','deferredRevenue'] as const;
    const equityKeys = ['shareCapital','sharePremium','retainedEarnings','otherEquityReserves'] as const;
      const noteClosingTotal = (
  key: typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS[number],
): number => {
  const rows = sofpByKey.get(key) ?? [];

  /*
   * Reconciliation must use the actual GL/view closing balances,
   * not the presentation value calculated by a rollforward note.
   *
   * For example, PPE may be presented as:
   *
   *   Cost:                    1,400
   *   Accumulated depreciation: -350
   *   Net book value:          1,750
   *
   * But the Statement of Financial Position is built directly from
   * the underlying account balances:
   *
   *   1,400 + (-350) = 1,050
   *
   * Therefore reconciliation must use the raw closing balances.
   */
  return rows.reduce(
    (total, row) => total + Number(row.closing_balance ?? 0),
    0,
  );
};

const sumKeys = (
  keys: readonly typeof ReportingService.GL_DERIVED_SOFP_NOTE_KEYS[number][],
): number =>
  keys.reduce(
    (total, key) => total + noteClosingTotal(key),
    0,
  );
      const position = await this.buildFinancialPosition(entityId, fiscalPeriodId);
      const unclassifiedSofpAssetsTotal = unclassifiedSofp.filter((r) => r.statement_section === 'ASSETS_CURRENT' || r.statement_section === 'ASSETS_NON_CURRENT').reduce((total, r) => total + Number(r.closing_balance), 0);
      return {
        periodName: sofpRows[0]?.period_name ?? plRows[0]?.period_name ?? null, notes,
        reconciliation: {
          unclassifiedSofpAccounts: unclassifiedSofp, unclassifiedPlAccounts: unclassifiedPl,
          notesTotalAssets: sumKeys(assetKeys), notesTotalLiabilities: sumKeys(liabilityKeys), notesTotalEquity: sumKeys(equityKeys), unclassifiedSofpAssetsTotal,
          assetsReconcileToStatementOfFinancialPosition: Math.abs(sumKeys(assetKeys) + unclassifiedSofpAssetsTotal - position.totalAssets) < 0.01,
          liabilitiesReconcileToStatementOfFinancialPosition: Math.abs(sumKeys(liabilityKeys) - position.totalLiabilities) < 0.01,
          equityReconcilesToStatementOfFinancialPosition: Math.abs(sumKeys(equityKeys) - position.totalEquity) < 0.01,
        },
      };
    }

  private async fetchNarrativeNotes(entityId: string, fiscalPeriodId: string) {
    const rows = await this.prisma.ifrsNoteDisclosure.findMany({ where: { entityId, fiscalPeriodId } });
    const byType = new Map(rows.map((r) => [r.noteType, r]));
    const notes: Record<string, unknown> = {};
    for (const key of ReportingService.NARRATIVE_NOTE_KEYS) {
      const row = byType.get(ReportingService.NARRATIVE_NOTE_TYPE_BY_KEY[key]);
      notes[key] = { content: row?.content ?? null, updatedAt: row?.updatedAt ?? null, isSet: !!row };
    }
    return notes;
  }

  async ifrsNotes(scope: SecurityScope, entityId: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    this.assertEntityAccess(scope, entityId);
    const current = await this.buildIfrsNotesForPeriod(entityId, fiscalPeriodId);
    const comparative = comparativeFiscalPeriodId ? await this.buildIfrsNotesForPeriod(entityId, comparativeFiscalPeriodId) : null;
    const notes: Record<string, unknown> = {};
    for (const key of [...ReportingService.GL_DERIVED_SOFP_NOTE_KEYS, ...ReportingService.GL_DERIVED_PL_NOTE_KEYS]) notes[key] = comparative ? { current: current.notes[key], comparative: comparative.notes[key] } : { current: current.notes[key] };
    Object.assign(notes, await this.fetchNarrativeNotes(entityId, fiscalPeriodId));
    return { entityId, fiscalPeriodId, periodName: current.periodName, comparativeFiscalPeriodId: comparativeFiscalPeriodId ?? null, comparativePeriodName: comparative?.periodName ?? null, notes, reconciliation: current.reconciliation };
  }

  async ifrsNote(scope: SecurityScope, entityId: string, noteKey: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    if (!(ReportingService.IFRS_NOTE_KEYS as readonly string[]).includes(noteKey)) throw new NotFoundException(`Unknown IFRS note "${noteKey}". Valid keys: ${ReportingService.IFRS_NOTE_KEYS.join(', ')}`);
    const all = await this.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
    return { entityId: all.entityId, fiscalPeriodId: all.fiscalPeriodId, periodName: all.periodName, comparativeFiscalPeriodId: all.comparativeFiscalPeriodId, comparativePeriodName: all.comparativePeriodName, note: all.notes[noteKey] };
  }

  async ifrsNotesForEntities(scope: SecurityScope, entityIds: string[], fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
    const results: Record<string, Awaited<ReturnType<ReportingService['ifrsNotes']>>> = {};
    const deniedEntityIds: string[] = [];
    for (const entityId of entityIds) {
      try { results[entityId] = await this.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId); }
      catch (err) { if (err instanceof ForbiddenException) { deniedEntityIds.push(entityId); continue; } throw err; }
    }
    return { fiscalPeriodId, comparativeFiscalPeriodId: comparativeFiscalPeriodId ?? null, entities: results, deniedEntityIds };
  }

  async ifrsNotesExport(scope: SecurityScope, entityId: string, fiscalPeriodId: string, format: 'pdf-ready' | 'excel-ready' | 'powerbi', comparativeFiscalPeriodId?: string) {
    const result = await this.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
    if (format === 'pdf-ready') return result;
    type FlatRow = { noteKey: string; period: 'current' | 'comparative'; accountCode: string | null; accountName: string | null; amount: number | null; content: string | null };
    const flatRows: FlatRow[] = [];
    for (const key of [...ReportingService.GL_DERIVED_SOFP_NOTE_KEYS, ...ReportingService.GL_DERIVED_PL_NOTE_KEYS]) {
      const note = result.notes[key] as { current: { accounts: Array<FinancialPositionViewRow | ProfitAndLossViewRow> }; comparative?: { accounts: Array<FinancialPositionViewRow | ProfitAndLossViewRow> } };
      for (const [period, data] of [['current', note.current], ['comparative', note.comparative]] as const) {
        if (!data) continue;
        for (const row of data.accounts) flatRows.push({ noteKey: key, period, accountCode: row.account_code, accountName: row.account_name, amount: 'closing_balance' in row ? Number(row.closing_balance) : Number(row.amount), content: null });
      }
    }
    for (const key of ReportingService.NARRATIVE_NOTE_KEYS) {
      const note = result.notes[key] as { content: string | null };
      flatRows.push({ noteKey: key, period: 'current', accountCode: null, accountName: null, amount: null, content: note.content });
    }
    return { entityId: result.entityId, fiscalPeriodId: result.fiscalPeriodId, comparativeFiscalPeriodId: result.comparativeFiscalPeriodId, format, rows: flatRows };
  }

  async upsertIfrsNarrativeDisclosure(scope: SecurityScope, entityId: string, fiscalPeriodId: string, noteKey: (typeof ReportingService.NARRATIVE_NOTE_KEYS)[number], content: string, userId: string) {
    this.assertEntityAccess(scope, entityId);
    const noteType = ReportingService.NARRATIVE_NOTE_TYPE_BY_KEY[noteKey];
    if (!noteType) throw new NotFoundException(`Unknown narrative note "${noteKey}". Valid keys: ${ReportingService.NARRATIVE_NOTE_KEYS.join(', ')}`);
    return this.prisma.ifrsNoteDisclosure.upsert({
      where: { entityId_fiscalPeriodId_noteType: { entityId, fiscalPeriodId, noteType } },
      create: { entityId, fiscalPeriodId, noteType, content, updatedById: userId },
      update: { content, updatedById: userId },
    });
  }

  async salesVelocity(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_sales_velocity WHERE entity_id = ${entityId} ${projectId ? Prisma.sql`AND project_id = ${projectId}` : Prisma.empty} ORDER BY sale_month DESC`);
  }
  async inventoryAgeing(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_inventory_ageing WHERE entity_id = ${entityId} ${projectId ? Prisma.sql`AND project_id = ${projectId}` : Prisma.empty} ORDER BY age_days DESC`);
  }
  async absorptionRate(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_absorption_rate WHERE entity_id = ${entityId} ${projectId ? Prisma.sql`AND project_id = ${projectId}` : Prisma.empty} ORDER BY sale_month DESC`);
  }
  async unsoldUnitsDashboard(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_unsold_units_dashboard WHERE entity_id = ${entityId} ORDER BY total_unsold_value DESC NULLS LAST`);
  }

  async crmPipeline(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    const rows = await this.prisma.$queryRaw<CrmPipelineViewRow[]>(Prisma.sql`SELECT * FROM vw_crm_pipeline WHERE entity_id = ${entityId}`);
    const leadsByStatus: Record<string, number> = {}, leadsBySource: Record<string, number> = {};
    let openDaysTotal = 0, openCount = 0;
    for (const row of rows) { leadsByStatus[row.lead_status] = (leadsByStatus[row.lead_status] ?? 0) + 1; leadsBySource[row.source] = (leadsBySource[row.source] ?? 0) + 1; if (row.lead_status !== 'CONVERTED') { openDaysTotal += Number(row.days_in_pipeline); openCount++; } }
    const convertedLeads = leadsByStatus.CONVERTED ?? 0, disqualifiedLeads = leadsByStatus.DISQUALIFIED ?? 0, closedLeads = convertedLeads + disqualifiedLeads;
    const prospectRows = rows.filter((r) => r.prospect_id), prospectsByStatus: Record<string, number> = {};
    let activePipelineValue = 0, wonDaysTotal = 0, wonCount = 0;
    for (const row of prospectRows) { const status = row.prospect_status ?? 'UNKNOWN'; prospectsByStatus[status] = (prospectsByStatus[status] ?? 0) + 1; if (status !== 'WON' && status !== 'LOST') activePipelineValue += Number(row.budget_max ?? row.budget_min ?? 0); if (status === 'WON') { wonDaysTotal += Number(row.days_in_pipeline); wonCount++; } }
    return { entityId, totalLeads: rows.length, leadsByStatus, leadsBySource, leadConversionRate: closedLeads > 0 ? convertedLeads / closedLeads : null, averageDaysInPipelineForOpenLeads: openCount > 0 ? openDaysTotal / openCount : null, totalProspects: prospectRows.length, prospectsByStatus, activePipelineValue, averageDaysToWin: wonCount > 0 ? wonDaysTotal / wonCount : null };
  }

  async fixedAssetRegister(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);
    const rows = await this.prisma.$queryRaw<FixedAssetRegisterViewRow[]>(Prisma.sql`SELECT * FROM vw_fixed_asset_register WHERE entity_id = ${entityId} ORDER BY asset_tag ASC`);
    const byCategory: Record<string, { count: number; acquisitionCost: number; accumulatedDepreciation: number; netBookValue: number }> = {};
    let totalAcquisitionCost = 0, totalAccumulatedDepreciation = 0, totalNetBookValue = 0;
    for (const row of rows) {
      const bucket = byCategory[row.category_name] ?? { count: 0, acquisitionCost: 0, accumulatedDepreciation: 0, netBookValue: 0 };
      bucket.count++; bucket.acquisitionCost += Number(row.acquisition_cost); bucket.accumulatedDepreciation += Number(row.accumulated_depreciation); bucket.netBookValue += Number(row.net_book_value); byCategory[row.category_name] = bucket;
      totalAcquisitionCost += Number(row.acquisition_cost); totalAccumulatedDepreciation += Number(row.accumulated_depreciation); totalNetBookValue += Number(row.net_book_value);
    }
    return { entityId, assetCount: rows.length, byCategory, totalAcquisitionCost, totalAccumulatedDepreciation, totalNetBookValue, assets: rows };
  }

  async pmoProjectPerformance(scope: SecurityScope, entityId: string, projectId: string) {
    this.assertEntityAccess(scope, entityId);
    const [schedule, earnedValue] = await Promise.all([this.scheduling.getGanttData(projectId, entityId), this.scheduling.computeEarnedValue(projectId, undefined, entityId)]);
    return { entityId, projectId, schedule, earnedValue };
  }
  async pmoRiskIssueRegister(scope: SecurityScope, entityId: string, projectId?: string) {
    this.assertEntityAccess(scope, entityId);
    return { entityId, projectId, ...(await this.riskIssue.getRiskIssueSummary(projectId, entityId)) };
  }
  integrationsOverview(entityId?: string) {
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_integrations_overview ${entityId ? Prisma.sql`WHERE entity_id = ${entityId}` : Prisma.empty} ORDER BY (last_health_check_ok IS FALSE) DESC, category ASC, name ASC`);
  }
  async paymentTransactionsRegister(scope: SecurityScope, entityId: string, status?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_payment_transactions_register WHERE entity_id = ${entityId} ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty} ORDER BY created_at DESC`);
  }
  async monoLinkedAccountsRegister(scope: SecurityScope, entityId: string, status?: string) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.$queryRaw(Prisma.sql`SELECT * FROM vw_mono_linked_accounts_register WHERE entity_id = ${entityId} ${status ? Prisma.sql`AND status = ${status}` : Prisma.empty} ORDER BY linked_at DESC`);
  }
}