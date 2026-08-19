import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { ExecutiveTables } from './ExecutiveTables';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';

export const dynamic = 'force-dynamic';

interface ProfitOrLossSummary {
  periodName: string | null;
  totalRevenue: number;
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
}

interface FinancialRatiosRow {
  period_name: string;
  current_ratio: number | string | null;
  quick_ratio: number | string | null;
  debt_ratio: number | string | null;
  debt_to_equity: number | string | null;
  gross_margin: number | string | null;
  operating_margin: number | string | null;
  net_margin: number | string | null;
  cash_conversion_cycle_days: number | string | null;
}

interface BudgetOverview {
  totals: { budgeted: number; actual: number; committed: number; available: number };
}

interface ReceivablesPayables {
  payables: { total: number; invoiceCount: number };
  receivables: { total: number; invoiceCount: number };
  netPosition: number;
}

interface CashForecast {
  horizons: { days: number; outflow: number; inflow: number; net: number }[];
}

interface FixedAssetSummary {
  categoriesCount: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
}

interface TaxOverview {
  whtPendingCount: number;
  whtPendingAmount: number;
  vatPendingCount: number;
  vatPendingAmount: number;
}

interface TopVarianceProject {
  projectId: string;
  projectName: string;
  budgeted: number;
  actual: number;
  variance: number;
}

interface ExecutiveSummary {
  entityId: string;
  fiscalPeriodId: string | null;
  profitOrLoss: ProfitOrLossSummary | null;
  financialRatios: FinancialRatiosRow | null;
  budget: BudgetOverview;
  receivablesPayables: ReceivablesPayables;
  cashForecast: CashForecast;
  fixedAssets: FixedAssetSummary;
  tax: TaxOverview;
  topVarianceProjects: TopVarianceProject[];
}

// financialRatios comes back straight from `$queryRaw(SELECT * FROM
// vw_financial_ratios ...)` — no camelCase mapping, and (same caveat
// real-estate/page.tsx's own doc comment already documents for its own
// raw-view rows) numeric/bigint columns can come back as either
// `number` or `string` depending on the pg driver's own type mapping.
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === 'number' ? v : Number(v);
}

