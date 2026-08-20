'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface InventoryActionState {
  ok: boolean;
  id?: string;
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export async function createWarehouse(
  input: { entityId: string; code: string; name: string },
): Promise<InventoryActionState> {
  try {
    const result = await fetchApi<{ id: string }>('/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath('/inventory');

    return { ok: true, id: result.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Failed to create warehouse.') };
  }
}

export async function createStockItem(
  input: {
    entityId: string;
    code: string;
    name: string;
    domain: string;
    unitOfMeasure: string;
  },
): Promise<InventoryActionState> {
  try {
    const result = await fetchApi<{ id: string }>('/inventory/stock-items', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    revalidatePath('/inventory');

    return { ok: true, id: result.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Failed to create stock item.') };
  }
}

export async function getStockBalance(
  stockItemId: string,
  warehouseId: string,
): Promise<StockBalanceLookupState> {
  try {
    const balance = await fetchApi<StockBalance | null>(
      `/inventory/balance?stockItemId=${encodeURIComponent(stockItemId)}&warehouseId=${encodeURIComponent(warehouseId)}`,
    );

    return { ok: true, balance };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to look up stock balance.'),
    };
  }
}

export async function createGoodsReceipt(input: {
  warehouseId: string;
  vendorId?: string;
  receiptDate: string;
  referenceNumber?: string;
  lines: { stockItemId: string; quantity: number; unitCost: number }[];
}): Promise<InventoryActionState> {
  try {
    const result = await fetchApi<{ id: string }>('/inventory/goods-receipts', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return { ok: true, id: result.id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to create goods receipt.'),
    };
  }
}

export async function postGoodsReceipt(id: string): Promise<InventoryActionState> {
  try {
    await fetchApi(`/inventory/goods-receipts/${encodeURIComponent(id)}/post`, {
      method: 'POST',
    });

    revalidatePath('/inventory');

    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to post goods receipt.'),
    };
  }
}

export async function createMaterialIssue(input: {
  warehouseId: string;
  projectId?: string;
  costCenterId?: string;
  issueDate: string;
  purpose?: string;
  lines: { stockItemId: string; quantity: number }[];
}): Promise<InventoryActionState> {
  try {
    const result = await fetchApi<{ id: string }>('/inventory/material-issues', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return { ok: true, id: result.id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to create material issue.'),
    };
  }
}

export async function postMaterialIssue(id: string): Promise<InventoryActionState> {
  try {
    await fetchApi(`/inventory/material-issues/${encodeURIComponent(id)}/post`, {
      method: 'POST',
    });

    revalidatePath('/inventory');

    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to post material issue.'),
    };
  }
}

export async function createStockTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  lines: { stockItemId: string; quantity: number }[];
}): Promise<InventoryActionState> {
  try {
    const result = await fetchApi<{ id: string }>('/inventory/stock-transfers', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return { ok: true, id: result.id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to create stock transfer.'),
    };
  }
}

export async function postStockTransfer(id: string): Promise<InventoryActionState> {
  try {
    await fetchApi(`/inventory/stock-transfers/${encodeURIComponent(id)}/post`, {
      method: 'POST',
    });

    revalidatePath('/inventory');

    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to post stock transfer.'),
    };
  }
}

export async function createStockCount(input: {
  warehouseId: string;
  countDate: string;
  lines: { stockItemId: string; countedQuantity: number }[];
}): Promise<InventoryActionState> {
  try {
    const result = await fetchApi<{ id: string }>('/inventory/stock-counts', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return { ok: true, id: result.id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to create stock count.'),
    };
  }
}

export async function postStockCount(id: string): Promise<InventoryActionState> {
  try {
    await fetchApi(`/inventory/stock-counts/${encodeURIComponent(id)}/post`, {
      method: 'POST',
    });

    revalidatePath('/inventory');

    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to post stock count.'),
    };
  }
}
