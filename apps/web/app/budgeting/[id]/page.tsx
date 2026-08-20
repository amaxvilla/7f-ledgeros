import Link from 'next/link';
import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../lib/api';
import { ReviseBudgetForm } from './ReviseBudgetForm';
import { TransferBudgetForm } from './TransferBudgetForm';
import { BudgetVarianceTable, BudgetRevisionHistoryTable, BudgetTransferHistoryTable, BudgetApprovalTrailTable } from '../BudgetingTables';

export const dynamic = 'force-dynamic';

interface BudgetLineRaw {
  id: string;
  period: number;
  originalAmount: number;
  revisedAmount: number;
  account: { id: string; code: string; name: string };
}

interface BudgetRevisionLineRaw {
  budgetLineId: string;
  previousAmount: number;
  newAmount: number;
}

interface BudgetRevisionRaw {
  id: string;
  revisionNumber: number;
  reason: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  lines: BudgetRevisionLineRaw[];
}

interface BudgetTransferRaw {
  id: string;
  fromLineId: string;
  toLineId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface BudgetApprovalRaw {
  id: string;
  action: string;
  comments: string | null;
  createdAt: string;
}

interface BudgetDetail {
  id: string;
  entityId: string;
  code: string;
  name: string;
  fiscalYear: number;
  status: string;
  description: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  lines: BudgetLineRaw[];
  revisions: BudgetRevisionRaw[];
  transfers: BudgetTransferRaw[];
  approvals: BudgetApprovalRaw[];
}

interface VarianceLine {
  budgetLineId: string;
  account: { id: string; code: string; name: string };
  period: number;
  originalAmount: number;
  budgeted: number;
  actual: number;
  committed: number;
  available: number;
  utilizationPercent: number | null;
}

interface VarianceResponse {
  lines: VarianceLine[];
  totals: { budgeted: number; actual: number; committed: number; available: number };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  FROZEN: 'positive',
  CLOSED: 'neutral',
};

/** `budgetLineId -> "<account code> · Month N"`, so revision/transfer rows read as something meaningful instead of raw line UUIDs. */
function buildLineLabels(lines: BudgetLineRaw[]): Map<string, string> {
  return new Map(lines.map((l) => [l.id, `${l.account.code} · Month ${l.period}`]));
}

/**
 * Frontend Completion — Budgeting detail sub-page (`/budgeting/[id]`),
 * the first dynamic-route page in this app. Recommended directly by
 * BUD.4's own report as the necessary next step before `revise`/
 * `transfer` can be built at all: both `ReviseBudgetDto.lines[].budgetLineId`
 * and `TransferBudgetDto.fromLineId`/`toLineId` (confirmed directly
 * against both DTOs) reference individual `BudgetLine` rows by id —
 * nothing in this app has ever surfaced a budget's own line items
 * before now (the register page only shows header fields), so there
 * was no way to even pick a line to revise/transfer against. This
 * checkpoint is deliberately READ-ONLY — no `revise`/`transfer` form
 * yet, per BUD.4's own scoping ("worth its own two checkpoints —
 * detail page + revise form, then transfer form", not attempted
 * together here since both are genuinely separate, form-shaped
 * features on the scale of `CreateBudgetForm` itself).
 *
 * TWO CALLS, DELIBERATELY NOT ONE: `GET /budgets/:id` (`findOne`) and
 * `GET /budgets/:id/variance` return genuinely different shapes,
 * confirmed directly against `BudgetingService` — `findOne` is the only
 * one with `revisions`/`transfers`/`approvals` (the history this page
 * needs) but its own raw `lines` include has no actual/committed/
 * available figures; `variance` is the only one with those computed
 * per-line figures but returns no history at all. Both are fetched
 * together; `findOne`'s own `lines` (which DO include each line's
 * `account`) are used only to build a `budgetLineId -> label` map for
 * the revision/transfer tables below, not rendered directly as their
 * own table — `variance`'s own richer `lines` (same ids, plus
 * actual/committed/available/utilization) are what the Line items table
 * actually renders.
 *
 * Both endpoints require only `budget.view` (confirmed directly against
 * their own `@RequirePermissions` decorators) — same permission the
 * register page (`/budgeting`) already gates on, so no new permission
 * surface is introduced here.
 *
 * No `EntitySelector` gate here, unlike `/budgeting` itself — `findOne`
 * takes no `entityId` query param (RLS alone scopes it, confirmed
 * directly, same as Project Risks/Issues' own list endpoints) — the
 * "Back to register" link below reconstructs `?entityId=` from the
 * budget's own `entityId` in the response instead.
 *
 * ADDENDUM (BUD.6) — `ReviseBudgetForm` is now rendered here, gated on
 * `budget.status === 'APPROVED'` (`BudgetingService.revise`'s own
 * `assertStatus`, confirmed directly) — the same "don't offer what the
 * backend would reject" posture this page's own KPI/table sections
 * already follow implicitly. `lineOptions` (a `SelectOption[]`) is built
 * from the same `lineLabels` map this page already computes for its
 * Revision/Transfer history tables (`buildLineLabels`) — no new fetch.
 * `TransferBudgetForm` remains unbuilt, per BUD.5's own scoping
 * ("worth its own two checkpoints"); this addendum is the first of
 * those two.
 *
 * ADDENDUM (BUD.7) — `TransferBudgetForm` is now rendered directly
 * below `ReviseBudgetForm`, same `APPROVED`-only gate (confirmed
 * directly against `BudgetingService.transfer`'s own `assertStatus` —
 * identical to `revise`'s). `availableByLineId` (a `Map<string,
 * number>`) is derived from `variance.lines[].available` — the exact
 * per-line figure `BudgetingService.transfer`'s own
 * `getAvailableForLine` computes server-side (confirmed directly to be
 * the same formula) — so the form can show a transferable ceiling
 * without a new fetch. This completes both form-shaped features BUD.5's
 * own report estimated for this detail page.
 */
async function loadBudgetDetail(id: string) {
  const [budget, variance] = await Promise.all([
    fetchApi<BudgetDetail>(`/budgets/${id}`),
    fetchApi<VarianceResponse>(`/budgets/${id}/variance`),
  ]);
  return { budget, variance, lineLabels: buildLineLabels(budget.lines) };
}

export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
  let data: Awaited<ReturnType<typeof loadBudgetDetail>> | null = null;
  let error: string | null = null;
  try {
    data = await loadBudgetDetail(params.id);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load budget.';
  }

