import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';

export const dynamic = 'force-dynamic';

interface AgingRow {
  entity_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  invoice_total: number;
  open_balance: number;
  days_past_due: number;
  aging_bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

interface VendorAgingRow extends AgingRow {
  vendor_invoice_id: string;
  vendor_id: string;
  vendor_name: string;
  amount_paid: number;
}

interface CustomerAgingRow extends AgingRow {
  ar_invoice_id: string;
  customer_id: string;
  customer_name: string;
  amount_received: number;
}

interface ProjectProfitabilityRow {
  project_id: string;
  project_code: string;
  project_name: string;
  revenue_amount: number;
  cost_amount: number;
  profit_amount: number;
  margin_pct: number | null;
}

interface BankReconciliationSummaryRow {
  bank_account_id: string;
  account_name: string;
  account_number: string;
  session_id: string | null;
  session_status: 'DRAFT' | 'APPROVED' | null;
  session_date: string | null;
  unmatched_count: number;
}

interface CashForecastRow {
  entity_id: string;
  horizon_days: number;
  outflow_due: number;
  inflow_due: number;
  net_due: number;
}

interface FixedAssetRegisterRow {
  fixed_asset_id: string;
  asset_tag: string;
  asset_name: string;
  category_name: string;
  acquisition_date: string;
  acquisition_cost: number;
  residual_value: number;
  useful_life_years: number;
  status: 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
  location_name: string | null;
  last_depreciated_period: string | null;
  accumulated_depreciation: number;
  net_book_value: number;
}

interface PaymentTransactionRegisterRow {
  payment_transaction_id: string;
  entity_id: string;
  reference: string;
  provider_code: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'ABANDONED';
  customer_email: string | null;
  description: string | null;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string;
  total_refunded: number;
  net_amount: number;
}

interface MonoLinkedAccountRegisterRow {
  mono_linked_account_id: string;
  entity_id: string;
  bank_account_id: string;
  mono_account_id: string;
  institution_name: string | null;
  account_number_masked: string | null;
  currency: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'REQUIRES_REAUTH';
  linked_at: string;
  revoked_at: string | null;
  reauth_required_at: string | null;
  last_synced_at: string | null;
}

interface CommissionSummary {
  entityId: string | null;
  earned: number;
  approved: number;
  payable: number;
  paid: number;
  outstanding: number;
}

interface CommissionByAgentRow {
  agentId: string;
  agentCode: string;
  agentName: string;
  earned: number;
  paid: number;
  outstanding: number;
  count: number;
}

interface CommissionByProjectRow {
  projectId: string;
  projectCode: string;
  earned: number;
  paid: number;
  outstanding: number;
  count: number;
}

interface CommissionAgingRow {
  commissionCalculationId: string;
  agentCode: string;
  agentName: string;
  netCommission: number;
  daysOutstanding: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

interface CommissionAging {
  rows: CommissionAgingRow[];
  totals: Record<'current' | '1-30' | '31-60' | '61-90' | '90+', number>;
}

interface CommissionForecastStage {
  status: string;
  label: string;
  amount: number;
  count: number;
}

interface CommissionForecast {
  pipeline: CommissionForecastStage[];
  totalUnpaid: number;
}

const BUCKET_TONE: Record<AgingRow['aging_bucket'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  current: 'positive',
  '1-30': 'neutral',
  '31-60': 'warning',
  '61-90': 'warning',
  '90+': 'negative',
};

/** Reused verbatim from `/fixed-assets/page.tsx`'s own map — same three
 *  `FixedAssetStatus` values, not a new tone convention invented for
 *  this register. */
const FIXED_ASSET_STATUS_TONE: Record<FixedAssetRegisterRow['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  FULLY_DEPRECIATED: 'neutral',
  DISPOSED: 'negative',
};

/** Reused verbatim from `/payments/page.tsx`'s own map — same four
 *  `PaymentTransactionStatus` values. */
const PAYMENT_STATUS_TONE: Record<PaymentTransactionRegisterRow['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  SUCCESSFUL: 'positive',
  FAILED: 'negative',
  PENDING: 'warning',
  ABANDONED: 'neutral',
};

/** `MonoLinkStatus` — confirmed directly against `schema.prisma` (NOT
 *  `MonoLinkedAccountStatus`, a name that doesn't exist as an enum in
 *  this schema at all). No existing page has its own tone map for this
 *  enum to reuse (`/bank-integration/page.tsx`'s own `STATUS_TONE` is
 *  keyed by the same three values, but that page's map isn't exported
 *  for this one to import — mirrored, not reused, same "no shared
 *  status-tone util exists yet" posture this app's history has hit
 *  before). */
const MONO_LINK_STATUS_TONE: Record<MonoLinkedAccountRegisterRow['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  REVOKED: 'negative',
  REQUIRES_REAUTH: 'warning',
};

/** `PaymentTransaction.amount` (and this view's own `total_refunded`/
 *  `net_amount`, derived from it) are minor-unit integers (kobo, cents)
 *  — confirmed directly in `vw_payment_transactions_register.sql`'s own
 *  comment, and re-confirmed against `/payments/page.tsx`'s own
 *  identical local helper, which this mirrors rather than imports (no
 *  shared export exists for it). Every other money value on THIS page
 *  is already major-unit — this conversion stays local to the one
 *  section that needs it. */
function formatMinorUnits(amount: number, currency: string): string {
  return formatCurrency(amount / 100, currency);
}

function agingColumns<T extends AgingRow>(counterpartyLabel: string, counterpartyName: (r: T) => string) {
  return [
    { header: counterpartyLabel, render: counterpartyName },
    { header: 'Invoice #', render: (r: T) => r.invoice_number },
    { header: 'Invoice date', render: (r: T) => new Date(r.invoice_date).toLocaleDateString() },
    { header: 'Due date', render: (r: T) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : '—') },
    { header: 'Invoice total', align: 'right' as const, render: (r: T) => formatCurrency(r.invoice_total) },
    { header: 'Open balance', align: 'right' as const, render: (r: T) => formatCurrency(r.open_balance) },
    { header: 'Days past due', align: 'right' as const, render: (r: T) => String(r.days_past_due) },
    { header: 'Bucket', render: (r: T) => <Badge tone={BUCKET_TONE[r.aging_bucket]}>{r.aging_bucket}</Badge> },
  ];
}

function agingTotals(rows: AgingRow[]) {
  const totalOpen = rows.reduce((sum, r) => sum + r.open_balance, 0);
  const overdueOpen = rows.filter((r) => r.aging_bucket !== 'current').reduce((sum, r) => sum + r.open_balance, 0);
  const over90 = rows.filter((r) => r.aging_bucket === '90+').reduce((sum, r) => sum + r.open_balance, 0);
  return { count: rows.length, totalOpen, overdueOpen, over90 };
}

/**
 * Frontend Completion, FE-9.4 — a new `/reports` hub, FE-9.3's own
 * option (b): the large set of `ReportingController` endpoints
 * confirmed genuinely unconsumed anywhere in this app (read directly
 * that checkpoint, not assumed from nav labels). Vendor Aging + Customer
 * Aging picked as the first pair — both single-`entityId`-param `GET`s
 * (confirmed directly against `ReportingController.vendorAging`/
 * `.customerAging`), no fiscal-period selector needed at all, unlike
 * every statement on `/financial-statements` — genuinely the smallest
 * well-scoped pair among the remaining unconsumed set, not picked
 * merely for being listed first.
 *
 * Both endpoints are raw `$queryRaw` reads against `vw_vendor_aging`/
 * `vw_customer_aging` (read directly in `sql/views/`, not inferred from
 * the service alone, since `$queryRaw`'s own return type is untyped) —
 * one row per open (posted, unpaid-balance > 0) invoice, with a
 * server-computed `aging_bucket` (`current`/`1-30`/`31-60`/`61-90`/
 * `90+`) whose boundaries these views' own comments say are kept in
 * sync with `AccountsPayableService.getVendorAging()`/
 * `AccountsReceivableService.getAging()` — this page trusts the view's
 * own bucket assignment rather than recomputing it from `days_past_due`
 * client-side.
 *
 * `agingColumns()`/`agingTotals()` are shared, GENERIC helpers
 * (parameterized by which counterparty-name field to render) rather
 * than two near-duplicate column/total sets — `VendorAgingRow`/
 * `CustomerAgingRow` both extend the same `AgingRow` shape, which is
 * genuinely identical between the two views apart from the vendor/
 * customer-specific id/name/amount-paid-or-received fields.
 *
 * `ap.view`/`ar.view` (confirmed directly against
 * `ReportingController.vendorAging`/`.customerAging`) — the SAME two
 * permissions `/ap-ar`'s own register already requires, not a new code;
 * enforced server-side only, same posture every other page in this app
 * already takes.
 *
 * KPI cards are computed CLIENT-SIDE from the already-fetched rows
 * (`agingTotals`) rather than a separate summary endpoint — no such
 * endpoint exists for either view, and summing an already-small,
 * already-fetched row set is the same "don't add a fetch the page
 * doesn't strictly need" discipline this app's own history already
 * follows (e.g. `/budgeting/[id]`'s own Total column, computed from
 * already-fetched `BudgetLine[]`).
 */
async function loadAgingReports(entityId: string) {
  const [vendorAging, customerAging] = await Promise.all([
    fetchApi<VendorAgingRow[]>(`/reporting/vendor-aging?entityId=${entityId}`),
    fetchApi<CustomerAgingRow[]>(`/reporting/customer-aging?entityId=${entityId}`),
  ]);
  return { vendorAging, customerAging };
}

/**
 * Frontend Completion, FE-9.5 — the next well-matched pair FE-9.4's own
 * report named. Read `ReportingController.projectProfitability`/
 * `.bankReconciliationSummary` directly rather than re-trusted from
 * that report's summary: both confirmed to be single-`entityId`-param
 * `GET`s, same shape as the aging pair — no fiscal-period selector
 * needed here either.
 *
 * `vw_project_profitability` (read directly in `sql/views/`, not
 * inferred): one row per project, revenue/cost recognized through
 * posted GL journal lines tagged with that project (deliberately reads
 * the GL directly rather than AR/Procurement subledgers, per that
 * view's own comment, so it captures every posted source consistently)
 * — `margin_pct` is `NULL` when `revenue_amount` is zero (division
 * avoided at the SQL level, not left to produce `Infinity`/`NaN`
 * client-side), rendered as "—" rather than `0%` or `NaN%` for that
 * case. `budget.view` (confirmed directly) — the same permission
 * `/budgeting` already requires, not a new code.
 *
 * `vw_bank_reconciliation_summary` (read directly): one row per ACTIVE
 * bank account (`WHERE ba."isActive" = TRUE`, confirmed directly — an
 * inactive account never appears here at all, not even with a null
 * session), joined to its own most recent reconciliation session (if
 * any — `session_id`/`session_status`/`session_date` are all nullable,
 * an account with no session yet is a real, expected state, not an
 * error) and that session's own still-unmatched statement-line count.
 * `session_status` is `ReconciliationSessionStatus`
 * (`DRAFT`/`APPROVED` — confirmed directly against the
 * `ReconciliationSession` model itself, NOT the differently-named,
 * differently-shaped `ReconciliationStatus` enum elsewhere in
 * `schema.prisma`, which this view's own session join has no relation
 * to at all — a real, checked distinction, not assumed from the enum's
 * generic-sounding name). `bankrecon.view` (confirmed directly) — a
 * permission this app hasn't required on any existing page yet, not
 * reused from `/ap-ar` the way the aging pair's `ap.view`/`ar.view`
 * were.
 *
 * Both folded into their own `Promise.all`, called alongside (not
 * inside) `loadAgingReports` above — that function is left completely
 * unchanged rather than extended, the same "don't touch a working,
 * already-shipped function when a sibling call achieves the same
 * result" posture this app's history has taken whenever a page's
 * existing data-loading function didn't strictly need to grow for a
 * new section to be added.
 */
async function loadProjectAndBankReports(entityId: string) {
  const [projectProfitability, bankReconciliation] = await Promise.all([
    fetchApi<ProjectProfitabilityRow[]>(`/reporting/project-profitability?entityId=${entityId}`),
    fetchApi<BankReconciliationSummaryRow[]>(`/reporting/bank-reconciliation-summary?entityId=${entityId}`),
  ]);
  return { projectProfitability, bankReconciliation };
}

/**
 * Frontend Completion, FE-9.6 — FE-9.5's own recommendation, read
 * directly before pairing rather than assumed from controller
 * proximity: `cash-forecast` (`ap.view`, same permission the aging pair
 * already established) paired with `fixed-asset-register`
 * (`fixedasset.view`, new to this app's frontend). `pmo-risk-issue-register`
 * — the third candidate FE-9.5 itself named — was READ directly too and
 * DELIBERATELY DROPPED from this checkpoint: `ReportingService.pmoRiskIssueRegister`
 * (confirmed directly) is not a list-shaped register at all — it's a
 * thin wrapper returning `{ entityId, projectId, ...summary }` where
 * `summary` is the exact same `RiskIssueService.getRiskIssueSummary`
 * aggregate `GET /dashboard/pmo-risk-issue-overview` already returns
 * (confirmed against that route directly, not assumed from the name).
 * Building a `/reports` section for it would just re-render numbers
 * `/project-risks`/`/project-issues` already show — noted in this
 * checkpoint's own report as "not worth a separate section" rather than
 * silently skipped with no explanation.
 *
 * `vw_cash_forecast` (read directly in `sql/views/`): exactly THREE
 * rows per entity, one per fixed horizon (30/60/90 days) — confirmed
 * directly each horizon's own `outflow_due`/`inflow_due` are CUMULATIVE
 * (every invoice due within that many days, not a discrete window), so
 * a KPI-card summary ACROSS the three rows would double-count — this is
 * why, unlike every other section on this page, Cash Forecast has NO
 * `KpiCard` row at all, just the three-row `DataTable` itself, which
 * already IS the summary.
 *
 * `vw_fixed_asset_register` (read directly): one row per fixed asset,
 * joined to its category and its own most recent POSTED depreciation
 * entry (`accumulated_depreciation`/`net_book_value` both fall back to
 * `0`/`acquisitionCost` respectively when no depreciation has posted
 * yet, confirmed directly — a new asset with no depreciation history is
 * a normal state, not a gap). `FIXED_ASSET_STATUS_TONE` reused verbatim
 * from `/fixed-assets/page.tsx`'s own map rather than re-invented.
 */
async function loadCashAndAssetReports(entityId: string) {
  const [cashForecast, fixedAssetRegister] = await Promise.all([
    fetchApi<CashForecastRow[]>(`/reporting/cash-forecast?entityId=${entityId}`),
    fetchApi<FixedAssetRegisterRow[]>(`/reporting/fixed-asset-register?entityId=${entityId}`),
  ]);
  return { cashForecast, fixedAssetRegister };
}

/**
 * Frontend Completion, FE-9.7 — Payment Transactions Register + Mono
 * Linked Accounts Register, FE-9.6's own recommended next checkpoint.
 * Directly followed that report's own conditional plan: read
 * `pmoProjectPerformance` first, specifically to check whether it
 * shares `pmoRiskIssueRegister`'s own "thin wrapper" problem.
 *
 * **It does — more so.** `ReportingService.pmoProjectPerformance` (read
 * directly) is `{ entityId, projectId, schedule, earnedValue }`, exactly
 * `SchedulingService.getGanttData` + `.computeEarnedValue` combined —
 * and confirmed directly against `app/pmo/page.tsx`'s OWN doc comment
 * that this exact combination is ALREADY fully consumed there (PV/EV/AC/
 * SV/CV/SPI/CPI KPI cards, sourced from this exact endpoint). Not a
 * "worth checking" maybe — a CONFIRMED duplicate of an already-shipped
 * page. Dropped from this checkpoint entirely, same as
 * `pmoRiskIssueRegister` before it — remove both from any future
 * "remaining endpoints" list rather than re-investigated again.
 *
 * Fell through to FE-9.6's own named fallback pair as a result:
 * `payment-transactions-register` (`vw_payment_transactions_register`,
 * read directly) and `mono-linked-accounts-register`
 * (`vw_mono_linked_accounts_register`, read directly) — both confirmed
 * genuine `$queryRaw` list views, single-`entityId`-param plus an
 * optional `status` filter (NOT applied client-side this checkpoint —
 * both sections fetch every status and let the existing `Badge` column
 * communicate it, the same "don't add a filter UI a page doesn't
 * strictly need yet" posture this app's history takes until a register
 * grows large enough to need one).
 *
 * **Checked both against already-shipped pages for overlap before
 * building, not assumed novel from the endpoint names alone**:
 * - `/payments/page.tsx` already lists transactions via `GET /payments`
 *   (`PaymentsService.listTransactions`, a plain `findMany` — confirmed
 *   directly). The reporting view adds one genuine thing that endpoint
 *   does NOT have: `total_refunded`/`net_amount`, refund-aware figures
 *   computed via a `payment_refunds` join `listTransactions` never
 *   performs — the same "Dashboard/Reporting split" both views'
 *   own SQL comments name explicitly (an operational list vs. a
 *   statutory-grade detail register). Built as a real, distinct
 *   section as a result, not skipped as a duplicate.
 * - `/bank-integration/page.tsx` already lists every linked account
 *   (Institution/Bank account/Account/Status/Last synced, plus a
 *   working Revoke action) via a per-bank-account fetch loop against
 *   `GET /bank-integration/mono/linked-accounts`. This one genuinely
 *   overlaps more — `mono-linked-accounts-register`'s own extra columns
 *   (`currency`, `linked_at`, `revoked_at`, `reauth_required_at`) are
 *   incremental, not a structurally new figure the way refund-aware net
 *   amounts were. Still built, per the same "statutory-grade, every-
 *   account, audit/export register sitting ALONGSIDE the operational
 *   page, not replacing it" framing that view's own SQL comment states
 *   explicitly (mirroring the payment view's own architecture, not a
 *   one-off judgment call) — but named here plainly as the weaker,
 *   more-overlapping case of the two, unlike the payment pairing.
 *
 * **`PaymentTransaction.amount` (and this view's own derived
 * `total_refunded`/`net_amount`) are minor-unit integers** (kobo,
 * cents) — confirmed directly in the view's own SQL comment, and by
 * `/payments/page.tsx`'s own identical local `amount / 100` conversion,
 * mirrored here as `formatMinorUnits` for the same reason that page's
 * own doc comment gives: this conversion is local to the one section
 * that needs it, not added to `formatCurrency` itself, since every
 * other money value on this page (and most of this app) is already
 * major-unit.
 *
 * **Caught a real enum-name trap**: the natural guess for Mono's own
 * link status would be `MonoLinkedAccountStatus` — that name does not
 * exist in `schema.prisma` at all. The real enum is `MonoLinkStatus`
 * (`ACTIVE`/`REVOKED`/`REQUIRES_REAUTH`), confirmed directly against
 * the `MonoLinkedAccount` model's own `status` field type, not assumed
 * from the model's own name.
 *
 * `payments.view` (already used by `/payments`) and `bank_link.view`
 * (already used by `/bank-integration`/the dashboard's own mono
 * overview) — both confirmed already-existing permission codes, no new
 * one introduced.
 */
async function loadPaymentAndBankLinkReports(entityId: string) {
  const [paymentTransactions, monoLinkedAccounts] = await Promise.all([
    fetchApi<PaymentTransactionRegisterRow[]>(`/reporting/payment-transactions-register?entityId=${entityId}`),
    fetchApi<MonoLinkedAccountRegisterRow[]>(`/reporting/mono-linked-accounts-register?entityId=${entityId}`),
  ]);
  return { paymentTransactions, monoLinkedAccounts };
}

/**
 * Agent & Commission Management, RE-COMM.5 (frontend) — the five
 * entity-wide commission reports (Commission earned/approved/payable/
 * paid/outstanding as one KPI row from `summary`, then by-agent,
 * by-project, aging, and forecast as their own sections), reading the
 * `CommissionReportingController` endpoints this same checkpoint's own
 * backend half added. `commission.view` (confirmed directly against
 * that controller) — the same read permission `/commission-calculations`
 * already requires, no new code. Folded into its own `Promise.all`
 * alongside (not inside) the four existing loaders, the same "don't
 * touch an already-shipped loader" posture this page's own history
 * already takes (see `loadCashAndAssetReports`'s own doc comment).
 *
 * `by-project`'s own response nests a `units` array per project — this
 * page only renders the project-level rollup, not that nested detail;
 * a per-project unit breakdown is a real, separate future addition (the
 * data is already there, just not surfaced here yet), not attempted in
 * this same pass so this section stays the same size as its siblings.
 */
async function loadCommissionReports(entityId: string) {
  const [summary, byAgent, byProject, aging, forecast] = await Promise.all([
    fetchApi<CommissionSummary>(`/commission-reporting/summary?entityId=${entityId}`),
    fetchApi<CommissionByAgentRow[]>(`/commission-reporting/by-agent?entityId=${entityId}`),
    fetchApi<CommissionByProjectRow[]>(`/commission-reporting/by-project?entityId=${entityId}`),
    fetchApi<CommissionAging>(`/commission-reporting/aging?entityId=${entityId}`),
    fetchApi<CommissionForecast>(`/commission-reporting/forecast?entityId=${entityId}`),
  ]);
  return { summary, byAgent, byProject, aging, forecast };
}

export default async function ReportsPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Reports" subtitle="Enter an entity ID to begin." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadAgingReports>> | null = null;
  let moreData: Awaited<ReturnType<typeof loadProjectAndBankReports>> | null = null;
  let evenMoreData: Awaited<ReturnType<typeof loadCashAndAssetReports>> | null = null;
  let yetMoreData: Awaited<ReturnType<typeof loadPaymentAndBankLinkReports>> | null = null;
  let commissionData: Awaited<ReturnType<typeof loadCommissionReports>> | null = null;
  let error: string | null = null;
  try {
    [data, moreData, evenMoreData, yetMoreData, commissionData] = await Promise.all([
      loadAgingReports(entityId),
      loadProjectAndBankReports(entityId),
      loadCashAndAssetReports(entityId),
      loadPaymentAndBankLinkReports(entityId),
      loadCommissionReports(entityId),
    ]);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load reports.';
  }

