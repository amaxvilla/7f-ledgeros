import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { CreateMasterPlanForm } from './CreateMasterPlanForm';
import { MasterPlanActions } from './MasterPlanActions';

export const dynamic = 'force-dynamic';

interface Estate {
  id: string;
  entityId: string;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
}

interface MasterPlanZone {
  id: string;
  code: string;
  name: string;
  useType: string;
  plannedAreaSqm: string | number | null;
  plannedUnitCount: number | null;
}

interface MasterPlan {
  id: string;
  estateId: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
  summary: string | null;
  totalPlannedUnits: number | null;
  approvedAt: string | null;
  zones: MasterPlanZone[];
}

const MASTER_PLAN_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  APPROVED: 'positive',
  SUPERSEDED: 'warning',
};

const PLOT_USE_TYPE_LABEL: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  MIXED_USE: 'Mixed use',
  INDUSTRIAL: 'Industrial',
  AGRICULTURAL: 'Agricultural',
};

/**
 * Frontend Completion, FE-4.7 — Estate Master Planning detail
 * (`/land-bank/estates/[estateId]`), FE-4.6's own recommended next
 * checkpoint. Route lives alongside `/land-bank/[parcelId]` (a static
 * `estates` segment plus its own `[estateId]` dynamic segment) —
 * Next.js resolves the literal `estates` path ahead of the sibling
 * `[parcelId]` catch-all, confirmed against how `/land-bank/estates`
 * (the register page's own Estates section link target, added in this
 * same checkpoint) and `/land-bank/some-parcel-id` can coexist without
 * collision.
 *
 * NO single-estate-by-id endpoint exists (confirmed directly — only
 * `GET /real-estate/estates`, list, RLS-scoped, optional `entityId`) —
 * the same "no single-item endpoint, fetch the list and find by id"
 * situation `/work-packages/[id]/page.tsx` already hit elsewhere in
 * this app, not something to assume differently for a second module.
 * `GET /land-bank/estates/:estateId/master-plans` DOES exist and takes
 * the route's own `estateId` directly, so it's fetched in parallel with
 * the estates list rather than sequentially after it — this page
 * doesn't need the estate's own record before it can ask for that
 * estate's master plans, only to render the estate's name/code in the
 * header once both have resolved.
 *
 * Each master plan's own `zones` are rendered as a nested inline list
 * within its row (not a separate `DataTable`) — confirmed a typical
 * plan has few zones (a handful of land-use blocks, not dozens of
 * rows), the same judgment call `/work-packages/[id]/page.tsx`'s own
 * Certificate-per-valuation nesting made for a similarly small, tightly
 * -owned child collection, rather than defaulting to a second table for
 * every nested array the way this module's OWN register page does for
 * parcel-level counts (a deliberate difference: those are pure counts
 * summarizing data with its own future drill-down page, these zones
 * ARE this page's own full detail, there's nowhere further to drill).
 */
async function loadEstateDetail(estateId: string) {
  const [estates, masterPlans] = await Promise.all([
    fetchApi<Estate[]>('/real-estate/estates'),
    fetchApi<MasterPlan[]>(`/land-bank/estates/${estateId}/master-plans`),
  ]);
  const estate = estates.find((e) => e.id === estateId) ?? null;
  return { estate, masterPlans };
}

export default async function EstateDetailPage({ params }: { params: { estateId: string } }) {
  let estate: Estate | null = null;
  let masterPlans: MasterPlan[] = [];
  let error: string | null = null;
  try {
    const result = await loadEstateDetail(params.estateId);
    estate = result.estate;
    masterPlans = result.masterPlans;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load estate.';
  }

  if (error || !estate) {
    return (
      <PageContainer>
        <PageHeader title="Estate detail" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Estate not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/land-bank" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to Land Bank
          </Link>
        </p>
      </PageContainer>
    );
  }

  const approvedPlan = masterPlans.find((p) => p.status === 'APPROVED') ?? null;

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/land-bank" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Land Bank
        </Link>
      </p>

      <PageHeader title={`${estate.code} — ${estate.name}`} subtitle={estate.location ?? undefined} />

      <section style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center', marginBottom: tokens.space(6) }}>
        {estate.description && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>{estate.description}</span>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Master plans" value={String(masterPlans.length)} />
        <KpiCard label="Current version" value={approvedPlan ? `v${approvedPlan.version}` : '—'} caption={approvedPlan ? 'Approved' : 'No approved plan yet'} />
        <KpiCard label="Total planned units (approved)" value={approvedPlan?.totalPlannedUnits != null ? String(approvedPlan.totalPlannedUnits) : '—'} />
      </section>

      <section>
        <PageHeader title="Master plans" />
        <CreateMasterPlanForm estateId={estate.id} />
        <DataTable
          columns={[
            { header: 'Version', render: (p: MasterPlan) => `v${p.version}` },
            { header: 'Summary', render: (p: MasterPlan) => p.summary ?? '—' },
            { header: 'Total planned units', align: 'right', render: (p: MasterPlan) => (p.totalPlannedUnits != null ? String(p.totalPlannedUnits) : '—') },
            {
              header: 'Zones',
              render: (p: MasterPlan) =>
                p.zones.length === 0
                  ? '—'
                  : p.zones
                      .map((z) => `${z.code} (${PLOT_USE_TYPE_LABEL[z.useType] ?? z.useType})`)
                      .join(', '),
            },
            { header: 'Status', render: (p: MasterPlan) => <Badge tone={MASTER_PLAN_STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge> },
            { header: 'Approved', render: (p: MasterPlan) => (p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : '—') },
            {
              header: 'Actions',
              align: 'right',
              render: (p: MasterPlan) => <MasterPlanActions id={p.id} status={p.status} estateId={estate!.id} />,
            },
          ]}
          rows={masterPlans}
          keyOf={(p) => p.id}
          emptyMessage="No master plans for this estate yet."
        />
      </section>
    </PageContainer>
  );
}
