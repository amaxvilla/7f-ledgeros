import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { PeriodSelector } from './PeriodSelector';
import { ExportCsvButton } from './ExportCsvButton';
import { PrintButton } from './PrintButton';
import { FinancialLineItemsTable, FinancialEquityTable } from './FinancialStatementsTables';

export const dynamic = 'force-dynamic';

interface LineItemRow {
  account_id: string;
  account_code: string;
  account_name: string;
  statement_section: string;
  amount?: number;
  closing_balance?: number;
}

interface ProfitOrLoss {
  periodName: string | null;
  revenue: LineItemRow[];
  totalRevenue: number;
  costOfSales: LineItemRow[];
  totalCostOfSales: number;
  grossProfit: number;
  operatingExpense: LineItemRow[];
  totalOperatingExpense: number;
  operatingProfit: number;
  financeExpense: LineItemRow[];
  totalFinanceExpense: number;
  profitBeforeTax: number;
  taxExpense: LineItemRow[];
  totalTaxExpense: number;
  netProfit: number;
}

interface FinancialPosition {
  periodName: string | null;
  currentAssets: LineItemRow[];
  totalCurrentAssets: number;
  nonCurrentAssets: LineItemRow[];
  totalNonCurrentAssets: number;
  totalAssets: number;
  currentLiabilities: LineItemRow[];
  totalCurrentLiabilities: number;
  nonCurrentLiabilities: LineItemRow[];
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  equity: LineItemRow[];
  totalEquity: number;
  balances: boolean;
}

interface CashFlow {
  openingCash: number;
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  netChangeInCash: number;
  closingCash: number;
  reconcilesToLedger: boolean;
  operating: { netProfit: number; depreciationAddback: number; workingCapitalChange: number };
}

interface ComprehensiveIncome extends ProfitOrLoss {
  oci: { revaluationReserve: number; foreignCurrencyTranslationReserve: number; total: number };
  totalComprehensiveIncome: number;
}

type EquityComponent =
  | 'shareCapital'
  | 'sharePremium'
  | 'retainedEarnings'
  | 'revaluationReserve'
  | 'foreignCurrencyTranslationReserve'
  | 'otherReserves';

type EquityRow = Record<EquityComponent, number> & { total: number };

interface ChangesInEquity {
  periodName: string | null;
  components: EquityComponent[];
  opening: EquityRow;
  profitForYear: EquityRow;
  oci: EquityRow;
  dividends: EquityRow;
  otherMovements: EquityRow;
  closing: EquityRow;
  totalComprehensiveIncome: number;
  reconcilesToBalanceSheet: boolean;
}

const EQUITY_COMPONENT_LABELS: Record<EquityComponent, string> = {
  shareCapital: 'Share capital',
  sharePremium: 'Share premium',
  retainedEarnings: 'Retained earnings',
  revaluationReserve: 'Revaluation reserve',
  foreignCurrencyTranslationReserve: 'FX translation reserve',
  otherReserves: 'Other reserves',
};

function allLineItems(...sections: LineItemRow[][]): LineItemRow[] {
  return sections.flat();
}


