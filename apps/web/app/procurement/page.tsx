import { PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateRequisitionForm } from './CreateRequisitionForm';
import { CreatePurchaseOrderForm } from './CreatePurchaseOrderForm';
import { RequisitionStatusActions } from './RequisitionStatusActions';
import { PurchaseOrderStatusActions } from './PurchaseOrderStatusActions';
import { ProcurementRequisitionsTable, ProcurementPurchaseOrdersTable } from './ProcurementTables';

export const dynamic = 'force-dynamic';

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Project {
  id: string;
  code: string;
  name: string;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

interface Requisition {
  id: string;
  prNumber: string;
  status: string;
  projectId: string | null;
  justification: string | null;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  orderDate: string;
  createdAt: string;
}

const PR_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'negative',
  CLOSED: 'neutral',
};

const PO_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  PARTIALLY_RECEIVED: 'warning',
  FULLY_RECEIVED: 'positive',
  PARTIALLY_INVOICED: 'warning',
  FULLY_INVOICED: 'positive',
  CLOSED: 'neutral',
  CANCELLED: 'negative',
};

/**
 * Frontend Completion, FE-3.3 — Procurement, third checkpoint of Stage
 * FE-3. See `actions.ts`'s own doc comment for why this page scopes to
 * Requisitions + Purchase Orders out of `ProcurementController`'s five
 * resources.
 *
 * Both `Requisition` and `PurchaseOrder` list responses come back with
 * NO `lines` included (`findAllRequisitions`/`findAllPurchaseOrders`,
 * confirmed directly — neither has an `include`), unlike
 * `general-ledger/page.tsx`'s own `JournalEntry[]` (which does include
 * `lines`) — so this page's two tables show header fields only, with no
 * computed line-total column the way General Ledger's Debit/Credit
 * columns work; a total would need either a second per-row fetch or a
 * backend aggregate this checkpoint doesn't add.
 *
 * `accountOptions`/`vendorOptions`/`projectOptions` are all fetched
 * unconditionally alongside the entity-gated data, same "fetch once in
 * the Server Component, pass down to whichever form needs it" shape
 * `general-ledger/page.tsx` and `dimensions/page.tsx` both already use.
 *
 * `loadRequisitions`/`loadPurchaseOrders` each return the `entityId`
 * they were called with alongside their data, the same fix
 * `general-ledger/page.tsx`'s own ADDENDUM applied after a real `tsc`
 * run: passing the outer, still-`string | undefined` `entityId`
 * variable straight into `CreateRequisitionForm`'s/
 * `CreatePurchaseOrderForm`'s required `entityId: string` prop inside
 * an `{if-truthy}` block doesn't type-narrow on its own, but reading it
 * back off the loaded data object (itself only ever set when `entityId`
 * was truthy) does.
 */
export default async function ProcurementPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let accounts: Account[] | null = null;
  let accountsError: string | null = null;
  try {
    accounts = await fetchApi<Account[]>('/accounts?activeOnly=true');
  } catch (e) {
    accountsError = e instanceof ApiError ? e.message : 'Failed to load chart of accounts.';
  }
  const accountOptions: SelectOption[] = (accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  let vendors: Vendor[] | null = null;
  let vendorsError: string | null = null;
  try {
    vendors = await fetchApi<Vendor[]>('/dimensions/vendors');
  } catch (e) {
    vendorsError = e instanceof ApiError ? e.message : 'Failed to load vendors.';
  }
  const vendorOptions: SelectOption[] = (vendors ?? []).map((v) => ({ value: v.id, label: `${v.code} — ${v.name}` }));
  const vendorLabel = (id: string) => vendors?.find((v) => v.id === id)?.name ?? id;

  let requisitionData: { entityId: string; requisitions: Requisition[] } | null = null;
  let requisitionsError: string | null = null;
  let poData: { entityId: string; purchaseOrders: PurchaseOrder[] } | null = null;
  let purchaseOrdersError: string | null = null;
  let projectOptions: SelectOption[] = [];

  if (entityId) {
    try {
      const [requisitions, projects] = await Promise.all([
        fetchApi<Requisition[]>(`/procurement/requisitions?entityId=${entityId}`),
        fetchApi<Project[]>(`/dimensions/projects?entityId=${entityId}`),
      ]);
      requisitionData = { entityId, requisitions };
      projectOptions = projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
    } catch (e) {
      requisitionsError = e instanceof ApiError ? e.message : 'Failed to load requisitions.';
    }

    try {
      const purchaseOrders = await fetchApi<PurchaseOrder[]>(`/procurement/purchase-orders?entityId=${entityId}`);
      poData = { entityId, purchaseOrders };
    } catch (e) {
      purchaseOrdersError = e instanceof ApiError ? e.message : 'Failed to load purchase orders.';
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Procurement"
        subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to manage requisitions and purchase orders.'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Procurement' }]}
      />
      <EntitySelector initialValue={entityId} />

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Purchase requisitions" />
        {requisitionsError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {requisitionsError}
          </div>
        )}
        {requisitionData && (
          <>
            <CreateRequisitionForm entityId={requisitionData.entityId} accountOptions={accountOptions} projectOptions={projectOptions} />
            <ProcurementRequisitionsTable rows={requisitionData.requisitions} />
          </>
        )}
      </section>

      <section>
        <PageHeader title="Purchase orders" />
        {vendorsError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {vendorsError}
          </div>
        )}
        {accountsError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {accountsError}
          </div>
        )}
        {purchaseOrdersError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {purchaseOrdersError}
          </div>
        )}
        {poData && (
          <>
            <CreatePurchaseOrderForm entityId={poData.entityId} accountOptions={accountOptions} vendorOptions={vendorOptions} />
            <ProcurementPurchaseOrdersTable rows={poData.purchaseOrders} vendors={vendors ?? []} />
          </>
        )}
      </section>
    </PageContainer>
  );
}
