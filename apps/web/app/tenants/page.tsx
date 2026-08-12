import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateTenantForm } from './CreateTenantForm';

export const dynamic = 'force-dynamic';

interface Tenant {
  id: string;
  status: 'ACTIVE' | 'FORMER' | string;
  moveInDate: string;
  moveOutDate: string | null;
  customer: { name: string; code: string };
  unit: { code: string; name: string | null };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  FORMER: 'neutral',
};

/**
 * Frontend Completion, Checkpoint P — the tenth Module Page, and the
 * exact follow-on Checkpoint O's own doc comment named: `GET /tenants`
 * (TenantController, apps/api/src/lease/lease.controller.ts) is a
 * sibling resource to `GET /leases` that Checkpoint O deliberately left
 * off the Lease Management page rather than fitting two registries onto
 * one page — same restraint every page since Facility Management has
 * applied.
 *
 * NO KPI section, unlike every entity-scoped page since Fixed Assets —
 * verified before writing this page that no `/dashboard/tenant-*`
 * aggregate exists (dashboard.controller.ts has no `tenant` route at
 * all). Rather than inventing a dashboard aggregate just to give this
 * page a KPI row (backend work outside this checkpoint's own scope —
 * Frontend Completion, not a new Dashboard endpoint), this page is
 * table-only, structured like Tax's Tax Codes section rather than like
 * Lease Management's own overview-plus-table structure. Unlike Tax
 * Codes (unconditional — shared reference data), the Tenants table
 * itself IS entity-scoped (Tenant.entityId is a real column, unlike
 * TaxCode), so it stays gated behind EntitySelector having a value, the
 * same way Lease Management's own leases table is.
 *
 * `customer.name`/`unit.code` come from LeaseService.findTenants()'s
 * own `include: { customer: true, unit: true }` — no new backend
 * projection needed, same "the list endpoint already returns what the
 * table needs" situation every module page so far has had.
 *
 * Added to AppShell's NAV_LINKS as the tenth link in this same
 * checkpoint (see @7f/ui's AppShell.tsx) — verified against the actual
 * rendered layout.tsx before writing this claim, matching every prior
 * page's own verification step.
 *
 * ADDENDUM — Frontend Completion, Checkpoint Q: renders CreateTenantForm
 * above the table, gated behind the same entityId presence — the first
 * data-entry form in this app. See that component's own doc comment for
 * the customerId/unitId-as-plain-text-input simplification and why a
 * Server Action (apps/web/app/tenants/actions.ts), not a direct
 * client-side fetchApi call, is what makes this possible at all.
 */
export default async function TenantsPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  let tenants: Tenant[] | null = null;
  let tenantsError: string | null = null;

  if (entityId) {
    try {
      tenants = await fetchApi<Tenant[]>(`/tenants?entityId=${entityId}`);
    } catch (e) {
      tenantsError = e instanceof ApiError ? e.message : 'Failed to load tenants.';
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Tenants" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to see tenants.'} />
      <EntitySelector initialValue={entityId} />

      {entityId && (
        <section style={{ marginTop: tokens.space(8) }}>
          <CreateTenantForm entityId={entityId} />
          {tenantsError && (
            <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{tenantsError}</div>
          )}
          {tenants && (
            <DataTable
              columns={[
                { header: 'Customer', render: (r: Tenant) => `${r.customer.name} (${r.customer.code})` },
                { header: 'Unit', render: (r: Tenant) => r.unit.name ?? r.unit.code },
                { header: 'Status', render: (r: Tenant) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
                { header: 'Move-in', render: (r: Tenant) => new Date(r.moveInDate).toLocaleDateString() },
                { header: 'Move-out', render: (r: Tenant) => (r.moveOutDate ? new Date(r.moveOutDate).toLocaleDateString() : '—') },
              ]}
              rows={tenants}
              keyOf={(r) => r.id}
              emptyMessage="No tenants for this entity."
            />
          )}
        </section>
      )}
    </PageContainer>
  );
}
