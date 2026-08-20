import Link from 'next/link';
import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { ProjectSelector } from '../../ProjectSelector';
import type { ProjectOption } from '../../ProjectSelector';
import { ReserveUnitForm } from './ReserveUnitForm';
import { RealEstateUnitsTable } from '../RealEstateTables';

export const dynamic = 'force-dynamic';

interface Unit {
  id: string;
  code: string;
  name: string | null;
  unitType: string | null;
  sizeSqm: number | null;
  listPrice: number;
  status: string;
}

interface Floor {
  id: string;
  code: string;
  name: string;
  units: Unit[];
}

interface Block {
  id: string;
  code: string;
  name: string;
  floors: Floor[];
}

interface Phase {
  id: string;
  code: string;
  name: string;
  blocks: Block[];
}

interface ProjectTree {
  id: string;
  code: string;
  name: string;
  phases: Phase[];
}

interface UnitRow extends Unit {
  phaseLabel: string;
  blockLabel: string;
  floorLabel: string;
}

interface PipelineSummary {
  active: number;
  expiringSoon: number;
  convertedThisMonth: number;
  cancelledThisMonth: number;
}

interface Customer {
  id: string;
  code: string;
  name: string;
}

const UNIT_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  AVAILABLE: 'positive',
  RESERVED: 'warning',
  ALLOCATED: 'warning',
  UNDER_CONTRACT: 'warning',
  HANDED_OVER: 'neutral',
  SOLD: 'positive',
};

/** Flattens `phases[].blocks[].floors[].units[]` into one row-per-unit array, each carrying its own phase/block/floor labels — the same "the page owns the flattening, the component below just renders a flat list" shape `hse/page.tsx`'s own `correctiveActions` flattening already established. */
function flattenUnits(tree: ProjectTree): UnitRow[] {
  const rows: UnitRow[] = [];
  for (const phase of tree.phases) {
    for (const block of phase.blocks) {
      for (const floor of block.floors) {
        for (const unit of floor.units) {
          rows.push({
            ...unit,
            phaseLabel: `${phase.code} ${phase.name}`,
            blockLabel: `${block.code} ${block.name}`,
            floorLabel: `${floor.code} ${floor.name}`,
          });
        }
      }
    }
  }
  return rows;
}

/**
 * Frontend Completion — Property Sales (`/real-estate/sales`), opening
 * Stage FE-4's last unbuilt roadmap item. FE-4.7's own recommendation
 * was to do a fresh "which of Sales/Mortgage/Handover/Lease/Facility
 * Management already exist" pass before picking one — confirmed
 * directly with a `find apps/web/app` listing: Mortgage, Handover,
 * Lease Management, and Facility Management all already have pages.
 * Only Sales (unit reservations → allocations) had nothing — a genuine,
 * checked gap.
 *
 * NO UNITS LIST ENDPOINT EXISTS ANYWHERE (a real, confirmed gap, unlike
 * the Projects-registry claim FE-2.5 corrected — this one actually
 * checked out false-to-true the other direction: grepped every
 * `this.prisma.unit.` call in `apps/api/src` and found only single-
 * record `findUnique`/`update`/`create`, never a `findMany`, and no
 * `@Get('units')` route on any controller). `GET /dimensions/projects/
 * :id/tree` (`DimensionsService.getProjectTree`, already used to build
 * `ProjectSelector`'s own consumers) turns out to be the actual way to
 * get a project's units — it nests `phases → blocks → floors → units`
 * (confirmed directly), so this page fetches that tree and flattens it
 * client-side rather than needing a new backend endpoint.
 *
 * SAME THREE-STEP entityId → projectId GATING `/pmo` ALREADY
 * ESTABLISHED, reused directly (`EntitySelector` then `ProjectSelector`,
 * the latter's own options built from `GET /dimensions/projects?entityId=X`) —
 * not a new pattern for this checkpoint.
 *
 * `GET /real-estate/reservations/pipeline-summary?entityId=X`
 * (`RealEstateService.getReservationPipelineSummary`, confirmed
 * directly) is ENTITY-scoped only, not project-scoped — its own
 * `where` clause only ever filters on `entityId` — so the four KPI
 * cards below reflect the whole entity's reservation pipeline, not just
 * the currently-selected project's. Named directly on the page (via the
 * KPI section's own subtitle) rather than left for someone to notice
 * the mismatch on their own.
 *
 * `GET /dimensions/customers` (confirmed directly: `findCustomers()`
 * takes NO parameters at all — `Customer` has no `entityId` column,
 * unlike `Unit`) is fetched once, unscoped, same result regardless of
 * which entity/project is selected.
 *
 * ONLY `ReserveUnitForm` THIS CHECKPOINT — see `actions.ts`'s own doc
 * comment for why Cancel/Convert aren't attempted here (no reservation
 * list endpoint to attach a row action to).
 *
 * ADDENDUM — added a "View" column to the Units table linking each row
 * to the new `/real-estate/sales/[unitId]` detail page, carrying
 * `entityId`/`projectId` as query params since that page has no other
 * way to resolve a bare `unitId` back to its own project (no single-
 * unit endpoint exists — see that page's own doc comment). No new
 * fetch here.
 */
