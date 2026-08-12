'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface LandBankDetailActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-4.2 — Land Parcel detail (`/land-bank/[parcelId]`),
 * FE-4.1's own recommended next checkpoint. `LandBankController` still
 * has a large remaining surface after Titles — Survey Plans, Plots,
 * Master Plans, Plot Releases — deliberately scoped OUT of this
 * checkpoint the same "smallest correct slice" way FE-4.1 itself
 * scoped Land Bank down to Parcels + Acquisitions. Titles alone is
 * already a real, complete vertical slice (create -> perfect/reject),
 * the same size as FE-4.1's own two pieces.
 *
 * `GET /land-bank/parcels/:parcelId` (`getParcel`) already `include`s
 * `titleDeeds` directly (confirmed directly in `LandBankService.getParcel`)
 * — no separate call to `findTitleDeeds` needed for this page's own
 * read path; `page.tsx` uses the one parcel fetch for everything it
 * renders, Titles included.
 *
 * `addTitleDeed` (`POST /land-bank/titles`, `landbank.manage`) creates
 * a title starting `IN_PROGRESS` (confirmed directly — NOT the schema
 * column default of `PENDING`; `PENDING` appears to be unreachable
 * through any current endpoint, confirmed by reading every title
 * mutation in `LandBankService` — a pre-existing backend quirk, not
 * something this checkpoint's frontend needs to work around or
 * silently hide). Adding a title also has a real parcel-status side
 * effect (`IN_TITLING`, unless the parcel is already `TITLED` —
 * confirmed directly) that this action doesn't need to know about;
 * `revalidatePath` on the detail route is enough for the parcel header
 * to pick up the new status on next render.
 *
 * `perfectTitleDeed` (`POST /land-bank/titles/:titleId/perfect`) takes
 * `issuedDate` (required), `expiryDate`/`titleNumber` (both optional —
 * `titleNumber` overrides the one set at creation if provided, confirmed
 * directly: `titleNumber ?? title.titleNumber`) and ALSO sets the parent
 * parcel to `TITLED` server-side (confirmed directly, another side
 * effect this action doesn't duplicate).
 *
 * `rejectTitleDeed` (`POST /land-bank/titles/:titleId/reject`) takes a
 * required `reason`, appended into the title's own `notes` column
 * server-side (`[title.notes, 'Rejected: ' + reason].filter(Boolean).join(' | ')`,
 * confirmed directly) — NOT a dedicated rejection-reason column, so
 * this page's own Titles table renders `notes` as-is rather than
 * parsing a rejection reason back out of it.
 *
 * All three actions `revalidatePath` the detail route itself
 * (`/land-bank/[parcelId]`), not the register (`/land-bank`) — the
 * register's own table already shows `titleDeeds.length` as a count,
 * but re-fetching the whole entity-scoped register on every title edit
 * here would be a wasted invalidation for a page the user isn't on.
 *
 * Addendum, FE-4.3 — Survey Plans: `createSurveyPlan` (`POST
 * /land-bank/survey-plans`) creates a plan starting `SUBMITTED`
 * (confirmed directly — schema default is `DRAFT`, same "create
 * endpoint skips the schema default" quirk Titles' own `PENDING`
 * already established, not this checkpoint's to fix). `approveSurveyPlan`
 * (`POST /land-bank/survey-plans/:id/approve`) takes NO body at all —
 * confirmed directly that the controller receives but discards
 * `ApproveSurveyPlanDto.notes` (`@Body() _dto`) — so this action takes
 * no `input` parameter, unlike every other action in this file.
 * `approveSurveyPlan` also sets the parent parcel to `SURVEYED`
 * server-side (confirmed directly, another side effect this action
 * doesn't duplicate — same shape `perfectTitleDeed`'s own `TITLED`
 * side effect already has). `rejectSurveyPlan` still requires `reason`
 * client-side (the DTO itself requires it) even though the service
 * doesn't persist it anywhere (confirmed directly — audit-trail-only,
 * a genuine difference from `rejectTitleDeed`'s own `notes`-append
 * behavior).
 *
 * Addendum, FE-4.4 — Plots: `subdivideParcel` (`POST
 * /land-bank/parcels/:parcelId/subdivide`) takes `surveyPlanId` (must
 * reference an `APPROVED` plan on this same parcel, confirmed directly)
 * and `plots: PlotDefinitionDto[]`. Sets every created plot to
 * `AVAILABLE` (confirmed directly — schema default is `PLANNED`,
 * the same "create endpoint skips the schema default" quirk found
 * twice already in this file) and sets the parent parcel to
 * `SUBDIVIDED` (another undupliated side effect). `updatePlotStatus`
 * (`PATCH /land-bank/plots/:plotId/status`) is deliberately NOT added
 * this checkpoint — see `page.tsx`'s own doc comment for why plot
 * status management stays scoped out even after FE-4.5 below.
 *
 * Addendum, FE-4.5 — Plot -> Project Release: `releasePlot` (`POST
 * /land-bank/plots/:plotId/release`) requires the target plot to be
 * `AVAILABLE` and takes `projectId` (required) + `notes` (optional) —
 * confirmed directly against `releasePlotToProject`, which also sets
 * the plot to `ALLOCATED` server-side (an undupliated side effect, the
 * same pattern every prior addendum in this file has followed).
 * `cancelPlotRelease` (`POST /land-bank/plots/:plotId/release/cancel`)
 * requires `reason` and sets the plot back to `AVAILABLE` server-side
 * (also undupliated here). Both revalidate this same detail route, not
 * the register — same reasoning the very first Titles actions above
 * already established for this file.
 */
export async function releasePlot(
  plotId: string,
  input: { projectId: string; notes?: string },
  parcelId: string,
): Promise<LandBankDetailActionState> {
  try {
    await fetchApi(`/land-bank/plots/${plotId}/release`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to release plot.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}

export async function cancelPlotRelease(plotId: string, reason: string, parcelId: string): Promise<LandBankDetailActionState> {
  try {
    await fetchApi(`/land-bank/plots/${plotId}/release/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel plot release.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}

export async function addTitleDeed(input: {
  parcelId: string;
  titleType: string;
  titleNumber?: string;
  issuingAuthority?: string;
  applicationDate?: string;
  documentRef?: string;
  notes?: string;
}): Promise<LandBankDetailActionState> {
  try {
    await fetchApi('/land-bank/titles', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to add title deed.' };
  }

  revalidatePath(`/land-bank/${input.parcelId}`);
  return { ok: true };
}

export async function perfectTitleDeed(
  titleId: string,
  input: { issuedDate: string; expiryDate?: string; titleNumber?: string },
  parcelId: string,
): Promise<LandBankDetailActionState> {
  try {
    await fetchApi(`/land-bank/titles/${titleId}/perfect`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to perfect title deed.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}

export async function rejectTitleDeed(titleId: string, reason: string, parcelId: string): Promise<LandBankDetailActionState> {
  try {
    await fetchApi(`/land-bank/titles/${titleId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject title deed.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}

export async function createSurveyPlan(input: {
  parcelId: string;
  planNumber: string;
  surveyorName?: string;
  surveyDate?: string;
  areaSqm?: number;
  documentRef?: string;
}): Promise<LandBankDetailActionState> {
  try {
    await fetchApi('/land-bank/survey-plans', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to add survey plan.' };
  }

  revalidatePath(`/land-bank/${input.parcelId}`);
  return { ok: true };
}

export async function approveSurveyPlan(surveyPlanId: string, parcelId: string): Promise<LandBankDetailActionState> {
  try {
    await fetchApi(`/land-bank/survey-plans/${surveyPlanId}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve survey plan.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}

export async function rejectSurveyPlan(surveyPlanId: string, reason: string, parcelId: string): Promise<LandBankDetailActionState> {
  try {
    await fetchApi(`/land-bank/survey-plans/${surveyPlanId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject survey plan.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}

export async function subdivideParcel(input: {
  parcelId: string;
  surveyPlanId: string;
  plots: { plotNumber: string; areaSqm: number; useType?: string; notes?: string }[];
}): Promise<LandBankDetailActionState> {
  const { parcelId, ...body } = input;
  try {
    await fetchApi(`/land-bank/parcels/${parcelId}/subdivide`, { method: 'POST', body: JSON.stringify(body) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to subdivide parcel.' };
  }

  revalidatePath(`/land-bank/${parcelId}`);
  return { ok: true };
}
