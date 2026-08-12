'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateRequisitionFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — ninth data-entry form's action, following
 * `createVacancy`'s own doc comment for the shared conventions. The
 * first action in this file whose DTO requires `entityId` in the body
 * itself (`CreateRequisitionDto.entityId`, `recruitment.controller.ts`'s
 * `@RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId' })`) —
 * `createVacancy` above takes no `entityId` (it derives one from the
 * referenced requisition server-side), so `CreateRequisitionForm`'s
 * `entityId` prop is threaded straight into this call's body, the same
 * "prop flows into the request body" shape `createLease`/`createTenant`
 * already use for their own entity-scoped DTOs, rather than
 * `createVacancy`'s "prop exists only to key the page's own re-render"
 * shape.
 *
 * `headcount` is optional here (`CreateRequisitionDto.headcount?`,
 * defaults to 1 server-side per `RecruitmentService.createRequisition`)
 * — this action takes it as `number | undefined`, already converted by
 * the caller, the same "conversion is the form's job, not this action's"
 * split `createLease`'s own `rentAmount`/`depositAmount` params use.
 */
export async function createRequisition(input: {
  entityId: string;
  jobTitle: string;
  departmentId?: string;
  costCenterId?: string;
  projectId?: string;
  gradeLevel?: string;
  employmentType?: string;
  headcount?: number;
  justification?: string;
  budgetLineId?: string;
}): Promise<CreateRequisitionFormState> {
  try {
    await fetchApi('/recruitment/requisitions', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create requisition.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export interface CreateVacancyFormState {
  ok: boolean;
  error?: string;
}

export interface VacancyActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — the first status-transition Server Actions in
 * this app, distinct in kind from every `create*` action above and in
 * every other `actions.ts` across the app: those all POST a new record;
 * these PATCH an existing vacancy's own status. Mirrors the same
 * fetchApi + revalidatePath('/recruitment') shape regardless — the
 * "Server Action wraps fetchApi, translates ApiError, revalidates the
 * page" pattern doesn't care whether the HTTP verb underneath is POST
 * or PATCH.
 *
 * `publishVacancy`/`closeVacancy` require `recruitment.manage`, same
 * permission `createVacancy` above already requires — both endpoints
 * (recruitment.controller.ts) sit behind the same `@RequirePermissions`
 * guard, so no new permission check is introduced here.
 *
 * Neither action re-validates the vacancy's current status
 * client-side before calling the API — `publishVacancy` (DRAFT/ON_HOLD
 * only) and `closeVacancy` (no backend guard at all) both enforce or
 * decline to enforce that themselves (RecruitmentService, same file
 * `createVacancy` above already defers to for its own validation); this
 * action surfaces whatever `ApiError` message comes back (e.g. a
 * ConflictException on an already-OPEN vacancy) rather than guessing at
 * the rule itself. `VacancyActions.tsx`'s own doc comment covers the
 * UI-level (not backend-enforced) decision to hide buttons that would
 * be pointless rather than merely rejected.
 */
export async function publishVacancy(id: string): Promise<VacancyActionState> {
  try {
    await fetchApi(`/recruitment/vacancies/${id}/publish`, { method: 'PATCH' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to publish vacancy.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export async function closeVacancy(id: string, filled: boolean): Promise<VacancyActionState> {
  try {
    await fetchApi(`/recruitment/vacancies/${id}/close?filled=${filled}`, { method: 'PATCH' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to close vacancy.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

/**
 * Eighth Server Action in this app, same reasoning as every prior create
 * action (tenants/actions.ts, crm/actions.ts, tax/actions.ts,
 * fixed-assets/actions.ts, lease-management/actions.ts,
 * facility-management/actions.ts, security/actions.ts) — and the first
 * one added to a page that predates the form-per-page convention
 * (Recruitment shipped read-only back in Checkpoint B; this is its
 * first write path).
 *
 * `POST /recruitment/vacancies` (recruitment.controller.ts) requires
 * `recruitment.manage`, not the `recruitment.view` this page's own read
 * calls use — same "read and write are different permissions" split
 * every other Create*Form's own doc comment already notes for its
 * resource.
 *
 * `jobRequisitionId` is a plain required string, not a dropdown fetched
 * from `GET /recruitment/requisitions?status=APPROVED` — same "id field
 * from another registry, not a fixed enum" reasoning CreateLeaseForm's
 * own tenantId/unitId doc comment gives, not a new pattern this action
 * invented. RecruitmentService.createVacancy() itself enforces that the
 * referenced requisition is APPROVED (throws ConflictException
 * otherwise) — this action doesn't duplicate that check client-side,
 * same as every other Create*Form leaves its own DTO-level validation
 * to the backend.
 */
export async function createVacancy(input: {
  jobRequisitionId: string;
  title: string;
  description?: string;
  location?: string;
  employmentType?: string;
}): Promise<CreateVacancyFormState> {
  try {
    await fetchApi('/recruitment/vacancies', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create vacancy.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

/**
 * Frontend Completion — requisition-side counterparts to
 * `publishVacancy`/`closeVacancy` above, added alongside the first read
 * UI for requisitions (`page.tsx`'s new "Job requisitions" section;
 * requisitions previously surfaced only as a dashboard count, with no
 * list or row action anywhere). Same `fetchApi` + `revalidatePath`
 * shape as every other action in this file — `submitRequisition` and
 * `closeRequisition` are `POST`s (matching the controller's own verb
 * choice — `submit`/`refresh-approval`/`close` are all `@Post`, not
 * `@Patch`, unlike vacancies' own `@Patch` publish/close — this file
 * doesn't normalize that difference away, it just calls what the
 * controller actually exposes), `refreshRequisitionApproval` likewise.
 *
 * `refreshRequisitionApproval` (recruitment.service.ts) is a no-op read
 * when the requisition has no `workflowInstanceId` yet, and otherwise
 * pulls the linked `WorkflowInstance`'s current status and only writes
 * a new `JobRequisition.status` if the workflow has resolved
 * (APPROVED/REJECTED/RETURNED) and the requisition doesn't already
 * reflect that — calling it against a still-pending workflow is
 * harmless (returns the requisition unchanged), so
 * `RequisitionActions.tsx` doesn't need to guess the workflow's own
 * state before offering the button, only whether one exists at all.
 */
export type RequisitionActionState = VacancyActionState;

export async function submitRequisition(id: string): Promise<RequisitionActionState> {
  try {
    await fetchApi(`/recruitment/requisitions/${id}/submit`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit requisition.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export async function refreshRequisitionApproval(id: string): Promise<RequisitionActionState> {
  try {
    await fetchApi(`/recruitment/requisitions/${id}/refresh-approval`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to refresh approval status.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export async function closeRequisition(id: string): Promise<RequisitionActionState> {
  try {
    await fetchApi(`/recruitment/requisitions/${id}/close`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to close requisition.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export type SyncRetryActionState = VacancyActionState;

/**
 * Frontend Completion — Recruitment "needs attention" sync-failures
 * panel. All four mirror the same `fetchApi` + `revalidatePath('/recruitment')`
 * shape every other action in this file uses; see `RetrySyncButton.tsx`'s
 * own doc comment for why the underlying routes are the domain-scoped
 * ones (`recruitment/interviews/...`, `recruitment/candidates/...`,
 * `recruitment/offers/...`), not `DashboardController`'s duplicate
 * wrappers, and for the confirmed-real repeat-failure `ConflictException`
 * case none of these four specially guard against.
 */
export async function retryCalendarSync(id: string): Promise<SyncRetryActionState> {
  try {
    await fetchApi(`/recruitment/interviews/${id}/retry-calendar-sync`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to retry calendar sync.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export async function retryTeamsSync(id: string): Promise<SyncRetryActionState> {
  try {
    await fetchApi(`/recruitment/interviews/${id}/retry-teams-sync`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to retry Teams sync.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export async function retryContactSync(id: string): Promise<SyncRetryActionState> {
  try {
    await fetchApi(`/recruitment/candidates/${id}/retry-contact-sync`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to retry contact sync.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}

export async function retrySignatureSync(id: string): Promise<SyncRetryActionState> {
  try {
    await fetchApi(`/recruitment/offers/${id}/retry-signature-sync`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to retry signature sync.' };
  }

  revalidatePath('/recruitment');
  return { ok: true };
}
