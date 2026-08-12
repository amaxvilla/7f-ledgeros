'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface WorkPackageActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, PMO.2 — Work Packages, the second link in PMO's
 * own BOQ -> Work Package -> Progress Valuation -> Interim Payment
 * Certificate chain (`PmoController`). `boq/actions.ts`'s own doc
 * comment named this as the direct continuation of PMO.1; this
 * checkpoint scopes to ONLY the Work Package resource — Progress
 * Valuations, Certificates, Variation Orders, Retention, and Final
 * Account remain later checkpoints, the same "one resource, not the
 * whole chain" discipline PMO.1 itself applied against the rest of the
 * chain.
 *
 * `createWorkPackage` (`POST /pmo/work-packages`, `pmo.manage`) takes
 * `projectId` (required), `phaseId` (optional — left off this form, no
 * `GET /dimensions/phases` list endpoint exists, same reasoning
 * `boq/actions.ts` already gives), `contractorId` (required here,
 * UNLIKE Boq's own optional `contractorId` — confirmed directly against
 * `schema.prisma`'s `WorkPackage.contractorId String` vs. `Boq.contractorId
 * String?`), `code`/`name` (required), `description` (optional), and
 * `budgetAmount` (required, `BadRequestException` thrown server-side if
 * <= 0 — confirmed directly in `PmoService.createWorkPackage`, not a
 * DTO-level `@Min`, but enforced all the same, and a duplicate
 * `projectId`+`code` pair is rejected too via `ConflictException`).
 * `contractorId` stays a plain required `TextField` — re-confirmed this
 * checkpoint (grepped every `*.controller.ts`/`*.service.ts` again) that
 * no `Contractor` list endpoint exists anywhere in this backend, the
 * same finding `CreateBoqForm.tsx`'s own doc comment already
 * established for Boq's optional version of the same field.
 *
 * `advanceWorkPackage` (`POST /pmo/work-packages/:id/advance`,
 * `pmo.approve`) is the exact same one-endpoint-for-advance-or-reject
 * shape `advanceBoq` already uses (`PmoService.advanceGeneric`, the
 * same shared `WORKFLOW_ORDER` every PMO document type moves through) —
 * `WorkPackageStatusActions.tsx` is the only caller and computes both
 * the correct "next" target and whether `REJECTED` should still be
 * offered, mirroring `BoqStatusActions.tsx` directly rather than this
 * file guessing at either.
 */
export async function createWorkPackage(input: {
  projectId: string;
  contractorId: string;
  code: string;
  name: string;
  description?: string;
  budgetAmount: number;
}): Promise<WorkPackageActionState> {
  try {
    await fetchApi('/pmo/work-packages', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create work package.' };
  }

  revalidatePath('/work-packages');
  return { ok: true };
}

export async function advanceWorkPackage(id: string, target: string): Promise<WorkPackageActionState> {
  try {
    await fetchApi(`/pmo/work-packages/${id}/advance`, { method: 'POST', body: JSON.stringify({ target }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update work package status.' };
  }

  revalidatePath('/work-packages');
  return { ok: true };
}
