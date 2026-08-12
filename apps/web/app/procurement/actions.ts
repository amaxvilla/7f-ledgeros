'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface ProcurementActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-3.3 — Procurement, third checkpoint of Stage
 * FE-3. `ProcurementController` covers five resources (Requisitions,
 * Purchase Orders, Goods Receipt, Vendor Invoices, Three-Way Match);
 * only Requisitions and Purchase Orders have `GET` list endpoints
 * (`findAllRequisitions`/`findAllPurchaseOrders`, both confirmed
 * directly) — GRN/Vendor Invoices/Three-Way Match are each only
 * fetchable by id, the same "no list endpoint, needs an id-entry
 * pattern instead of a table" shape `bank-reconciliation`'s own
 * sessions have (named as the reason that domain was skipped for this
 * checkpoint). This checkpoint scopes to Requisitions + Purchase
 * Orders — the two list-able resources, and the two that chain
 * directly into each other (a PO can reference an approved
 * requisition) — leaving GRN/Vendor Invoices/Three-Way Match for a
 * later checkpoint once an id-entry page pattern exists.
 *
 * `createRequisition` (`POST /procurement/requisitions`,
 * `procurement.manage`) always creates a `DRAFT` (`schema.prisma`'s own
 * `@default(DRAFT)` on `PurchaseRequisition.status`, confirmed
 * directly). `submitRequisition`/`approveRequisition`/
 * `rejectRequisition` mirror `ProcurementController`'s own three
 * distinct endpoints — confirmed directly against
 * `ProcurementService.submitRequisition`/`.approveRequisition`/
 * `.rejectRequisition`'s own `assertPRStatus` guards: submit requires
 * `DRAFT` or `REJECTED`, approve/reject both require `SUBMITTED`. Both
 * decision endpoints take an optional `{ comments }` body
 * (`RequisitionDecisionDto`), the same shape `approveBudget`/
 * `rejectBudget` already use.
 *
 * `createPurchaseOrder` (`POST /procurement/purchase-orders`,
 * `procurement.manage`) also always creates a `DRAFT`.
 * `approvePurchaseOrder`/`rejectPurchaseOrder` both require `DRAFT`
 * (`assertPOStatus`, confirmed directly) and take NO body at all —
 * unlike the requisition decision endpoints, there is no PO-level
 * comments field on either route.
 */
export async function createRequisition(input: {
  entityId: string;
  prNumber: string;
  projectId?: string;
  justification?: string;
  lines: { description: string; accountId: string; quantity: number; estimatedUnitCost: number }[];
}): Promise<ProcurementActionState> {
  try {
    await fetchApi('/procurement/requisitions', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create requisition.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}

export async function submitRequisition(id: string): Promise<ProcurementActionState> {
  try {
    await fetchApi(`/procurement/requisitions/${id}/submit`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit requisition.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}

export async function approveRequisition(id: string, comments?: string): Promise<ProcurementActionState> {
  try {
    await fetchApi(`/procurement/requisitions/${id}/approve`, { method: 'POST', body: JSON.stringify({ comments }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve requisition.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}

export async function rejectRequisition(id: string, comments?: string): Promise<ProcurementActionState> {
  try {
    await fetchApi(`/procurement/requisitions/${id}/reject`, { method: 'POST', body: JSON.stringify({ comments }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject requisition.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}

export async function createPurchaseOrder(input: {
  entityId: string;
  poNumber: string;
  requisitionId?: string;
  vendorId: string;
  orderDate: string;
  lines: { description: string; accountId: string; budgetLineId: string; quantity: number; unitCost: number }[];
}): Promise<ProcurementActionState> {
  try {
    await fetchApi('/procurement/purchase-orders', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create purchase order.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}

export async function approvePurchaseOrder(id: string): Promise<ProcurementActionState> {
  try {
    await fetchApi(`/procurement/purchase-orders/${id}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve purchase order.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}

export async function rejectPurchaseOrder(id: string): Promise<ProcurementActionState> {
  try {
    await fetchApi(`/procurement/purchase-orders/${id}/reject`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject purchase order.' };
  }

  revalidatePath('/procurement');
  return { ok: true };
}
