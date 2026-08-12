'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../../lib/api';

export interface EstateDetailActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-4.7 — Estate Master Planning detail
 * (`/land-bank/estates/[estateId]`), FE-4.6's own recommended next
 * checkpoint.
 *
 * `createMasterPlan` (`POST /land-bank/master-plans`, `landbank.manage`)
 * takes `estateId` + optional `summary`/`totalPlannedUnits`/`zones[]`
 * (`CreateMasterPlanDto`, confirmed directly). Each zone requires
 * `code`/`name`/`useType` (`MasterPlanZoneDto`) — `plannedAreaSqm`/
 * `plannedUnitCount` are its only optional fields. Version numbering
 * (`nextVersion = (latest?.version ?? 0) + 1`) is entirely server-side
 * — this action doesn't send or compute one.
 *
 * `approveMasterPlan` (`POST /land-bank/master-plans/:id/approve`) takes
 * NO body at all (confirmed directly — unlike `approveSurveyPlan`,
 * which at least receives a discarded `ApproveSurveyPlanDto`, this
 * route has no `@Body()` parameter whatsoever). Also has a real,
 * confirmed side effect this action doesn't need to replicate:
 * approving one plan server-side supersedes whichever plan for the same
 * estate was previously `APPROVED` (`LandBankService.approveMasterPlan`'s
 * own transaction) — `revalidatePath` alone is enough for this page to
 * pick up both status changes on next render.
 *
 * There is no `rejectMasterPlan` — confirmed directly, no such route
 * exists on `LandBankController` at all, unlike survey plans/titles
 * which both have a reject counterpart. `MasterPlanActions.tsx` is
 * Approve-only accordingly, not a smaller version of `SurveyPlanActions`
 * with Reject removed as an afterthought — there's genuinely nothing to
 * wire up.
 *
 * Both actions `revalidatePath` this detail route
 * (`/land-bank/estates/[estateId]`), not the register (`/land-bank`) —
 * same "don't invalidate a page the user isn't on" reasoning
 * `[parcelId]/actions.ts`'s own doc comment already established for its
 * own three actions.
 */
export async function createMasterPlan(input: {
  estateId: string;
  summary?: string;
  totalPlannedUnits?: number;
  zones?: { code: string; name: string; useType: string; plannedAreaSqm?: number; plannedUnitCount?: number }[];
}): Promise<EstateDetailActionState> {
  try {
    await fetchApi('/land-bank/master-plans', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create master plan.' };
  }

  revalidatePath(`/land-bank/estates/${input.estateId}`);
  return { ok: true };
}

export async function approveMasterPlan(masterPlanId: string, estateId: string): Promise<EstateDetailActionState> {
  try {
    await fetchApi(`/land-bank/master-plans/${masterPlanId}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve master plan.' };
  }

  revalidatePath(`/land-bank/estates/${estateId}`);
  return { ok: true };
}
