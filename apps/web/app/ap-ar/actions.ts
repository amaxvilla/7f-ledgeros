'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface ApArActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, AP.2 — this page's first write path (AP/AR.1
 * was read-only, two dashboard aggregates only). Same `fetchApi` +
 * `revalidatePath('/ap-ar')` shape every other module page's
 * `actions.ts` already uses (`createBudget`, most directly, for the
 * same nested-`lines` shape).
 */
export async function createAPInvoice(input: {
  entityId: string;
  invoiceNumber: string;
  vendorId: string;
  invoiceDate: string;
  dueDate?: string;
  lines: { description: string; accountId: string; quantity: number; unitCost: number }[];
}): Promise<ApArActionState> {
  try {
    await fetchApi('/ap/invoices', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create invoice.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true };
}

/**
 * Frontend Completion, AP.3 — `POST /ap/invoices/:id/post`
 * (`AccountsPayableController.postInvoice`, confirmed against
 * `PostAPInvoiceDto`: exactly one required field, `apControlAccountId`).
 * Same `fetchApi` + `revalidatePath('/ap-ar')` shape every write action
 * on this page already uses; unlike `createAPInvoice`/`createARInvoice`
 * this posts a single scalar body field rather than a nested-`lines`
 * payload, so it takes `id` and the account id as two plain arguments
 * (matching `submitBudget(id)`'s own single-id-argument shape, extended
 * by the one field this endpoint actually needs) rather than a single
 * input object.
 */
export async function postAPInvoice(id: string, apControlAccountId: string): Promise<ApArActionState> {
  try {
    await fetchApi(`/ap/invoices/${id}/post`, { method: 'POST', body: JSON.stringify({ apControlAccountId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to post invoice.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true };
}

/**
 * Frontend Completion, AR.3 — the direct AR mirror of `postAPInvoice`,
 * confirmed NOT identical: `PostARInvoiceDto` has the same one-field
 * shape (`arControlAccountId` in place of `apControlAccountId`), same
 * `ar.manage` permission gate, but `AccountsReceivableService.postInvoice`
 * has no `purchaseOrderId`/Procurement concept at all — read directly,
 * not assumed — so this endpoint only ever rejects on status, never on
 * a second condition the way AP's does.
 */
export async function postARInvoice(id: string, arControlAccountId: string): Promise<ApArActionState> {
  try {
    await fetchApi(`/ar/invoices/${id}/post`, { method: 'POST', body: JSON.stringify({ arControlAccountId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to post invoice.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true };
}

/**
 * Frontend Completion, AR.2 — the direct mirror of `createAPInvoice`,
 * same `fetchApi` + `revalidatePath('/ap-ar')` shape, posting to `POST
 * /ar/invoices` instead. `CreateARInvoiceDto`'s three optional per-line
 * fields (`projectId`/`phaseId`/`vatTaxCodeId`) are deliberately not
 * part of this input — see `CreateARInvoiceForm`'s own doc comment for
 * why each is scoped out this checkpoint.
 */
export async function createARInvoice(input: {
  entityId: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: string;
  dueDate?: string;
  lines: { description: string; accountId: string; quantity: number; unitPrice: number }[];
}): Promise<ApArActionState> {
  try {
    await fetchApi('/ar/invoices', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create invoice.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true };
}

export interface CreatePaymentBatchState extends ApArActionState {
  /**
   * The created batch's own id, returned directly in this action's own
   * response — NOT re-fetched via `revalidatePath` + a GET the way
   * every other create action on this page already works.
   * `AccountsPayableController` (confirmed directly) has no `GET
   * /ap/payment-batches` (list) or `GET /ap/payment-batches/:id`
   * (single) at all — the ONLY way to learn a batch's own id after
   * creating it is this response. `PaymentBatchActions.tsx` surfaces it
   * to the user for exactly that reason: there is nowhere else in this
   * app they could find it again on their own.
   */
  batchId?: string;
}

/**
 * Frontend Completion, AP.4 — Payment Batches, the feature FC-1.4's own
 * investigation surfaced (in place of a declined generic "bulk actions"
 * primitive — see that checkpoint's own report for why). Confirmed
 * directly against `AccountsPayableController`: `POST
 * /ap/payment-batches` (this action), `POST
 * /ap/payment-batches/:id/approve`, and `POST
 * /ap/payment-batches/:id/process` are the only three batch-level
 * routes — no read endpoint of any kind exists for this resource.
 * `CreatePaymentBatchDto` is a genuinely small, flat shape (`entityId`,
 * `batchNumber`, `paymentDate`) — no nested array, unlike
 * `CreatePaymentVoucherDto`'s own `allocations[]` (a separate, larger,
 * NOT-attempted-this-checkpoint piece — see `PaymentBatchActions.tsx`'s
 * own doc comment for the full scope line drawn between what this
 * checkpoint builds and what it deliberately leaves for a future one).
 */
export async function createPaymentBatch(input: {
  entityId: string;
  batchNumber: string;
  paymentDate: string;
}): Promise<CreatePaymentBatchState> {
  let batch: { id: string };
  try {
    batch = await fetchApi<{ id: string }>('/ap/payment-batches', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create payment batch.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true, batchId: batch.id };
}

/**
 * Frontend Completion, AP.4 — `AccountsPayableService.approvePaymentBatch`
 * (confirmed directly) only accepts a `DRAFT` batch, and separately
 * rejects the batch's own preparer approving their own batch
 * (`BadRequestException`, a maker-checker guard this action can't
 * pre-empt client-side — this app has no way to know, for an
 * arbitrary pasted batch id, who created it, without the read endpoint
 * that doesn't exist) — both surfaced as whatever error message the
 * backend itself returns, not guessed at or re-implemented here.
 */
export async function approvePaymentBatch(batchId: string): Promise<ApArActionState> {
  try {
    await fetchApi(`/ap/payment-batches/${batchId}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve payment batch.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true };
}

/**
 * Frontend Completion, AP.4 — `AccountsPayableService.processPaymentBatch`
 * (confirmed directly) only accepts an `APPROVED` batch, then posts
 * every `APPROVED` voucher inside it using the SAME `apControlAccountId`/
 * `cashGlAccountId` pair for all of them (`PostPaymentVoucherDto`,
 * confirmed directly — one shared GL posting pair per batch, not
 * per-voucher) before marking the batch itself `PROCESSED`.
 */
export async function processPaymentBatch(
  batchId: string,
  apControlAccountId: string,
  cashGlAccountId: string,
): Promise<ApArActionState> {
  try {
    await fetchApi(`/ap/payment-batches/${batchId}/process`, {
      method: 'POST',
      body: JSON.stringify({ apControlAccountId, cashGlAccountId }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to process payment batch.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true };
}

export interface CreatePaymentVoucherState extends ApArActionState {
  /**
   * The created voucher's own id, returned directly — same convention
   * `CreatePaymentBatchState.batchId` already established, and for the
   * same reason: no voucher list/table is fetched or rendered anywhere
   * on this page, even though `GET /ap/payment-vouchers/:id` itself
   * does exist (unlike batches).
   */
  voucherId?: string;
}

/**
 * Frontend Completion, AP.5 — see `CreatePaymentVoucherForm.tsx`'s own
 * doc comment for the full scoping rationale. `POST /ap/payment-vouchers`
 * (`ap.manage`, confirmed directly) — the response's own `id` is
 * returned as `voucherId`, not re-fetched via `revalidatePath` + a GET.
 */
export async function createPaymentVoucher(input: {
  entityId: string;
  voucherNumber: string;
  vendorId: string;
  batchId?: string;
  paymentDate: string;
  paymentMethod: string;
  bankAccountId: string;
  allocations: { vendorInvoiceId: string; amountAllocated: number }[];
}): Promise<CreatePaymentVoucherState> {
  let voucher: { id: string };
  try {
    voucher = await fetchApi<{ id: string }>('/ap/payment-vouchers', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create payment voucher.' };
  }

  revalidatePath('/ap-ar');
  return { ok: true, voucherId: voucher.id };
}

export interface PaymentVoucherSummary {
  id: string;
  voucherNumber: string;
  status: string;
}

export interface PaymentVoucherLookupState extends ApArActionState {
  voucher?: PaymentVoucherSummary | null;
}

/**
 * Frontend Completion, AP.6 — see `PaymentVoucherActions.tsx`'s own
 * doc comment for the full scoping rationale. `GET
 * /ap/payment-vouchers/:id` (`ap.view`, confirmed directly) returns the
 * full voucher including `allocations`; only `id`/`voucherNumber`/
 * `status` are surfaced here, the minimum this component's own UI
 * needs to decide which action to show — the same "return only what
 * the component renders" shape `getStockBalance`'s own `StockBalance`
 * type already established, not the full nested response.
 */
export async function lookupPaymentVoucher(id: string): Promise<PaymentVoucherLookupState> {
  try {
    const voucher = await fetchApi<{ id: string; voucherNumber: string; status: string }>(`/ap/payment-vouchers/${id}`);
    return { ok: true, voucher: { id: voucher.id, voucherNumber: voucher.voucherNumber, status: voucher.status } };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to look up payment voucher.' };
  }
}

/**
 * `POST /ap/payment-vouchers/:id/approve` (`ap.approve`, confirmed
 * directly). `AccountsPayableService.approvePaymentVoucher`'s own
 * guards (`DRAFT`-only; the preparer can't approve their own voucher)
 * are not re-implemented here — surfaced verbatim on failure.
 */
export async function approvePaymentVoucher(id: string): Promise<ApArActionState> {
  try {
    await fetchApi(`/ap/payment-vouchers/${id}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve payment voucher.' };
  }
  return { ok: true };
}

/**
 * `POST /ap/payment-vouchers/:id/post` (`ap.pay`, confirmed directly) —
 * `PostPaymentVoucherDto`, the same `apControlAccountId`/
 * `cashGlAccountId` shape `processPaymentBatch` already uses.
 * `APPROVED`-only, enforced server-side and surfaced verbatim.
 */
export async function postPaymentVoucher(
  id: string,
  apControlAccountId: string,
  cashGlAccountId: string,
): Promise<ApArActionState> {
  try {
    await fetchApi(`/ap/payment-vouchers/${id}/post`, {
      method: 'POST',
      body: JSON.stringify({ apControlAccountId, cashGlAccountId }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to post payment voucher.' };
  }
  return { ok: true };
}
