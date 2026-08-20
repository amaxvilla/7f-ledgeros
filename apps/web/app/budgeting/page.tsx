import Link from 'next/link';
import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { SubmitBudgetButton } from './SubmitBudgetButton';
import { BudgetDecisionActions } from './BudgetDecisionActions';
import { CloseBudgetButton } from './CloseBudgetButton';
import { CreateBudgetForm } from './CreateBudgetForm';
import { BudgetRegisterTable } from './BudgetingTables';

export const dynamic = 'force-dynamic';

interface Budget {
  id: string;
  code: string;
  name: string;
  fiscalYear: number;
  status: string;
  description: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
}

interface BudgetOverview {
  totals: { budgeted: number; actual: number; committed: number; available: number };
}

interface Account {
  id: string;
  code: string;
  name: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  FROZEN: 'positive',
  CLOSED: 'neutral',
};

/**
 * Frontend Completion — Budgeting. Built across five checkpoints:
 * BUD.1 (KPI summary + register + `submit`), BUD.2 (`CreateBudgetForm`,
 * added below in the same page rather than a separate route — every
 * other module page keeps its create form inline on the register page
 * itself, e.g. Project Risks/Issues, not a separate `/budgeting/new`),
 * BUD.3 (`approve`/`reject`, `BudgetDecisionActions.tsx`), BUD.4
 * (`close`, `CloseBudgetButton.tsx`), and this checkpoint (BUD.4's own
 * recommended next step: a read-only `/budgeting/[id]` detail
 * sub-page — see that page's own doc comment for why it was needed
 * before `revise`/`transfer` could be built at all). The register's own
 * `Code` column now links to it.
 *
 * ACTIONS COLUMN SPLIT BY STATUS, NOW THREE-WAY: `SubmitBudgetButton`
 * (BUD.1) still covers `DRAFT`/`REJECTED` (offers `submit`) and falls
 * back to a dash for every status it's actually given — deliberately
 * left untouched across every checkpoint since, since its own test
 * suite asserts that dash for `SUBMITTED`/`APPROVED`/`FROZEN`/`CLOSED`
 * alike. Instead, the Actions column below picks between three
 * components by status directly: `BudgetDecisionActions`
 * (`approve`/`reject`) for `SUBMITTED`, `CloseBudgetButton` (`close`)
 * for `APPROVED`, `SubmitBudgetButton` for everything else (`DRAFT`,
 * `REJECTED`, plus a dash for the terminal `FROZEN`/`CLOSED`) — never
 * more than one at once, so `SubmitBudgetButton`'s own dash for
 * `SUBMITTED`/`APPROVED` is superseded here without that component
 * itself ever being touched or widened.
 *
 * Reading `BudgetingController` directly (not assuming symmetry with
 * `RiskController`/`IssueController`) turned up a genuinely different
 * shape of work: `CreateBudgetDto` requires a nested `lines` array
 * (`ArrayMinSize(1)`, each line its own `accountId`/`period`/`amount`
 * plus five optional dimension ids) — every prior Create*Form in this
 * app (`CreateRiskForm`, `CreateIssueForm`, and everything before them)
 * has been a flat object, one `TextField`/`Select` per DTO field, with
 * nothing needing its own add/remove-row UI. BUD.1 deliberately covered
 * only the read side for that reason; see `CreateBudgetForm.tsx`'s own
 * doc comment for how BUD.2 built that UI.
 *
 * `submit` (`POST /budgets/:id/submit`) was picked as BUD.1's one row
 * action the same way `resolve`/`close` were for Issues/Risks:
 * confirmed directly against `BudgetingService.submit`, callable from
 * `DRAFT` or `REJECTED` only (`assertStatus`) — the natural first step
 * in the budget's own DRAFT → SUBMITTED → APPROVED (frozen) / REJECTED
 * lifecycle, and the only one of `approve`/`reject`/`close`/`revise`/
 * `transfer` that needs no additional input (`approve`/`reject` take
 * optional `comments`; `revise`/`transfer` take their own line-amount
 * arrays — all bigger, form-shaped work like Create Budget itself).
 *
 * `GET /budgets` takes an OPTIONAL `entityId` (unlike `GET
 * /project-risks`/`GET /project-issues`, which take none at all — RLS
 * alone scopes those) — confirmed directly against
 * `BudgetingController.findAll`/`BudgetingService.findAll`. Passed
 * through here so the register only shows this entity's own budgets,
 * consistent with every entity-scoped page's own list call (Payments,
 * Recruitment, Security), not Project Risks/Issues' RLS-only shape.
 *
 * `GET /dashboard/budget-vs-actual` DOES require `entityId` (confirmed
 * directly against `DashboardController.getBudgetVsActual`) — so
 * `EntitySelector` gates this whole page, same reasoning as every
 * other entity-scoped page, not Project Risks/Issues' "only the create
 * form needs it" shape. `GET /dashboard/committed-vs-available` is NOT
 * called separately: its own controller method (`getCommittedVsAvailable`)
 * forwards to the exact same `DashboardService.getBudgetOverview` as
 * `budget-vs-actual` — confirmed directly, not assumed from the similar
 * name — so it would just be a second identical request for the same
 * `totals.committed`/`totals.available` fields already in the first
 * response.
 *
 * `getBudgetOverview` itself only aggregates `APPROVED` budgets
 * (confirmed directly) — so these four KPI cards reflect approved
 * spend authority only, not every budget in the register below (which
 * includes every status). Worth stating plainly since a DRAFT-heavy
 * entity could show a full register with all-zero KPIs, correctly.
 *
 * `GET /accounts/entity/:entityId/active` (`ChartOfAccountsController`,
 * confirmed directly) is fetched alongside the other two calls below —
 * this page's own `entityId` is already in scope, and `CreateBudgetForm`'s
 * `accountId` `Select` needs a real option list to populate from (see
 * that component's own doc comment for why `accountId`, unlike
 * Risks/Issues' `projectId`, gets a real `Select` rather than a plain
 * `TextField`).
 */
async function loadBudgets(entityId: string) {
  const [budgets, overview, accounts] = await Promise.all([
    fetchApi<Budget[]>(`/budgets?entityId=${entityId}`),
    fetchApi<BudgetOverview>(`/dashboard/budget-vs-actual?entityId=${entityId}`),
    fetchApi<Account[]>(`/accounts/entity/${entityId}/active`),
  ]);
  return {
    budgets,
    totals: overview.totals,
    accountOptions: accounts.map<SelectOption>((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
  };
}

export default async function BudgetingPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Budgeting" subtitle="Enter an entity ID to view its budgets." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadBudgets>> | null = null;
  let error: string | null = null;
  try {
    data = await loadBudgets(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load budgets.';
  }

  return (
    <PageContainer>
      <PageHeader title="Budgeting" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Budgeted (approved)" value={formatCurrency(data.totals.budgeted)} />
            <KpiCard label="Actual" value={formatCurrency(data.totals.actual)} />
            <KpiCard label="Committed" value={formatCurrency(data.totals.committed)} tone="warning" />
            <KpiCard
              label="Available"
              value={formatCurrency(data.totals.available)}
              tone={data.totals.available < 0 ? 'negative' : 'positive'}
            />
          </section>

          <section>
            <PageHeader title="Budget register" />
            <CreateBudgetForm entityId={entityId} accountOptions={data.accountOptions} />
            <BudgetRegisterTable rows={data.budgets} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
