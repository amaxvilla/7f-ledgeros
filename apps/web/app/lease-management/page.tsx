import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateLeaseForm } from './CreateLeaseForm';

export const dynamic = 'force-dynamic';

interface LeaseOverview {
  totalLeases: number;
  byStatus: Record<string, number>;
  expiringWithin60Days: number;
  monthlyRentRoll: number;
}

interface Lease {
  id: string;
  leaseNumber: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | string;
  rentAmount: number;
  rentFrequency: string;
  startDate: string;
  endDate: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  ACTIVE: 'positive',
  EXPIRED: 'warning',
  TERMINATED: 'negative',
};

/**
 * Frontend Completion, Checkpoint O — the ninth Module Page, selected
 * the same way Facility Management was at Checkpoint N: of the
 * remaining domains without a page, Lease Management has both a
 * dashboard aggregate (`GET /dashboard/lease-overview`, wrapping
 * LeaseService.getLeaseDashboardSummary()) and a ready list endpoint
 * (`GET /leases`) — no new backend work required.
 *
 * Entity-scoped for both KPIs and the leases table, same as every page
 * since Fixed Assets (Tax's reference-data table is the one deliberate
 * exception, not a pattern this page reverts back from).
 *
 * Does NOT surface Tenants (GET /tenants, a sibling resource in the
 * same lease.controller.ts file) on this page — kept to the Lease
 * registry itself for this checkpoint, matching the "don't fit two
 * registries onto one page" restraint every page since Facility
 * Management has applied. A Tenants page is a natural follow-on
 * checkpoint, not bundled in here.
 *
 * Added to AppShell's NAV_LINKS as the ninth link in this same
 * checkpoint (see @7f/ui's AppShell.tsx) — verified against the actual
 * rendered layout.tsx before writing this claim, not assumed (see
 * facility-management/page.tsx's own doc comment for why that
 * verification step matters here specifically).
 *
 * CreateLeaseForm added as this app's fifth data-entry form — see that
 * component's own doc comment.
 */
export default async function LeaseManagementPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  let overview: LeaseOverview | null = null;
  let overviewError: string | null = null;
  let leases: Lease[] | null = null;
  let leasesError: string | null = null;

  if (entityId) {
    try {
      overview = await fetchApi<LeaseOverview>(`/dashboard/lease-overview?entityId=${entityId}`);
    } catch (e) {
      overviewError = e instanceof ApiError ? e.message : 'Failed to load lease overview.';
    }

    try {
      leases = await fetchApi<Lease[]>(`/leases?entityId=${entityId}`);
    } catch (e) {
      leasesError = e instanceof ApiError ? e.message : 'Failed to load leases.';
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Lease Management" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to see leases.'} />
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
          <KpiCard label="Total leases" value={String(overview.totalLeases)} />
          <KpiCard label="Active" value={String(overview.byStatus.ACTIVE ?? 0)} tone="positive" />
          <KpiCard
            label="Expiring within 60 days"
            value={String(overview.expiringWithin60Days)}
            tone={overview.expiringWithin60Days > 0 ? 'warning' : 'positive'}
          />
          <KpiCard label="Monthly rent roll" value={formatCurrency(overview.monthlyRentRoll)} caption="Monthly-frequency active leases only" />
        </section>
      )}

      {entityId && (
        <section>
          <PageHeader title="Leases" />
          <CreateLeaseForm entityId={entityId} />
          {leasesError && (
            <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{leasesError}</div>
          )}
          {leases && (
            <DataTable
              columns={[
                { header: 'Lease #', render: (r: Lease) => r.leaseNumber },
                { header: 'Status', render: (r: Lease) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
                { header: 'Rent', render: (r: Lease) => `${formatCurrency(r.rentAmount)} / ${r.rentFrequency.toLowerCase()}` },
                { header: 'Start', render: (r: Lease) => new Date(r.startDate).toLocaleDateString() },
                { header: 'End', render: (r: Lease) => new Date(r.endDate).toLocaleDateString() },
              ]}
              rows={leases}
              keyOf={(r) => r.id}
              emptyMessage="No leases for this entity."
            />
          )}
        </section>
      )}
    </PageContainer>
  );
}
