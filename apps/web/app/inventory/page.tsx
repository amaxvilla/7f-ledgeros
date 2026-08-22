import { PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateWarehouseForm } from './CreateWarehouseForm';
import { CreateStockItemForm } from './CreateStockItemForm';
import { ImportItemsForm } from './ImportItemsForm';
import { StockBalanceLookup } from './StockBalanceLookup';
import { InventoryWarehousesTable, InventoryStockItemsTable } from './InventoryTables';
import { InventoryTransactionForms } from './InventoryTransactionForms';
import {
  InventoryReceiptsTable,
  InventoryIssuesTable,
  InventoryTransfersTable,
  InventoryCountsTable,
  InventoryMovementsTable,
} from './InventoryReadTables';
import type {
  InventoryReceiptRow,
  InventoryIssueRow,
  InventoryTransferRow,
  InventoryCountRow,
  InventoryMovementRow,
} from './InventoryReadTables';

export const dynamic = 'force-dynamic';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface StockItem {
  id: string;
  code: string;
  name: string;
  domain: string;
  unitOfMeasure: string;
  isActive: boolean;
}

/**
 * Frontend Completion, FE-3.4 — Inventory, fourth checkpoint of Stage
 * FE-3 (FE-3.3's own recommended next checkpoint). See `actions.ts`'s
 * own doc comment for why this page scopes to Warehouses + Stock Items
 * + the stock balance lookup out of `InventoryController`'s six
 * resources.
 *
 * Both Warehouses and Stock Items are entity-scoped
 * (`GET /inventory/warehouses?entityId=`, `GET /inventory/stock-items?entityId=`,
 * both confirmed directly), so — unlike General Ledger's Chart of
 * Accounts or Dimensions' Vendors/Customers, which are shared reference
 * data rendered ungated — everything on this page sits behind
 * `EntitySelector`, matching Budgeting/AP-AR/Procurement's own
 * fully-entity-scoped pages.
 *
 * `warehouseData`/`stockItemData` each bundle the `entityId` they were
 * loaded with alongside their rows, the same narrowing fix
 * `general-ledger/page.tsx`'s own ADDENDUM and `procurement/page.tsx`
 * both already apply, so `CreateWarehouseForm`'s/`CreateStockItemForm`'s
 * required `entityId: string` prop reads off the loaded data rather
 * than the outer, still-possibly-`undefined` `searchParams` value.
 */
export default async function InventoryPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let warehouseData: { entityId: string; warehouses: Warehouse[] } | null = null;
  let warehousesError: string | null = null;
  let stockItemData: { entityId: string; stockItems: StockItem[] } | null = null;
  let stockItemsError: string | null = null;
  let receiptRows: InventoryReceiptRow[] = [];
  let issueRows: InventoryIssueRow[] = [];
  let transferRows: InventoryTransferRow[] = [];
  let countRows: InventoryCountRow[] = [];
  let movementRows: InventoryMovementRow[] = [];
  let transactionReadError: string | null = null;

  if (entityId) {
    try {
      const warehouses = await fetchApi<Warehouse[]>(`/inventory/warehouses?entityId=${entityId}`);
      warehouseData = { entityId, warehouses };
    } catch (e) {
      warehousesError = e instanceof ApiError ? e.message : 'Failed to load warehouses.';
    }

    try {
      const stockItems = await fetchApi<StockItem[]>(`/inventory/stock-items?entityId=${entityId}`);
      stockItemData = { entityId, stockItems };

      try {
        [receiptRows, issueRows, transferRows, countRows, movementRows] =
          await Promise.all([
            fetchApi<InventoryReceiptRow[]>(`/inventory/goods-receipts?entityId=${encodeURIComponent(entityId)}&limit=100`),
            fetchApi<InventoryIssueRow[]>(`/inventory/material-issues?entityId=${encodeURIComponent(entityId)}&limit=100`),
            fetchApi<InventoryTransferRow[]>(`/inventory/stock-transfers?entityId=${encodeURIComponent(entityId)}&limit=100`),
            fetchApi<InventoryCountRow[]>(`/inventory/stock-counts?entityId=${encodeURIComponent(entityId)}&limit=100`),
            fetchApi<InventoryMovementRow[]>(`/inventory/movements?entityId=${encodeURIComponent(entityId)}&limit=200`),
          ]);
      } catch (e) {
        transactionReadError =
          e instanceof ApiError
            ? e.message
            : 'Failed to load inventory transaction history.';
      }
    } catch (e) {
      stockItemsError = e instanceof ApiError ? e.message : 'Failed to load stock items.';
    }
  }

  const warehouseOptions: SelectOption[] = (warehouseData?.warehouses ?? []).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));
  const stockItemOptions: SelectOption[] = (stockItemData?.stockItems ?? []).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to manage warehouses and stock items.'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Inventory' }]}
      />
      <EntitySelector initialValue={entityId} />

      {entityId && (warehouseData || stockItemData) && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Stock balance lookup" />
          <StockBalanceLookup stockItemOptions={stockItemOptions} warehouseOptions={warehouseOptions} />
        </section>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Warehouses" />
        {warehousesError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {warehousesError}
          </div>
        )}
        {warehouseData && (
          <>
            <CreateWarehouseForm entityId={warehouseData.entityId} />
            <InventoryWarehousesTable rows={warehouseData.warehouses} />
          </>
        )}
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Stock items" />
        {stockItemsError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {stockItemsError}
          </div>
        )}
        {stockItemData && (
          <>
            <CreateStockItemForm entityId={stockItemData.entityId} />
            <ImportItemsForm entityId={stockItemData.entityId} />
            <InventoryStockItemsTable rows={stockItemData.stockItems} />
          </>
        )}
      </section>

      {entityId && warehouseData && stockItemData && (
        <section>
          <PageHeader
            title="Inventory transactions"
            subtitle="Create and post goods receipts, material issues, stock transfers, and physical stock counts."
          />
          <InventoryTransactionForms
            warehouseOptions={warehouseOptions}
            stockItemOptions={stockItemOptions}
          />

          {transactionReadError && (
            <div
              style={{
                color: tokens.color.negative,
                fontFamily: tokens.font.body,
                marginTop: tokens.space(4),
              }}
            >
              {transactionReadError}
            </div>
          )}

          <section id="goods-receipts" style={{ marginTop: tokens.space(8) }}>
            <PageHeader title="Goods receipts" />
            <InventoryReceiptsTable rows={receiptRows} />
          </section>

          <section id="material-issues" style={{ marginTop: tokens.space(8) }}>
            <PageHeader title="Material issues" />
            <InventoryIssuesTable rows={issueRows} />
          </section>

          <section id="stock-transfers" style={{ marginTop: tokens.space(8) }}>
            <PageHeader title="Stock transfers" />
            <InventoryTransfersTable rows={transferRows} />
          </section>

          <section id="stock-counts" style={{ marginTop: tokens.space(8) }}>
            <PageHeader title="Stock counts" />
            <InventoryCountsTable rows={countRows} />
          </section>

          <section id="inventory-movements" style={{ marginTop: tokens.space(8) }}>
            <PageHeader title="Stock movement ledger" />
            <InventoryMovementsTable rows={movementRows} />
          </section>
        </section>
      )}
    </PageContainer>
  );
}