/**
 * Frontend Completion, FE-9.2 — the three primary IFRS financial
 * statements (Profit or Loss, Financial Position, Cash Flows), picked
 * as `ReportingController`'s own first genuinely-uncovered slice per
 * FE-9.1's own release report: Real Estate/PMO/CRM's own reporting
 * sub-methods are already consumed indirectly through
 * `dashboard/*-analytics` aggregate endpoints (confirmed directly, not
 * assumed, by re-checking `real-estate/page.tsx`/`pmo/page.tsx`'s own
 * `fetchApi` calls), so this checkpoint starts with the genuinely
 * untouched core: `gl.reports.view`'s three statement endpoints.
 * Financial Ratios, Segment Reporting, Statement of Comprehensive
 * Income, Statement of Changes in Equity, IFRS Notes, and Consolidated
 * Trial Balance are all deliberately deferred to their own later
 * checkpoints — six more real, separately-scoped slices of "Financial
 * Reports," not silently folded into this one.
 *
 * All three statements need the SAME `entityId`+`fiscalPeriodId` (plus
 * an optional comparative period for the first two), so this is one
 * page with three sections rather than three separate routes — the
 * same "one shared selection, several dependent views" shape
 * `pmo/page.tsx` already established for entity+project.
 *
 * Cash Flow is rendered INDIRECT-method only (the query param's own
 * server-side default) — DIRECT's own operating-line breakdown
 * (receivables/inventory/payables movements, `reporting.service.ts`'s
 * own `buildCashFlow`) is real additional structure deliberately left
 * for a follow-up rather than doubling this checkpoint's own scope for
 * a presentation alternative to the same reconciling total.
 *
 * Each statement's line items render as ONE `DataTable` (Section/Code/
 * Account/Amount columns) rather than a separate table per section —
 * simpler to build and still clearly grouped via the Section column;
 * a fully-indented traditional statement layout is a reasonable future
 * visual refinement, not required for the data to be genuinely usable
 * here.
 *
 * ADDENDUM (FE-9.3) — Statement of Comprehensive Income and Statement
 * of Changes in Equity, two of the six slices FE-9.2's own doc comment
 * named as deliberately deferred. Picked as a pair (not split across
 * two checkpoints) because both share the SAME `entityId` +
 * `fiscalPeriodId` (+ optional `comparativeFiscalPeriodId`) input this
 * page already collects — confirmed directly against
 * `ReportingController.statementOfComprehensiveIncome`/
 * `.statementOfChangesInEquity`, identical query-param shape to the
 * three statements already here, not assumed from the endpoint names
 * alone. Financial Ratios, Segment Reporting, IFRS Notes, and
 * Consolidated Trial Balance remain deferred — four slices now, not
 * six.
 *
 * `statementOfComprehensiveIncome`'s own response SPREADS every field
 * `statementOfProfitOrLoss` already returns (confirmed directly against
 * `ReportingService.buildComprehensiveIncome`, which literally returns
 * `{ ...profitOrLoss, oci, totalComprehensiveIncome }`) — so
 * `ComprehensiveIncome extends ProfitOrLoss` and this section reuses
 * `lineItemColumns()`/`allLineItems()` unchanged for its own P&L
 * portion; only the two-figure `oci` object and
 * `totalComprehensiveIncome` are new, shown as extra `KpiCard`s rather
 * than invented as a second small table for just two numbers.
 *
 * Statement of Changes in Equity is NOT a `LineItemRow` list — it's a
 * six-component-by-six-movement GRID (`EQUITY_COMPONENTS`, confirmed
 * directly against `reporting.service.ts`), genuinely a different table
 * shape from every other statement on this page. `equityColumns()`/
 * `equityRows()` build a `DataTable` with one row per movement category
 * (Opening/Profit for the year/OCI/Dividends/Other movements/Closing)
 * and one column per equity component — the first non-`LineItemRow`
 * table shape this page has needed, not forced into the existing
 * `lineItemColumns()` helper where it wouldn't fit.
 *
 * ADDENDUM (FE-9.5) — Export & Print. `PrintButton` is rendered once,
 * globally, near the top (the browser's own print dialog handles
 * everything currently visible on the page in one pass — there's no
 * reason for five separate print triggers). `ExportCsvButton` is
 * rendered once PER `LineItemRow`-shaped statement — P&L, Statement of
 * Financial Position, and Comprehensive Income — reusing each
 * section's own `allLineItems(...)` call already in place for its
 * `DataTable`, mapped into plain `{ section, code, account, amount }`
 * objects (`ExportCsvButton`'s own prop type needs a plain indexable
 * record; `LineItemRow` itself doesn't structurally satisfy that).
 * Cash Flow and Changes in Equity are deliberately NOT given an export
 * button in this checkpoint — neither is `LineItemRow`-shaped (Cash
 * Flow is a handful of named scalars; Equity is the six-component grid
 * described above), so exporting either would need its own bespoke
 * row-mapping rather than reusing what's already in hand — left for a
 * later checkpoint, the same "smallest correct slice" discipline this
 * whole stage has used throughout.
 */