async function loadSalesData(entityId: string, projectId: string) {
  const [tree, pipeline, customers] = await Promise.all([
    fetchApi<ProjectTree>(`/dimensions/projects/${projectId}/tree`),
    fetchApi<PipelineSummary>(`/real-estate/reservations/pipeline-summary?entityId=${entityId}`),
    fetchApi<Customer[]>('/dimensions/customers'),
  ]);
  return { units: flattenUnits(tree), pipeline, customers };
}

async function loadProjectOptions(entityId: string): Promise<ProjectOption[]> {
  return fetchApi<ProjectOption[]>(`/dimensions/projects?entityId=${entityId}`);
}

export default async function PropertySalesPage({
  searchParams,
}: {
  searchParams: { entityId?: string; projectId?: string };
}) {
  const entityId = searchParams.entityId;
  const projectId = searchParams.projectId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Property Sales" subtitle="Enter an entity ID to view its projects." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let projectOptions: ProjectOption[] = [];
  let projectOptionsError: string | null = null;
  try {
    projectOptions = await loadProjectOptions(entityId);
  } catch (e) {
    projectOptionsError = e instanceof ApiError ? e.message : 'Failed to load projects for this entity.';
  }

  if (!projectId) {
    return (
      <PageContainer>
        <PageHeader title="Property Sales" subtitle={`Entity ${entityId} — choose a project to view its units.`} />
        <EntitySelector initialValue={entityId} />
        {projectOptionsError ? (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{projectOptionsError}</div>
        ) : (
          <ProjectSelector entityId={entityId} projectOptions={projectOptions} />
        )}
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadSalesData>> | null = null;
  let error: string | null = null;
  try {
    data = await loadSalesData(entityId, projectId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load sales data for this project.';
  }

  const selectedProject = projectOptions.find((p) => p.id === projectId);

  return (
    <PageContainer>
      <PageHeader
        title="Property Sales"
        subtitle={selectedProject ? `${selectedProject.code} — ${selectedProject.name}` : `Project ${projectId}`}
      />
      <EntitySelector initialValue={entityId} />
      <ProjectSelector entityId={entityId} projectOptions={projectOptions} initialValue={projectId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section style={{ marginBottom: tokens.space(2) }}>
            <PageHeader title="Reservation pipeline" subtitle="Entity-wide, not limited to the currently-selected project" />
          </section>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Active reservations" value={String(data.pipeline.active)} />
            <KpiCard
              label="Expiring within 48h"
              value={String(data.pipeline.expiringSoon)}
              tone={data.pipeline.expiringSoon > 0 ? 'warning' : 'positive'}
            />
            <KpiCard label="Converted this month" value={String(data.pipeline.convertedThisMonth)} tone="positive" />
            <KpiCard label="Cancelled this month" value={String(data.pipeline.cancelledThisMonth)} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Reserve a unit" />
            <ReserveUnitForm
              entityId={entityId}
              projectId={projectId}
              unitOptions={data.units
                .filter((u) => u.status === 'AVAILABLE')
                .map((u): SelectOption => ({ value: u.id, label: `${u.code} — ${u.floorLabel}, ${u.blockLabel}` }))}
              customerOptions={data.customers.map((c): SelectOption => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            />
          </section>

          <section>
            <PageHeader title="Units" subtitle={`${data.units.length} total`} />
            <RealEstateUnitsTable rows={data.units} entityId={entityId} projectId={projectId} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
