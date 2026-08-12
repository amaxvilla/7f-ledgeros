'use server';

import { fetchApi, ApiError } from '../../lib/api';

export interface RevenueRecognitionActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-3.5 — Revenue Recognition, fifth checkpoint
 * of Stage FE-3 (FE-3.4's own recommended next checkpoint, chosen over
 * Bank Reconciliation specifically to check whether it had a list
 * endpoint Bank Reconciliation lacked). It doesn't: `RevenueRecognitionController`
 * has exactly two routes, both `@Post`, no `@Get` at all (confirmed
 * directly) — every other FE-3 checkpoint so far has had at least one
 * list-able resource to build a `DataTable` around; this one has none,
 * so this page is two standalone command forms with no table, the
 * clearest instance yet of the "no list endpoint" gap named in every
 * prior FE-3 checkpoint's own doc comment (Bank Reconciliation,
 * Procurement's GRN/Invoices/Three-Way Match, Inventory's four
 * transaction types) — except here it's the ENTIRE module, not one
 * resource within it, so there's no partial slice to take; the whole
 * module is these two forms.
 *
 * `recordPayment` (`POST /revenue-recognition/customer-payments`,
 * `revenue.recognize`) takes NO `entityId` at all — a verified defect
 * fix (confirmed directly against the controller's own comment):
 * `entityId` used to be client-supplied and is now derived server-side
 * from `installmentLineId`, so this action's own input type has no
 * `entityId` field and its form isn't gated behind `EntitySelector`.
 *
 * `recognizeHandover` (`POST /revenue-recognition/handovers`,
 * `revenue.recognize`) DOES still take `entityId` from the client
 * (confirmed directly, with its own `RlsBodyCheck`), so unlike
 * `recordPayment` its form IS gated behind `EntitySelector` — the two
 * actions on this one page differ in that respect, mirroring the
 * genuine difference between the two endpoints rather than gating both
 * the same way for consistency.
 *
 * Both GL account id fields on both DTOs (`bankAccountGlId`,
 * `deferredRevenueGlId`, `propertySalesRevenueGlId`, `costOfSalesGlId`,
 * `propertyInventoryGlId`) use `accountOptions` from `GET /accounts` —
 * the same registry `general-ledger/page.tsx` and `procurement/page.tsx`
 * already fetch. `installmentLineId` and `unitId` stay plain `TextField`
 * ids: neither Mortgage Installment Lines nor Real Estate Units have a
 * list-by-entity endpoint confirmed in this checkpoint's own scope —
 * same "no registry, don't invent one" restraint `CreatePurchaseOrderForm`'s
 * own doc comment gives for `requisitionId`.
 */
export async function recordCustomerPayment(input: {
  installmentLineId: string;
  amount: number;
  entryDate: string;
  bankAccountGlId: string;
  deferredRevenueGlId: string;
}): Promise<RevenueRecognitionActionState> {
  try {
    await fetchApi('/revenue-recognition/customer-payments', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record customer payment.' };
  }

  return { ok: true };
}

export async function recognizeHandoverRevenue(input: {
  entityId: string;
  unitId: string;
  entryDate: string;
  salePrice: number;
  costOfUnit: number;
  deferredRevenueGlId: string;
  propertySalesRevenueGlId: string;
  costOfSalesGlId: string;
  propertyInventoryGlId: string;
}): Promise<RevenueRecognitionActionState> {
  try {
    await fetchApi('/revenue-recognition/handovers', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to recognize handover revenue.' };
  }

  return { ok: true };
}
