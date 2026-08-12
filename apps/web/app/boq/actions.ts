'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface BoqActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, PMO.1 — the Bill of Quantities register, the
 * first page for PMO's own Work Package chain (`PmoController`).
 * Project Risks' own doc comment (`app/project-risks/page.tsx`)
 * explicitly named this chain — BOQ -> Work Package -> Progress
 * Valuation -> Interim Payment Certificate, plus Variation Orders,
 * Retention, and Final Account — as the bigger, differently-shaped
 * checkpoint it deliberately deferred, because every document type in
 * it moves through the SAME multi-stage `advance()` workflow
 * (`PmoService.advanceGeneric`, confirmed directly: DRAFT -> REVIEWED
 * -> APPROVED -> CERTIFIED, one step at a time, or REJECTED from any
 * non-CERTIFIED status) rather than Risk/Issue's own single terminal
 * `close`/`resolve`. This checkpoint scopes to ONLY the BOQ resource —
 * the first, smallest link in that chain — leaving Work Packages,
 * Progress Valuations, Certificates, Variation Orders, Retention, and
 * Final Account for later checkpoints, the same "one resource, not the
 * whole chain" discipline `project-risks` applied to Risks vs. Issues.
 *
 * `createBoq` (`POST /pmo/boqs`, `pmo.manage`) takes `projectId`
 * (required), `phaseId`/`contractorId` (both optional), `title`
 * (required), and `lines` (`BadRequestException` thrown server-side if
 * empty — read directly in `PmoService.createBoq`, not a DTO-level
 * `@ArrayMinSize`, but enforced all the same). `phaseId` is left off
 * this form: unlike `projectId` (see below), there is no
 * `GET /dimensions/phases` list endpoint anywhere in this backend
 * (only `POST /dimensions/phases` and a project's own nested
 * `GET /dimensions/projects/:id/tree`) — the same "no registry to build
 * a Select from" reasoning `CreateBudgetForm`'s own doc comment applies
 * to its five left-out optional dimension ids.
 *
 * `advanceBoq` (`POST /pmo/boqs/:id/advance`, `pmo.approve`) is ONE
 * endpoint for both "advance to the next step" and "reject" — the
 * caller supplies `target` (confirmed directly against
 * `PmoService.advanceGeneric`: `REJECTED` is handled as its own branch,
 * separate from the one-step-at-a-time `WORKFLOW_ORDER` check every
 * other target goes through). `BoqStatusActions.tsx` is the only
 * caller and computes both the correct "next" target and whether
 * `REJECTED` should still be offered, rather than this file guessing at
 * either.
 */
export async function createBoq(input: {
  projectId: string;
  contractorId?: string;
  title: string;
  lines: { itemCode: string; description: string; unit: string; quantity: number; rate: number }[];
}): Promise<BoqActionState> {
  try {
    await fetchApi('/pmo/boqs', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create BOQ.' };
  }

  revalidatePath('/boq');
  return { ok: true };
}

export async function advanceBoq(id: string, target: string): Promise<BoqActionState> {
  try {
    await fetchApi(`/pmo/boqs/${id}/advance`, { method: 'POST', body: JSON.stringify({ target }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update BOQ status.' };
  }

  revalidatePath('/boq');
  return { ok: true };
}
