'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface ProgressValuationActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, PMO.3 — Work Package detail (`/work-packages/[id]`),
 * the third link in PMO's own BOQ -> Work Package -> Progress Valuation ->
 * Interim Payment Certificate chain (`PmoController`). Named directly by
 * PMO.2's own report as the recommended next checkpoint.
 *
 * `createProgressValuation` (`POST /pmo/progress-valuations`,
 * `pmo.manage`) takes `workPackageId`, `valuationDate`, `percentComplete`
 * (server-validated `0-100`, `BadRequestException` otherwise — confirmed
 * directly in `PmoService.createProgressValuation`, not a DTO-level
 * `@Min`/`@Max`), and `valuationAmount` (the cumulative gross value of
 * work done to date, confirmed directly against the DTO's own inline
 * comment). `valuationNumber` is computed server-side (last valuation's
 * number + 1) and never sent from the client — confirmed directly, so
 * this form has no field for it at all.
 *
 * `advanceProgressValuation` (`POST /pmo/progress-valuations/:id/advance`,
 * `pmo.approve`) is the exact same one-endpoint-for-advance-or-reject
 * shape `advanceWorkPackage`/`advanceBoq` already use
 * (`PmoService.advanceGeneric`, the same shared `WORKFLOW_ORDER` every
 * PMO document type moves through) — `ProgressValuationStatusActions.tsx`
 * mirrors `WorkPackageStatusActions.tsx` directly.
 *
 * Both actions `revalidatePath` the detail route itself
 * (`/work-packages/[id]`), not the register (`/work-packages`) — the
 * register's own KPIs/rows don't depend on progress valuation data, so
 * revalidating it here would be a wasted cache invalidation.
 *
 * Addendum — Interim Payment Certificates (the direct continuation PMO.3
 * itself recommended): `generateCertificate` (`POST /pmo/certificates`,
 * `pmo.manage`) takes `progressValuationId`, `certificateNumber` (a
 * client-supplied, globally-unique string — confirmed directly against
 * `InterimPaymentCertificate.certificateNumber`'s own `@unique`, not
 * server-generated the way `valuationNumber` is), `retentionPercent`
 * (0-100, `BadRequestException` otherwise, confirmed directly in
 * `PmoService.generateCertificate`), and `issuedDate`. `createdById` is
 * injected server-side from the authenticated user, same as every other
 * PMO create endpoint. The gross/retention/net-payable arithmetic
 * (documented in that method's own doc comment) is entirely
 * server-computed — this action sends none of it.
 *
 * `advanceCertificate` is the same one-endpoint `advanceGeneric`/
 * `WORKFLOW_ORDER` shape every other PMO action in this file already
 * uses (`POST /pmo/certificates/:id/advance`, `pmo.approve`) —
 * `CertificateStatusActions.tsx` mirrors `ProgressValuationStatusActions.tsx`
 * directly, now the fourth real consumer of this shape.
 */
export async function createProgressValuation(input: {
  workPackageId: string;
  valuationDate: string;
  percentComplete: number;
  valuationAmount: number;
}): Promise<ProgressValuationActionState> {
  try {
    await fetchApi('/pmo/progress-valuations', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create progress valuation.' };
  }

  revalidatePath(`/work-packages/${input.workPackageId}`);
  return { ok: true };
}

export async function advanceProgressValuation(id: string, target: string, workPackageId: string): Promise<ProgressValuationActionState> {
  try {
    await fetchApi(`/pmo/progress-valuations/${id}/advance`, { method: 'POST', body: JSON.stringify({ target }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update progress valuation status.' };
  }

  revalidatePath(`/work-packages/${workPackageId}`);
  return { ok: true };
}

export interface CertificateActionState {
  ok: boolean;
  error?: string;
}

export async function generateCertificate(input: {
  progressValuationId: string;
  certificateNumber: string;
  retentionPercent: number;
  issuedDate: string;
  workPackageId: string;
}): Promise<CertificateActionState> {
  const { workPackageId, ...body } = input;
  try {
    await fetchApi('/pmo/certificates', { method: 'POST', body: JSON.stringify(body) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to generate certificate.' };
  }

  revalidatePath(`/work-packages/${workPackageId}`);
  return { ok: true };
}

export async function advanceCertificate(id: string, target: string, workPackageId: string): Promise<CertificateActionState> {
  try {
    await fetchApi(`/pmo/certificates/${id}/advance`, { method: 'POST', body: JSON.stringify({ target }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update certificate status.' };
  }

  revalidatePath(`/work-packages/${workPackageId}`);
  return { ok: true };
}

export interface RetentionActionState {
  ok: boolean;
  error?: string;
}

/**
 * `releaseRetention` (`POST /pmo/retentions/:id/release`, `pmo.manage`)
 * — see `ReleaseRetentionForm.tsx`'s own doc comment for why this
 * checkpoint's page only ever renders the form when a release is
 * actually possible. `retentionId` is the path param; `workPackageId`
 * here is only used for this action's own `revalidatePath`, the same
 * pattern every other action in this file already follows — it is NOT
 * sent in the request body.
 */
export async function releaseRetention(input: {
  retentionId: string;
  workPackageId: string;
  amount: number;
  releaseDate: string;
}): Promise<RetentionActionState> {
  const { retentionId, workPackageId, ...body } = input;
  try {
    await fetchApi(`/pmo/retentions/${retentionId}/release`, { method: 'POST', body: JSON.stringify(body) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to release retention.' };
  }

  revalidatePath(`/work-packages/${workPackageId}`);
  return { ok: true };
}

export interface VariationOrderActionState {
  ok: boolean;
  error?: string;
}

/**
 * Addendum — Variation Orders (following FE-5.5's own recommendation,
 * from the fixed-and-reverified baseline FIX.4 established).
 * `createVariationOrder` (`POST /pmo/variation-orders`, `pmo.manage`)
 * takes `workPackageId`, `voNumber`, `description`, `amount` — see
 * `CreateVariationOrderForm.tsx`'s own doc comment for the notable
 * finding that this DTO has no server-side validation at all (a plain
 * TypeScript interface, not a `class-validator` class), confirmed
 * directly rather than assumed from every other `Create*Dto` in this
 * codebase following that pattern.
 *
 * `advanceVariationOrder` is the same one-endpoint `advanceGeneric`/
 * `WORKFLOW_ORDER` shape every other PMO action in this file already
 * uses (`POST /pmo/variation-orders/:id/advance`, `pmo.approve`) —
 * `VariationOrderStatusActions.tsx` mirrors `CertificateStatusActions.tsx`
 * directly, now the fifth real consumer of this shape.
 */
export async function createVariationOrder(input: {
  workPackageId: string;
  voNumber: string;
  description: string;
  amount: number;
}): Promise<VariationOrderActionState> {
  try {
    await fetchApi('/pmo/variation-orders', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create variation order.' };
  }

  revalidatePath(`/work-packages/${input.workPackageId}`);
  return { ok: true };
}

export async function advanceVariationOrder(id: string, target: string, workPackageId: string): Promise<VariationOrderActionState> {
  try {
    await fetchApi(`/pmo/variation-orders/${id}/advance`, { method: 'POST', body: JSON.stringify({ target }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update variation order status.' };
  }

  revalidatePath(`/work-packages/${workPackageId}`);
  return { ok: true };
}
