import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateMaintenanceRequestForm } from './CreateMaintenanceRequestForm';
import { FacilityMaintenanceRequestsTable } from './FacilityManagementTables';

export const dynamic = 'force-dynamic';

interface MaintenanceOverview {
  entityId: string | null;
  byStatus: { status: string; count: number }[];
  openByPriority: { priority: string; count: number }[];
  facilitiesUnderMaintenance: number;
}

interface MaintenanceRequest {
  id: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  description: string;
  targetResolutionDate: string | null;
  createdAt: string;
}

const PRIORITY_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  LOW: 'neutral',
  MEDIUM: 'neutral',
  HIGH: 'warning',
  URGENT: 'negative',
};

const OPEN_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD']);

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'warning',
  ASSIGNED: 'warning',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'negative',
  RESOLVED: 'positive',
  CLOSED: 'positive',
  CANCELLED: 'neutral',
};

/**
 * Frontend Completion, Checkpoint N — the eighth Module Page, selected
 * the same way Tax was at Checkpoint M (see that page's own doc
 * comment): of the remaining domains with a dashboard aggregate but no
 * page yet, Facility Management / Maintenance Requests has both
 * `GET /dashboard/maintenance-overview` and a ready list endpoint
 * (`GET /facility/maintenance-requests`) — no new backend work
 * required, matching every prior page-selection checkpoint's own
 * criterion.
 *
 * Entity-scoped for both the KPIs and the requests table (unlike Tax,
 * where the Tax Codes table was reference data with no entityId at
 * all — MaintenanceRequest genuinely has one) — back to the "nothing
 * renders without an entityId" pattern Fixed Assets/CRM/Payments/
 * Recruitment established, which Tax was the one deliberate exception
 * to, not a new default.
 *
 * Does NOT surface the Facilities registry itself (GET /facility/facilities)
 * on this page — deliberately kept to the Maintenance Requests
 * operational view for this checkpoint, the same "don't try to fit two
 * different registries onto one page" restraint Tax's own doc comment
 * applied to /tax/position. A Facilities Registry sub-view is a natural
 * follow-on checkpoint, not bundled in here.
 *
 * Added to AppShell's NAV_LINKS as the eighth link in this same
 * checkpoint (see @7f/ui's AppShell.tsx) — CORRECTING an error from
 * this page's own first draft, which claimed no page was linked from
 * shared navigation at all. That was wrong: AppShell/Nav have existed
 * since Checkpoint A/E and every page since has added itself to
 * NAV_LINKS on landing; this page simply hadn't been added yet within
 * its own checkpoint, which is now fixed here rather than left as a
 * real (if narrower) gap.
 *
 * CreateMaintenanceRequestForm added as this app's sixth data-entry
 * form — see that component's own doc comment.
 */
export default async function FacilityManagementPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  let overview: MaintenanceOverview | null = null;
  let overviewError: string | null = null;
  let requests: MaintenanceRequest[] | null = null;
  let requestsError: string | null = null;

  if (entityId) {
    try {
      overview = await fetchApi<MaintenanceOverview>(`/dashboard/maintenance-overview?entityId=${entityId}`);
    } catch (e) {
      overviewError = e instanceof ApiError ? e.message : 'Failed to load maintenance overview.';
    }

    try {
      requests = await fetchApi<MaintenanceRequest[]>(`/facility/maintenance-requests?entityId=${entityId}`);
    } catch (e) {
      requestsError = e instanceof ApiError ? e.message : 'Failed to load maintenance requests.';
    }
  }

  const openCount = overview?.byStatus.filter((r) => OPEN_STATUSES.has(r.status)).reduce((sum, r) => sum + r.count, 0) ?? 0;
  const urgentOpenCount = overview?.openByPriority.find((r) => r.priority === 'URGENT')?.count ?? 0;

  return (
    <PageContainer>
      <PageHeader title="Facility Management" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to see maintenance requests.'} />
      <EntitySelector initialValue={entityId} />

      {entityId && overviewError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{overviewError}</div>
      )}

      {overview && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: tokens.space(4),
            marginBottom: tokens.space(8),
          }}
        >
          <KpiCard label="Open requests" value={String(openCount)} tone={openCount > 0 ? 'warning' : 'positive'} />
          <KpiCard label="Urgent (open)" value={String(urgentOpenCount)} tone={urgentOpenCount > 0 ? 'negative' : 'positive'} />
          <KpiCard label="Facilities under maintenance" value={String(overview.facilitiesUnderMaintenance)} />
        </section>
      )}

      {entityId && (
        <section>
          <PageHeader title="Maintenance requests" />
          <CreateMaintenanceRequestForm entityId={entityId} />
          {requestsError && (
            <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{requestsError}</div>
          )}
          {requests && (
            <FacilityMaintenanceRequestsTable rows={requests} />
          )}
        </section>
      )}
    </PageContainer>
  );
}
