import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateBoqForm } from './CreateBoqForm';
import { BoqStatusActions } from './BoqStatusActions';

export const dynamic = 'force-dynamic';

interface BoqLine {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Boq {
  id: string;
  projectId: string;
  contractorId: string | null;
  title: string;
  status: string;
  createdAt: string;
  lines: BoqLine[];
}

interface Project {
  id: string;
  code: string;
  name: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'positive',
  CERTIFIED: 'positive',
  REJECTED: 'negative',
};

/**
 * Frontend Completion, PMO.1 — Bill of Quantities register, the first
 * page for PMO's own BOQ -> Work Package -> Progress Valuation ->
 * Interim Payment Certificate chain (`PmoController`, `pmo.module.ts`).
 * See `actions.ts`'s own doc comment for why this checkpoint scoped to
 * BOQ alone rather than the whole chain, and `CreateBoqForm.tsx`'s own
 * doc comment for the re-verified `projectId`-IS-a-real-`Select`
 * finding (a correction to `project-risks/page.tsx`'s own "no Projects
 * registry exists" claim, confirmed stale this checkpoint).
 *
 * `GET /pmo/boqs` (`PmoController.findBoqs`) takes an OPTIONAL
 * `projectId` query param but is otherwise scoped entirely through RLS
 * (`RowLevelSecurityService.buildWhere(scope, { dimensions: ['project'] })`,
 * confirmed directly) — no `entityId` filter exists on this endpoint at
 * all, the same "RLS alone scopes this" shape `project-risks`'s own
 * `GET /project-risks` has, not Budgeting's own `entityId`-filtered
 * `GET /budgets`. Called here with no query param, same as
 * `project-risks`'s own `loadProjectRisks`.
 *
 * `EntitySelector` still gates this page, though — same reasoning
 * `project-risks/page.tsx` already gives for its own identical shape:
 * `CreateBoqDto.projectId` is an `@RlsBodyCheck`-validated body field
 * (`dimension: 'project', bodyField: 'projectId'`), and the Project
 * `Select` this checkpoint's own `CreateBoqForm` needs is fetched via
 * `GET /dimensions/projects?entityId=` — this page's own `entityId`
 * flows ONLY into that fetch and the create form, never into
 * `loadBoqs` below, worth stating plainly since every entity-scoped
 * page's `entityId` (Budgeting, AP/AR) does both.
 *
 * NO DEDICATED PMO/BOQ DASHBOARD AGGREGATE EXISTS — confirmed directly
 * (grepped `dashboard.controller.ts` for `boq`/`workPackage`/`pmo`;
 * only `pmo-risk-issue-overview`/`pmo-analytics`, both Risk/Issue/
 * schedule-shaped, not BOQ-shaped, exist). KPIs here are therefore
 * derived client-side from the fetched `boqs` array itself — same
 * "no dedicated aggregate, derive from the list response" shape
 * `signatures/page.tsx`'s own doc comment already established for its
 * own four KPI cards.
 */
async function loadBoqs(entityId: string) {
  const [boqs, projects] = await Promise.all([
    fetchApi<Boq[]>('/pmo/boqs'),
    fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
  ]);

  const totalValue = boqs.reduce(
    (sum, boq) => sum + boq.lines.reduce((lineSum, line) => lineSum + Number(line.amount), 0),
    0,
  );
  const draftCount = boqs.filter((b) => b.status === 'DRAFT' || b.status === 'REVIEWED').length;
  const certifiedCount = boqs.filter((b) => b.status === 'CERTIFIED').length;

  const projectLabelById = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));

  return {
    boqs,
    kpis: { total: boqs.length, inProgress: draftCount, certified: certifiedCount, totalValue },
    projectOptions: projects.map<SelectOption>((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    projectLabelById,
  };
}

export default async function BoqPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Bill of Quantities" subtitle="Enter an entity ID to log a new BOQ against it." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadBoqs>> | null = null;
  let error: string | null = null;
  try {
    data = await loadBoqs(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load BOQs.';
  }

  return (
    <PageContainer>
      <PageHeader title="Bill of Quantities" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Total BOQs" value={String(data.kpis.total)} />
            <KpiCard label="In progress" value={String(data.kpis.inProgress)} tone={data.kpis.inProgress > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Certified" value={String(data.kpis.certified)} tone="positive" />
            <KpiCard label="Total value" value={formatCurrency(data.kpis.totalValue)} />
          </section>

          <section>
            <PageHeader title="BOQ register" />
            <CreateBoqForm entityId={entityId} projectOptions={data.projectOptions} />
            <DataTable
              columns={[
                { header: 'Title', render: (b: Boq) => b.title },
                { header: 'Project', render: (b: Boq) => data!.projectLabelById.get(b.projectId) ?? b.projectId },
                {
                  header: 'Lines total',
                  align: 'right',
                  render: (b: Boq) => formatCurrency(b.lines.reduce((sum, l) => sum + Number(l.amount), 0)),
                },
                { header: 'Status', render: (b: Boq) => <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status}</Badge> },
                { header: 'Created', render: (b: Boq) => new Date(b.createdAt).toLocaleDateString() },
                { header: 'Actions', align: 'right', render: (b: Boq) => <BoqStatusActions id={b.id} status={b.status} /> },
              ]}
              rows={data.boqs}
              keyOf={(b) => b.id}
              emptyMessage="No BOQs logged yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