async function loadStatements(entityId: string, fiscalPeriodId: string, comparativeFiscalPeriodId?: string) {
  const comparativeQuery = comparativeFiscalPeriodId ? `&comparativeFiscalPeriodId=${comparativeFiscalPeriodId}` : '';
  const [pl, sofp, cf, ci, equity] = await Promise.all([
    fetchApi<{ current: ProfitOrLoss; comparative?: ProfitOrLoss }>(
      `/reporting/statement-of-profit-or-loss?entityId=${entityId}&fiscalPeriodId=${fiscalPeriodId}${comparativeQuery}`,
    ),
    fetchApi<{ current: FinancialPosition; comparative?: FinancialPosition }>(
      `/reporting/statement-of-financial-position?entityId=${entityId}&fiscalPeriodId=${fiscalPeriodId}${comparativeQuery}`,
    ),
    fetchApi<CashFlow>(`/reporting/statement-of-cash-flows?entityId=${entityId}&fiscalPeriodId=${fiscalPeriodId}`),
    fetchApi<{ current: ComprehensiveIncome; comparative?: ComprehensiveIncome }>(
      `/reporting/statement-of-comprehensive-income?entityId=${entityId}&fiscalPeriodId=${fiscalPeriodId}${comparativeQuery}`,
    ),
    fetchApi<{ current: ChangesInEquity; comparative?: ChangesInEquity }>(
      `/reporting/statement-of-changes-in-equity?entityId=${entityId}&fiscalPeriodId=${fiscalPeriodId}${comparativeQuery}`,
    ),
  ]);
  return { pl: pl.current, sofp: sofp.current, cf, ci: ci.current, equity: equity.current };
}