  if (error || !data) {
    return (
      <PageContainer>
        {/* Breadcrumbs added to both this page's headers (see PageHeader's
            own doc comment in Badge.tsx); the pre-existing "← Back to
            register" link below is left as-is rather than removed —
            same reasoning work-packages/[id]/page.tsx's own comment
            gives: breadcrumbs are a wayfinding aid, not a page-actions
            replacement. */}
        <PageHeader title="Budget detail" breadcrumbs={[{ label: 'Budgeting', href: '/budgeting' }, { label: 'Budget detail' }]} />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Budget not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/budgeting" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to register
          </Link>
        </p>
      </PageContainer>
    );
  }

  const { budget, variance, lineLabels } = data;
  const lineOptions: SelectOption[] = Array.from(lineLabels, ([value, label]) => ({ value, label }));
  const availableByLineId = new Map(variance.lines.map((l) => [l.budgetLineId, l.available]));

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link
          href={`/budgeting?entityId=${budget.entityId}`}
          style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}
        >
          ← Back to register
        </Link>
      </p>

      <PageHeader
        title={`${budget.code} — ${budget.name}`}
        subtitle={`FY ${budget.fiscalYear}`}
        breadcrumbs={[{ label: 'Budgeting', href: '/budgeting' }, { label: budget.code }]}
      />

      <section style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center', marginBottom: tokens.space(6) }}>
        <Badge tone={STATUS_TONE[budget.status] ?? 'neutral'}>{budget.status}</Badge>
        {budget.description && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>{budget.description}</span>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Budgeted (revised)" value={formatCurrency(variance.totals.budgeted)} />
        <KpiCard label="Actual" value={formatCurrency(variance.totals.actual)} />
        <KpiCard label="Committed" value={formatCurrency(variance.totals.committed)} tone="warning" />
        <KpiCard
          label="Available"
          value={formatCurrency(variance.totals.available)}
          tone={variance.totals.available < 0 ? 'negative' : 'positive'}
        />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Line items" />
        <BudgetVarianceTable rows={variance.lines} />
      </section>

      {budget.status === 'APPROVED' && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Revise budget" />
          <ReviseBudgetForm budgetId={budget.id} lineOptions={lineOptions} />
        </section>
      )}

      {budget.status === 'APPROVED' && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Transfer between lines" />
          <TransferBudgetForm budgetId={budget.id} lineOptions={lineOptions} availableByLineId={availableByLineId} />
        </section>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Revision history" />
        <BudgetRevisionHistoryTable rows={budget.revisions} lineLabels={Object.fromEntries(lineLabels)} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Transfer history" />
        <BudgetTransferHistoryTable rows={budget.transfers} lineLabels={Object.fromEntries(lineLabels)} />
      </section>

      <section>
        <PageHeader title="Approval trail" />
        <BudgetApprovalTrailTable rows={budget.approvals} />
      </section>
    </PageContainer>
  );
}