function pct(v: number | string | null | undefined): string {
  const n = num(v);
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`;
}

function ratio(v: number | string | null | undefined): string {
  const n = num(v);
  return n === null ? '—' : n.toFixed(2);
}

/**
 * Frontend Completion, FE-2.3 — Executive Dashboard, the first item on
 * FE-2's own roadmap list, picked up after Real Estate (FE-2.2) rather
 * than PMO: that checkpoint's own doc comment named PMO Dashboard as
 * needing a project selector first (`pmo-analytics`'s own `projectId`
 * is required, unlike `real-estate-analytics`'s optional one) and
 * pointed at FE-2's remaining items — Executive, Finance, Treasury,
 * CRM, HSE. `GET /dashboard/executive-summary` (`DashboardService
 * .getExecutiveSummary`, `executive.view`) was confirmed by reading it
 * directly: a genuinely pure composition of widgets every other
 * dashboard page already calls individually (budget, AR/AP, cash
 * forecast, fixed assets, tax, top-variance projects — reused as-is
 * here, same field shapes `page.tsx` (root), `fixed-assets/page.tsx`,
 * and `tax/page.tsx` already established) plus two genuinely new pieces
 * this page is the first to surface: `financialRatios`
 * (`vw_financial_ratios`, confirmed directly against the view's own SQL
 * for its exact column names) and `profitOrLoss`.
 *
 * `fiscalPeriodId` is optional on the backend (`profitOrLoss` and the
 * period-scoped half of `financialRatios` are simply `null`/empty
 * without one — confirmed directly against `getExecutiveSummary`'s own
 * implementation) — accepted here the same way as a second, optional
 * URL query param, no dedicated fiscal-period-picker component built
 * this checkpoint: no such picker exists anywhere else in this app yet
 * (confirmed by grepping for `fiscalPeriodId` across every page — only
 * `general-ledger/page.tsx` even types the field, and it doesn't render
 * a picker either), and this page's own KPI/ratio sections all degrade
 * to a plain "—" rather than breaking when it's absent, the same
 * "don't build a section for data with no confirmed need" restraint
 * `hr/page.tsx`'s own doc comment already applied to a demographics
 * breakdown it deliberately left out.
 *
 * CRM (already has its own page since Checkpoint K) is NOT picked up
 * this checkpoint. HSE was initially assumed to have no backend at all
 * — WRONG, caught and corrected before finishing this doc comment: a
 * full `HseController`/`HseService` exists (`hse.report`/`hse.view`/
 * `hse.manage`) covering incidents, near misses, PPE issuance, toolbox
 * talks, corrective actions, and inspection checklists. What it lacks
 * is the one thing every other FE-2 dashboard so far has had — a single
 * composite `dashboard/*-analytics`-shaped aggregate endpoint; HSE's
 * six list endpoints would need their own client-side aggregation the
 * way `hr/page.tsx` already does for its two `byDepartment` maps, or a
 * new backend aggregate written first. Either is a real checkpoint of
 * its own, not a "picked simplest, zero new backend work" one like
 * this — left as the next FE-2 candidate to scope properly, not
 * attempted here on a wrong assumption.
 */
async function loadExecutiveDashboard(entityId: string, fiscalPeriodId?: string): Promise<ExecutiveSummary> {
  const qs = fiscalPeriodId ? `entityId=${entityId}&fiscalPeriodId=${fiscalPeriodId}` : `entityId=${entityId}`;
  return fetchApi<ExecutiveSummary>(`/dashboard/executive-summary?${qs}`);
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: { entityId?: string; fiscalPeriodId?: string };
}) {
  const entityId = searchParams.entityId;
  const fiscalPeriodId = searchParams.fiscalPeriodId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Executive" subtitle="Enter an entity ID to view its executive dashboard." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: ExecutiveSummary | null = null;
  let error: string | null = null;
  try {
    data = await loadExecutiveDashboard(entityId, fiscalPeriodId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load executive dashboard data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Executive" subtitle={`Entity ${entityId}${fiscalPeriodId ? ` — period ${fiscalPeriodId}` : ''}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
            <KpiCard
              label="Net position (AR − AP)"
              value={formatCurrency(data.receivablesPayables.netPosition)}
              tone={data.receivablesPayables.netPosition >= 0 ? 'positive' : 'negative'}
            />
            <KpiCard label="Budget available" value={formatCurrency(data.budget.totals.available)} caption={`of ${formatCurrency(data.budget.totals.budgeted)} budgeted`} />
            <KpiCard label="Fixed assets — net book value" value={formatCurrency(data.fixedAssets.totalNetBookValue)} caption={`${data.fixedAssets.categoriesCount} categories`} />
            <KpiCard
              label="Tax pending (WHT + VAT)"
              value={formatCurrency(data.tax.whtPendingAmount + data.tax.vatPendingAmount)}
              tone={data.tax.whtPendingCount + data.tax.vatPendingCount > 0 ? 'warning' : 'neutral'}
              caption={`${data.tax.whtPendingCount + data.tax.vatPendingCount} pending`}
            />
          </section>

          {data.profitOrLoss ? (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
              <KpiCard label="Revenue" value={formatCurrency(data.profitOrLoss.totalRevenue)} caption={data.profitOrLoss.periodName ?? undefined} />
              <KpiCard label="Gross profit" value={formatCurrency(data.profitOrLoss.grossProfit)} />
              <KpiCard label="Operating profit" value={formatCurrency(data.profitOrLoss.operatingProfit)} />
              <KpiCard
                label="Net profit"
                value={formatCurrency(data.profitOrLoss.netProfit)}
                tone={data.profitOrLoss.netProfit >= 0 ? 'positive' : 'negative'}
              />
            </section>
          ) : (
            <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, marginBottom: tokens.space(8) }}>
              Add a <code>fiscalPeriodId</code> to the URL to see Profit or Loss for a specific period.
            </p>
          )}

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Financial ratios" subtitle={data.financialRatios?.period_name ?? 'No fiscal period selected'} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4) }}>
              <KpiCard label="Current ratio" value={ratio(data.financialRatios?.current_ratio)} />
              <KpiCard label="Quick ratio" value={ratio(data.financialRatios?.quick_ratio)} />
              <KpiCard label="Debt ratio" value={pct(data.financialRatios?.debt_ratio)} />
              <KpiCard label="Debt to equity" value={ratio(data.financialRatios?.debt_to_equity)} />
              <KpiCard label="Gross margin" value={pct(data.financialRatios?.gross_margin)} />
              <KpiCard label="Operating margin" value={pct(data.financialRatios?.operating_margin)} />
              <KpiCard label="Net margin" value={pct(data.financialRatios?.net_margin)} />
              <KpiCard
                label="Cash conversion cycle"
                value={num(data.financialRatios?.cash_conversion_cycle_days) === null ? '—' : `${num(data.financialRatios?.cash_conversion_cycle_days)} days`}
              />
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Cash forecast" />
          </section>

          <section>
            <PageHeader title="Top projects by budget variance" />
          </section>

          <ExecutiveTables
            cashForecast={data.cashForecast.horizons}
            topVarianceProjects={data.topVarianceProjects}
          />
        </>
      )}
    </PageContainer>
  );
}