export default async function FinancialStatementsPage({
  searchParams,
}: {
  searchParams: { entityId?: string; fiscalPeriodId?: string; comparativeFiscalPeriodId?: string };
}) {
  const entityId = searchParams.entityId;
  const fiscalPeriodId = searchParams.fiscalPeriodId;
  const comparativeFiscalPeriodId = searchParams.comparativeFiscalPeriodId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Financial Statements" subtitle="Enter an entity ID to begin." />
        <EntitySelector />
      </PageContainer>
    );
  }

  if (!fiscalPeriodId) {
    return (
      <PageContainer>
        <PageHeader title="Financial Statements" subtitle={`Entity ${entityId} — enter a fiscal period.`} />
        <EntitySelector initialValue={entityId} />
        <PeriodSelector entityId={entityId} />
      </PageContainer>
    );
  }

  let pl: ProfitOrLoss | null = null;
  let sofp: FinancialPosition | null = null;
  let cf: CashFlow | null = null;
  let ci: ComprehensiveIncome | null = null;
  let equity: ChangesInEquity | null = null;
  let error: string | null = null;
  try {
    const result = await loadStatements(entityId, fiscalPeriodId, comparativeFiscalPeriodId);
    pl = result.pl;
    sofp = result.sofp;
    cf = result.cf;
    ci = result.ci;
    equity = result.equity;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load financial statements.';
  }

  return (
    <PageContainer>
      <PageHeader title="Financial Statements" subtitle={pl?.periodName ?? `Entity ${entityId}`} />
      <div style={{ marginBottom: tokens.space(4) }}>
        <PrintButton />
      </div>
      <EntitySelector initialValue={entityId} />
      <PeriodSelector entityId={entityId} fiscalPeriodId={fiscalPeriodId} comparativeFiscalPeriodId={comparativeFiscalPeriodId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {pl && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <PageHeader title="Statement of Profit or Loss" />
            <ExportCsvButton
              filename="profit-or-loss"
              rows={allLineItems(pl.revenue, pl.costOfSales, pl.operatingExpense, pl.financeExpense, pl.taxExpense).map((r) => ({
                section: r.statement_section,
                code: r.account_code,
                account: r.account_name,
                amount: r.amount ?? r.closing_balance ?? 0,
              }))}
            />
          </div>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(4) }}>
            <KpiCard label="Revenue" value={formatCurrency(pl.totalRevenue)} />
            <KpiCard label="Gross profit" value={formatCurrency(pl.grossProfit)} />
            <KpiCard label="Operating profit" value={formatCurrency(pl.operatingProfit)} />
            <KpiCard label="Net profit" value={formatCurrency(pl.netProfit)} tone={pl.netProfit >= 0 ? 'positive' : 'negative'} />
          </section>
          <FinancialLineItemsTable
            rows={allLineItems(pl.revenue, pl.costOfSales, pl.operatingExpense, pl.financeExpense, pl.taxExpense)}
            emptyMessage="No postings for this period."
          />
        </section>
      )}

      {sofp && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <PageHeader title="Statement of Financial Position" />
            <ExportCsvButton
              filename="statement-of-financial-position"
              rows={allLineItems(sofp.currentAssets, sofp.nonCurrentAssets, sofp.currentLiabilities, sofp.nonCurrentLiabilities, sofp.equity).map((r) => ({
                section: r.statement_section,
                code: r.account_code,
                account: r.account_name,
                amount: r.amount ?? r.closing_balance ?? 0,
              }))}
            />
          </div>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(4) }}>
            <KpiCard label="Total assets" value={formatCurrency(sofp.totalAssets)} />
            <KpiCard label="Total liabilities" value={formatCurrency(sofp.totalLiabilities)} />
            <KpiCard label="Total equity" value={formatCurrency(sofp.totalEquity)} />
            <KpiCard label="Balances" value={sofp.balances ? 'Yes' : 'No'} tone={sofp.balances ? 'positive' : 'warning'} />
          </section>
          <FinancialLineItemsTable
            rows={allLineItems(sofp.currentAssets, sofp.nonCurrentAssets, sofp.currentLiabilities, sofp.nonCurrentLiabilities, sofp.equity)}
            emptyMessage="No balances for this period."
          />
        </section>
      )}

      {cf && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Statement of Cash Flows (indirect method)" />
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4) }}>
            <KpiCard label="Opening cash" value={formatCurrency(cf.openingCash)} />
            <KpiCard label="Operating activities" value={formatCurrency(cf.operatingActivities)} />
            <KpiCard label="Investing activities" value={formatCurrency(cf.investingActivities)} />
            <KpiCard label="Financing activities" value={formatCurrency(cf.financingActivities)} />
            <KpiCard label="Net change in cash" value={formatCurrency(cf.netChangeInCash)} />
            <KpiCard label="Closing cash" value={formatCurrency(cf.closingCash)} />
            <KpiCard label="Reconciles to ledger" value={cf.reconcilesToLedger ? 'Yes' : 'No'} tone={cf.reconcilesToLedger ? 'positive' : 'warning'} />
          </section>
        </section>
      )}

      {ci && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <PageHeader title="Statement of Comprehensive Income" />
            <ExportCsvButton
              filename="comprehensive-income"
              rows={allLineItems(ci.revenue, ci.costOfSales, ci.operatingExpense, ci.financeExpense, ci.taxExpense).map((r) => ({
                section: r.statement_section,
                code: r.account_code,
                account: r.account_name,
                amount: r.amount ?? r.closing_balance ?? 0,
              }))}
            />
          </div>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(4) }}>
            <KpiCard label="Net profit" value={formatCurrency(ci.netProfit)} tone={ci.netProfit >= 0 ? 'positive' : 'negative'} />
            <KpiCard label="Revaluation reserve (OCI)" value={formatCurrency(ci.oci.revaluationReserve)} />
            <KpiCard label="FX translation reserve (OCI)" value={formatCurrency(ci.oci.foreignCurrencyTranslationReserve)} />
            <KpiCard
              label="Total comprehensive income"
              value={formatCurrency(ci.totalComprehensiveIncome)}
              tone={ci.totalComprehensiveIncome >= 0 ? 'positive' : 'negative'}
            />
          </section>
          <FinancialLineItemsTable
            rows={allLineItems(ci.revenue, ci.costOfSales, ci.operatingExpense, ci.financeExpense, ci.taxExpense)}
            emptyMessage="No postings for this period."
          />
        </section>
      )}

      {equity && (
        <section>
          <PageHeader title="Statement of Changes in Equity" />
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(4) }}>
            <KpiCard label="Closing equity" value={formatCurrency(equity.closing.total)} />
            <KpiCard label="Total comprehensive income" value={formatCurrency(equity.totalComprehensiveIncome)} />
            <KpiCard
              label="Reconciles to Balance Sheet"
              value={equity.reconcilesToBalanceSheet ? 'Yes' : 'No'}
              tone={equity.reconcilesToBalanceSheet ? 'positive' : 'warning'}
            />
          </section>
          <FinancialEquityTable
            rows={[
              { label: "Opening balance", row: equity.opening },
              { label: "Profit for the year", row: equity.profitForYear },
              { label: "Other comprehensive income", row: equity.oci },
              { label: "Dividends", row: equity.dividends },
              { label: "Other movements", row: equity.otherMovements },
              { label: "Closing balance", row: equity.closing },
            ]}
            components={equity.components}
          />
        </section>
      )}
    </PageContainer>
  );
}
