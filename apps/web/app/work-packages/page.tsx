import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateWorkPackageForm } from './CreateWorkPackageForm';
import { WorkPackageStatusActions } from './WorkPackageStatusActions';

export const dynamic = 'force-dynamic';

interface WorkPackage {
  id: string;
  projectId: string;
  contractorId: string;
  code: string;
  name: string;
  description: string | null;
  budgetAmount: number;
  status: string;
  createdAt: string;
  contractor: { id: string; vendor: { id: string; name: string } };
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
 * Frontend Completion, PMO.2 — Work Packages, the direct continuation
 * of PMO.1 (`app/boq/page.tsx`), the second link in PMO's own BOQ ->
 * Work Package -> Progress Valuation -> Interim Payment Certificate
 * chain. See `actions.ts`'s own doc comment for the full before-coding
 * analysis (the `contractorId`-is-required-here-not-optional
 * confirmation, and why `phaseId` is still left off the form).
 *
 * `GET /pmo/work-packages` (`PmoController.findWorkPackages`) takes the
 * same OPTIONAL `projectId` query param / RLS-only scoping shape
 * `GET /pmo/boqs` has (`RowLevelSecurityService.buildWhere(scope,
 * { dimensions: ['project'] })`, confirmed directly) — called here with
 * no query param, same as `loadBoqs`. It also `include`s
 * `contractor: { include: { vendor: true } }` (confirmed directly
 * against `PmoService.findWorkPackages`) — a genuine upgrade over Boq's
 * own register, which has no way to resolve `contractorId` to a name at
 * all: this table shows `contractor.vendor.name` in its Contractor
 * column instead of the raw id, even though the CREATE form still can't
 * offer a `Select` for it (no list-by-itself endpoint exists, only this
 * nested include on an already-created row).
 *
 * `EntitySelector` gates this page for the same reason it gates
 * `/boq`: `CreateWorkPackageDto.projectId` is `@RlsBodyCheck`-validated,
 * and the Project `Select` this page's own `CreateWorkPackageForm`
 * needs is fetched via `GET /dimensions/projects?entityId=` — `entityId`
 * flows only into that fetch and the create form, never into
 * `loadWorkPackages` below.
 *
 * NO DEDICATED WORK PACKAGE DASHBOARD AGGREGATE EXISTS EITHER
 * (re-confirmed the same `dashboard.controller.ts` grep `boq/page.tsx`
 * already ran) — KPIs here are likewise derived client-side from the
 * fetched `workPackages` array.
 *
 * ADDENDUM (PMO.3) — added a "View" column linking each row to the new
 * `/work-packages/[id]` detail page (Progress Valuations for that work
 * package). No new fetch here — just the `Link`.
 */
async function loadWorkPackages(entityId: string) {
  const [workPackages, projects] = await Promise.all([
    fetchApi<WorkPackage[]>('/pmo/work-packages'),
    fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
  ]);

  const totalBudget = workPackages.reduce((sum, wp) => sum + Number(wp.budgetAmount), 0);
  const inProgressCount = workPackages.filter((wp) => wp.status === 'DRAFT' || wp.status === 'REVIEWED').length;
  const certifiedCount = workPackages.filter((wp) => wp.status === 'CERTIFIED').length;

  const projectLabelById = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));

  return {
    workPackages,
    kpis: { total: workPackages.length, inProgress: inProgressCount, certified: certifiedCount, totalBudget },
    projectOptions: projects.map<SelectOption>((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    projectLabelById,
  };
}

export default async function WorkPackagesPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Work Packages" subtitle="Enter an entity ID to log a new work package against it." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadWorkPackages>> | null = null;
  let error: string | null = null;
  try {
    data = await loadWorkPackages(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load work packages.';
  }

  return (
    <PageContainer>
      <PageHeader title="Work Packages" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Total work packages" value={String(data.kpis.total)} />
            <KpiCard label="In progress" value={String(data.kpis.inProgress)} tone={data.kpis.inProgress > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Certified" value={String(data.kpis.certified)} tone="positive" />
            <KpiCard label="Total budget" value={formatCurrency(data.kpis.totalBudget)} />
          </section>

          <section>
            <PageHeader title="Work package register" />
            <CreateWorkPackageForm entityId={entityId} projectOptions={data.projectOptions} />
            <DataTable
              columns={[
                { header: 'Code', render: (wp: WorkPackage) => wp.code },
                { header: 'Name', render: (wp: WorkPackage) => wp.name },
                { header: 'Project', render: (wp: WorkPackage) => data!.projectLabelById.get(wp.projectId) ?? wp.projectId },
                { header: 'Contractor', render: (wp: WorkPackage) => wp.contractor.vendor.name },
                { header: 'Budget', align: 'right', render: (wp: WorkPackage) => formatCurrency(Number(wp.budgetAmount)) },
                { header: 'Status', render: (wp: WorkPackage) => <Badge tone={STATUS_TONE[wp.status] ?? 'neutral'}>{wp.status}</Badge> },
                { header: 'Created', render: (wp: WorkPackage) => new Date(wp.createdAt).toLocaleDateString() },
                {
                  header: 'View',
                  render: (wp: WorkPackage) => (
                    <Link href={`/work-packages/${wp.id}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
                      Progress →
                    </Link>
                  ),
                },
                { header: 'Actions', align: 'right', render: (wp: WorkPackage) => <WorkPackageStatusActions id={wp.id} status={wp.status} /> },
              ]}
              rows={data.workPackages}
              keyOf={(wp) => wp.id}
              emptyMessage="No work packages logged yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
