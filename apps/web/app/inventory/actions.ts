'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface InventoryActionState {
  ok: boolean;
  error?: string;
}

export interface StockBalance {
  stockItemId: string;
  warehouseId: string;
  quantityOnHand: string | number;
  averageUnitCost: string | number;
  totalValue: string | number;
}

export interface StockBalanceLookupState {
  ok: boolean;
  balance?: StockBalance | null;
  error?: string;
}

/**
 * Frontend Completion, FE-3.4 — Inventory, fourth checkpoint of Stage
 * FE-3 (FE-3.3's own recommended next checkpoint). `InventoryController`
 * covers six resources (Warehouses, Stock Items, Goods Receipt,
 * Material Issue, Stock Transfer, Stock Count); only Warehouses and
 * Stock Items have `GET` list endpoints (`findWarehouses`/
 * `findStockItems`, confirmed directly) — the four transaction types
 * each have only create + post, no list endpoint, the same
 * "no list endpoint, needs an id-entry pattern instead of a table" gap
 * `bank-reconciliation`'s sessions and `procurement`'s own GRN/Vendor
 * Invoices/Three-Way Match were skipped for. This checkpoint scopes to
 * Warehouses + Stock Items (both simple master data, neither has a
 * status/workflow field — `Warehouse`/`StockItem` confirmed directly
 * against `schema.prisma`, both just `isActive`), plus the one
 * genuinely list-free read this domain offers on its own: `GET
 * /inventory/balance`, a single `(stockItemId, warehouseId)` lookup
 * rather than a list — modeled here as a lookup action returning data,
 * not a create/mutate action returning `{ ok, error }` alone, since
 * there's a result to hand back to the caller on success.
 *
 * `createWarehouse`/`createStockItem` (`POST /inventory/warehouses`,
 * `POST /inventory/stock-items`, both `inventory.manage`) take a plain
 * inline body type on the controller side (no dedicated DTO class —
 * confirmed directly, `@Body() body: { entityId, code, name }` and
 * `{ entityId, code, name, domain, unitOfMeasure }`), unlike every
 * other create action in this codebase; the shapes below still match
 * those inline types exactly.
 */
export async function createWarehouse(input: { entityId: string; code: string; name: string }): Promise<InventoryActionState> {
  try {
    await fetchApi('/inventory/warehouses', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create warehouse.' };
  }

  revalidatePath('/inventory');
  return { ok: true };
}

export async function createStockItem(input: {
  entityId: string;
  code: string;
  name: string;
  domain: string;
  unitOfMeasure: string;
}): Promise<InventoryActionState> {
  try {
    await fetchApi('/inventory/stock-items', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create stock item.' };
  }

  revalidatePath('/inventory');
  return { ok: true };
}

export async function getStockBalance(stockItemId: string, warehouseId: string): Promise<StockBalanceLookupState> {
  try {
    const balance = await fetchApi<StockBalance | null>(
      `/inventory/balance?stockItemId=${stockItemId}&warehouseId=${warehouseId}`,
    );
    return { ok: true, balance };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to look up stock balance.' };
  }
}