  return (
    <PageContainer>
      <PageHeader title="Reports" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data &&
        (() => {
          const vTotals = agingTotals(data.vendorAging);
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Vendor Aging" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Open invoices" value={String(vTotals.count)} />
                <KpiCard label="Total open balance" value={formatCurrency(vTotals.totalOpen)} />
                <KpiCard label="Overdue balance" value={formatCurrency(vTotals.overdueOpen)} tone={vTotals.overdueOpen > 0 ? 'warning' : 'positive'} />
                <KpiCard label="90+ days balance" value={formatCurrency(vTotals.over90)} tone={vTotals.over90 > 0 ? 'negative' : 'positive'} />
              </section>
              <DataTable
                columns={agingColumns<VendorAgingRow>('Vendor', (r) => r.vendor_name)}
                rows={data.vendorAging}
                keyOf={(r: VendorAgingRow) => r.vendor_invoice_id}
                emptyMessage="No open vendor invoices."
              />
            </section>
          );
        })()}

      {data &&
        (() => {
          const cTotals = agingTotals(data.customerAging);
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Customer Aging" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Open invoices" value={String(cTotals.count)} />
                <KpiCard label="Total open balance" value={formatCurrency(cTotals.totalOpen)} />
                <KpiCard label="Overdue balance" value={formatCurrency(cTotals.overdueOpen)} tone={cTotals.overdueOpen > 0 ? 'warning' : 'positive'} />
                <KpiCard label="90+ days balance" value={formatCurrency(cTotals.over90)} tone={cTotals.over90 > 0 ? 'negative' : 'positive'} />
              </section>
              <DataTable
                columns={agingColumns<CustomerAgingRow>('Customer', (r) => r.customer_name)}
                rows={data.customerAging}
                keyOf={(r: CustomerAgingRow) => r.ar_invoice_id}
                emptyMessage="No open customer invoices."
              />
            </section>
          );
        })()}

      {moreData &&
        (() => {
          const rows = moreData.projectProfitability;
          const totalRevenue = rows.reduce((sum, r) => sum + r.revenue_amount, 0);
          const totalCost = rows.reduce((sum, r) => sum + r.cost_amount, 0);
          const totalProfit = rows.reduce((sum, r) => sum + r.profit_amount, 0);
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Project Profitability" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Projects" value={String(rows.length)} />
                <KpiCard label="Total revenue" value={formatCurrency(totalRevenue)} />
                <KpiCard label="Total cost" value={formatCurrency(totalCost)} />
                <KpiCard label="Total profit" value={formatCurrency(totalProfit)} tone={totalProfit >= 0 ? 'positive' : 'negative'} />
              </section>
              <DataTable
                columns={[
                  { header: 'Project', render: (r: ProjectProfitabilityRow) => `${r.project_code} — ${r.project_name}` },
                  { header: 'Revenue', align: 'right' as const, render: (r: ProjectProfitabilityRow) => formatCurrency(r.revenue_amount) },
                  { header: 'Cost', align: 'right' as const, render: (r: ProjectProfitabilityRow) => formatCurrency(r.cost_amount) },
                  {
                    header: 'Profit',
                    align: 'right' as const,
                    render: (r: ProjectProfitabilityRow) => (
                      <span style={{ color: r.profit_amount >= 0 ? undefined : tokens.color.negative }}>
                        {formatCurrency(r.profit_amount)}
                      </span>
                    ),
                  },
                  {
                    header: 'Margin',
                    align: 'right' as const,
                    render: (r: ProjectProfitabilityRow) => (r.margin_pct === null ? '—' : `${(r.margin_pct * 100).toFixed(1)}%`),
                  },
                ]}
                rows={rows}
                keyOf={(r) => r.project_id}
                emptyMessage="No projects with posted revenue or cost yet."
              />
            </section>
          );
        })()}

      {moreData &&
        (() => {
          const rows = moreData.bankReconciliation;
          const withoutSession = rows.filter((r) => r.session_id === null).length;
          const withUnmatched = rows.filter((r) => r.unmatched_count > 0).length;
          const totalUnmatched = rows.reduce((sum, r) => sum + r.unmatched_count, 0);
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Bank Reconciliation Summary" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Active bank accounts" value={String(rows.length)} />
                <KpiCard label="No session yet" value={String(withoutSession)} tone={withoutSession > 0 ? 'warning' : 'positive'} />
                <KpiCard label="Accounts with unmatched lines" value={String(withUnmatched)} tone={withUnmatched > 0 ? 'warning' : 'positive'} />
                <KpiCard label="Total unmatched lines" value={String(totalUnmatched)} tone={totalUnmatched > 0 ? 'negative' : 'positive'} />
              </section>
              <DataTable
                columns={[
                  { header: 'Account', render: (r: BankReconciliationSummaryRow) => r.account_name },
                  { header: 'Account number', render: (r: BankReconciliationSummaryRow) => r.account_number },
                  {
                    header: 'Latest session',
                    render: (r: BankReconciliationSummaryRow) => (r.session_date ? new Date(r.session_date).toLocaleDateString() : 'No sessions yet'),
                  },
                  {
                    header: 'Session status',
                    render: (r: BankReconciliationSummaryRow) =>
                      r.session_status ? <Badge tone={r.session_status === 'APPROVED' ? 'positive' : 'neutral'}>{r.session_status}</Badge> : '—',
                  },
                  {
                    header: 'Unmatched lines',
                    align: 'right' as const,
                    render: (r: BankReconciliationSummaryRow) => (
                      <span style={{ color: r.unmatched_count > 0 ? tokens.color.negative : undefined }}>{r.unmatched_count}</span>
                    ),
                  },
                ]}
                rows={rows}
                keyOf={(r) => r.bank_account_id}
                emptyMessage="No active bank accounts."
              />
            </section>
          );
        })()}

      {evenMoreData &&
        (() => (
          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Cash Forecast" subtitle="Cumulative AP/AR due within each horizon — not discrete windows" />
            <DataTable
              columns={[
                { header: 'Horizon', render: (r: CashForecastRow) => `${r.horizon_days} days` },
                { header: 'Outflow due (AP)', align: 'right' as const, render: (r: CashForecastRow) => formatCurrency(r.outflow_due) },
                { header: 'Inflow due (AR)', align: 'right' as const, render: (r: CashForecastRow) => formatCurrency(r.inflow_due) },
                {
                  header: 'Net',
                  align: 'right' as const,
                  render: (r: CashForecastRow) => (
                    <span style={{ color: r.net_due >= 0 ? undefined : tokens.color.negative }}>{formatCurrency(r.net_due)}</span>
                  ),
                },
              ]}
              rows={evenMoreData.cashForecast}
              keyOf={(r) => String(r.horizon_days)}
              emptyMessage="No forecast data."
            />
          </section>
        ))()}

      {evenMoreData &&
        (() => {
          const rows = evenMoreData.fixedAssetRegister;
          const activeCount = rows.filter((r) => r.status === 'ACTIVE').length;
          const totalNbv = rows.reduce((sum, r) => sum + r.net_book_value, 0);
          const totalAccumDep = rows.reduce((sum, r) => sum + r.accumulated_depreciation, 0);
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Fixed Asset Register" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Assets" value={String(rows.length)} />
                <KpiCard label="Active" value={String(activeCount)} />
                <KpiCard label="Total net book value" value={formatCurrency(totalNbv)} />
                <KpiCard label="Total accumulated depreciation" value={formatCurrency(totalAccumDep)} />
              </section>
              <DataTable
                columns={[
                  { header: 'Asset tag', render: (r: FixedAssetRegisterRow) => r.asset_tag },
                  { header: 'Name', render: (r: FixedAssetRegisterRow) => r.asset_name },
                  { header: 'Category', render: (r: FixedAssetRegisterRow) => r.category_name },
                  { header: 'Status', render: (r: FixedAssetRegisterRow) => <Badge tone={FIXED_ASSET_STATUS_TONE[r.status]}>{r.status}</Badge> },
                  { header: 'Acquisition date', render: (r: FixedAssetRegisterRow) => new Date(r.acquisition_date).toLocaleDateString() },
                  { header: 'Acquisition cost', align: 'right' as const, render: (r: FixedAssetRegisterRow) => formatCurrency(r.acquisition_cost) },
                  {
                    header: 'Last depreciated',
                    render: (r: FixedAssetRegisterRow) => (r.last_depreciated_period ? new Date(r.last_depreciated_period).toLocaleDateString() : '—'),
                  },
                  { header: 'Net book value', align: 'right' as const, render: (r: FixedAssetRegisterRow) => formatCurrency(r.net_book_value) },
                ]}
                rows={rows}
                keyOf={(r) => r.fixed_asset_id}
                emptyMessage="No fixed assets recorded."
              />
            </section>
          );
        })()}

      {yetMoreData &&
        (() => {
          const rows = yetMoreData.paymentTransactions;
          const successfulCount = rows.filter((r) => r.status === 'SUCCESSFUL').length;
          const totalNet = rows.filter((r) => r.status === 'SUCCESSFUL').reduce((sum, r) => sum + r.net_amount, 0);
          const totalRefunded = rows.reduce((sum, r) => sum + r.total_refunded, 0);
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Payment Transactions Register" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Transactions" value={String(rows.length)} />
                <KpiCard label="Successful" value={String(successfulCount)} tone="positive" />
                <KpiCard label="Net received (successful)" value={rows.length > 0 ? formatMinorUnits(totalNet, rows[0].currency) : formatCurrency(0)} />
                <KpiCard label="Total refunded" value={rows.length > 0 ? formatMinorUnits(totalRefunded, rows[0].currency) : formatCurrency(0)} tone={totalRefunded > 0 ? 'warning' : 'neutral'} />
              </section>
              <DataTable
                columns={[
                  { header: 'Reference', render: (r: PaymentTransactionRegisterRow) => r.reference },
                  { header: 'Provider', render: (r: PaymentTransactionRegisterRow) => r.provider_code },
                  { header: 'Status', render: (r: PaymentTransactionRegisterRow) => <Badge tone={PAYMENT_STATUS_TONE[r.status]}>{r.status}</Badge> },
                  { header: 'Amount', align: 'right' as const, render: (r: PaymentTransactionRegisterRow) => formatMinorUnits(r.amount, r.currency) },
                  { header: 'Refunded', align: 'right' as const, render: (r: PaymentTransactionRegisterRow) => formatMinorUnits(r.total_refunded, r.currency) },
                  { header: 'Net', align: 'right' as const, render: (r: PaymentTransactionRegisterRow) => formatMinorUnits(r.net_amount, r.currency) },
                  { header: 'Paid at', render: (r: PaymentTransactionRegisterRow) => (r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—') },
                ]}
                rows={rows}
                keyOf={(r) => r.payment_transaction_id}
                emptyMessage="No payment transactions recorded."
              />
            </section>
          );
        })()}

      {yetMoreData &&
        (() => {
          const rows = yetMoreData.monoLinkedAccounts;
          const activeCount = rows.filter((r) => r.status === 'ACTIVE').length;
          const needsReauthCount = rows.filter((r) => r.status === 'REQUIRES_REAUTH').length;
          return (
            <section>
              <PageHeader title="Mono Linked Accounts Register" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Linked accounts" value={String(rows.length)} />
                <KpiCard label="Active" value={String(activeCount)} tone="positive" />
                <KpiCard label="Needs reauth" value={String(needsReauthCount)} tone={needsReauthCount > 0 ? 'warning' : 'positive'} />
              </section>
              <DataTable
                columns={[
                  { header: 'Institution', render: (r: MonoLinkedAccountRegisterRow) => r.institution_name ?? '—' },
                  { header: 'Account', render: (r: MonoLinkedAccountRegisterRow) => r.account_number_masked ?? '—' },
                  { header: 'Currency', render: (r: MonoLinkedAccountRegisterRow) => r.currency ?? '—' },
                  { header: 'Status', render: (r: MonoLinkedAccountRegisterRow) => <Badge tone={MONO_LINK_STATUS_TONE[r.status]}>{r.status}</Badge> },
                  { header: 'Linked', render: (r: MonoLinkedAccountRegisterRow) => new Date(r.linked_at).toLocaleDateString() },
                  { header: 'Last synced', render: (r: MonoLinkedAccountRegisterRow) => (r.last_synced_at ? new Date(r.last_synced_at).toLocaleDateString() : 'Never') },
                ]}
                rows={rows}
                keyOf={(r) => r.mono_linked_account_id}
                emptyMessage="No linked bank accounts."
              />
            </section>
          );
        })()}

      {commissionData && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Commission Summary" />
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(4),
            }}
          >
            <KpiCard label="Earned" value={formatCurrency(commissionData.summary.earned)} />
            <KpiCard label="Approved" value={formatCurrency(commissionData.summary.approved)} />
            <KpiCard label="Payable" value={formatCurrency(commissionData.summary.payable)} />
            <KpiCard label="Paid" value={formatCurrency(commissionData.summary.paid)} tone="positive" />
            <KpiCard
              label="Outstanding"
              value={formatCurrency(commissionData.summary.outstanding)}
              tone={commissionData.summary.outstanding > 0 ? 'warning' : 'positive'}
            />
          </section>
        </section>
      )}

      {commissionData && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Commission by Agent" />
          <DataTable
            columns={[
              { header: 'Agent', render: (r: CommissionByAgentRow) => `${r.agentCode} — ${r.agentName}` },
              { header: 'Calculations', align: 'right' as const, render: (r: CommissionByAgentRow) => String(r.count) },
              { header: 'Earned', align: 'right' as const, render: (r: CommissionByAgentRow) => formatCurrency(r.earned) },
              { header: 'Paid', align: 'right' as const, render: (r: CommissionByAgentRow) => formatCurrency(r.paid) },
              {
                header: 'Outstanding',
                align: 'right' as const,
                render: (r: CommissionByAgentRow) => (
                  <span style={{ color: r.outstanding > 0 ? tokens.color.warning : undefined }}>{formatCurrency(r.outstanding)}</span>
                ),
              },
            ]}
            rows={commissionData.byAgent}
            keyOf={(r: CommissionByAgentRow) => r.agentId}
            emptyMessage="No commission calculations yet."
          />
        </section>
      )}

      {commissionData && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Commission by Project" />
          <DataTable
            columns={[
              { header: 'Project', render: (r: CommissionByProjectRow) => r.projectCode },
              { header: 'Calculations', align: 'right' as const, render: (r: CommissionByProjectRow) => String(r.count) },
              { header: 'Earned', align: 'right' as const, render: (r: CommissionByProjectRow) => formatCurrency(r.earned) },
              { header: 'Paid', align: 'right' as const, render: (r: CommissionByProjectRow) => formatCurrency(r.paid) },
              { header: 'Outstanding', align: 'right' as const, render: (r: CommissionByProjectRow) => formatCurrency(r.outstanding) },
            ]}
            rows={commissionData.byProject}
            keyOf={(r: CommissionByProjectRow) => r.projectId}
            emptyMessage="No commission calculations tied to a project yet."
          />
        </section>
      )}

      {commissionData &&
        (() => {
          const totals = commissionData.aging.totals;
          const overdue = totals['1-30'] + totals['31-60'] + totals['61-90'] + totals['90+'];
          return (
            <section style={{ marginBottom: tokens.space(8) }}>
              <PageHeader title="Commission Aging" subtitle="PAYABLE calculations, aged from markedPayableAt" />
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: tokens.space(4),
                  marginBottom: tokens.space(4),
                }}
              >
                <KpiCard label="Current" value={formatCurrency(totals.current)} tone="positive" />
                <KpiCard label="Overdue" value={formatCurrency(overdue)} tone={overdue > 0 ? 'warning' : 'positive'} />
                <KpiCard label="90+ days" value={formatCurrency(totals['90+'])} tone={totals['90+'] > 0 ? 'negative' : 'positive'} />
              </section>
              <DataTable
                columns={[
                  { header: 'Agent', render: (r: CommissionAgingRow) => `${r.agentCode} — ${r.agentName}` },
                  { header: 'Net commission', align: 'right' as const, render: (r: CommissionAgingRow) => formatCurrency(r.netCommission) },
                  { header: 'Days outstanding', align: 'right' as const, render: (r: CommissionAgingRow) => String(r.daysOutstanding) },
                  { header: 'Bucket', render: (r: CommissionAgingRow) => <Badge tone={BUCKET_TONE[r.bucket]}>{r.bucket}</Badge> },
                ]}
                rows={commissionData.aging.rows}
                keyOf={(r: CommissionAgingRow) => r.commissionCalculationId}
                emptyMessage="No commission currently marked payable."
              />
            </section>
          );
        })()}

      {commissionData && (
        <section>
          <PageHeader title="Commission Forecast" subtitle="Unpaid pipeline by lifecycle stage — nearest to payment first" />
          <DataTable
            columns={[
              { header: 'Stage', render: (r: CommissionForecastStage) => r.label },
              { header: 'Calculations', align: 'right' as const, render: (r: CommissionForecastStage) => String(r.count) },
              { header: 'Amount', align: 'right' as const, render: (r: CommissionForecastStage) => formatCurrency(r.amount) },
            ]}
            rows={commissionData.forecast.pipeline}
            keyOf={(r: CommissionForecastStage) => r.status}
            emptyMessage="No unpaid commission in the pipeline."
          />
        </section>
      )}
    </PageContainer>
  );
}
