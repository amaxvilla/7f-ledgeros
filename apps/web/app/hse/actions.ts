'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface HseActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — HSE's first write paths. `/hse/page.tsx`'s own
 * doc comment named this as a genuinely separate, larger follow-up
 * checkpoint ("register + create-form pages, FE-3-module-shaped work")
 * rather than something to fold into the read-only dashboard
 * checkpoint itself — this is that follow-up, scoped to Incident
 * Reports alone (`createIncident`/`incidents/:id/status` on
 * `HseController`) rather than all six HSE sub-resources at once, per
 * this app's own repeated "one resource per checkpoint" discipline.
 *
 * Picked Incident Reports over the other five sub-resources
 * (`near-misses`, `ppe-issuances`, `toolbox-talks`, `corrective-actions`,
 * `inspection-checklists`) because it's the one the existing dashboard
 * already weights most heavily (its own "Open incidents"/"severe or
 * fatal" KPI card is the first, most prominent one) and has the
 * simplest DTO shape of the six (`CreateIncidentReportDto`, confirmed
 * directly in `hse.service.ts` — a plain interface, not a `class`-based
 * DTO with decorators, same "inline type, no `class-validator`" shape
 * `createWorkPackage`/`createProgressValuation` already established
 * elsewhere in this app).
 *
 * `createIncidentReport` (`POST /hse/incidents`, `hse.report` —
 * confirmed directly, a DIFFERENT permission from `hse.manage`/
 * `hse.view`, which the rest of `HseController` uses) takes `entityId`
 * (required, supplied by the page the same way every other entity-
 * scoped create form in this app already does — not a form field),
 * `projectId` (optional — a real `Select` here, fed by
 * `GET /dimensions/projects?entityId=`, the exact same fetch
 * `CreateRiskForm`'s own required version already established, just
 * not `required` on this form since the DTO itself doesn't require
 * it), `incidentDate`, `location` (optional), `description`, and
 * `severity` (`IncidentSeverity`: `MINOR`/`MODERATE`/`SEVERE`/`FATAL`,
 * re-verified directly against `schema.prisma` rather than trusted
 * from the dashboard page's own already-correct local type). Server
 * always sets `status: OPEN` — not a form field.
 *
 * `advanceIncidentStatus` (`POST /hse/incidents/:id/status`,
 * `hse.manage` — a genuinely different permission from `hse.report`,
 * which only the CREATE route uses; this app's create/status-action
 * split already has precedent for differing permissions, e.g. Risk's
 * `pmo.manage` covering both there, but HSE's own two are confirmed
 * NOT the same here) takes an explicit target `status`
 * (`HseCaseStatus`: `OPEN`/`INVESTIGATING`/`CLOSED`, also re-verified
 * directly), not a bare "advance" call — `IncidentStatusActions.tsx`
 * computes the correct one-step-forward target itself, the same
 * "caller computes target, action just forwards it" split every other
 * status-action pair in this app already uses. Confirmed directly
 * that `CLOSED` throws `ConflictException` server-side if any linked
 * corrective action isn't yet `COMPLETED` — not mirrored client-side,
 * the backend's own error message already names the count, same
 * "let the backend validate, surface its error" posture this app
 * takes throughout.
 */
export async function createIncidentReport(input: {
  entityId: string;
  projectId?: string;
  incidentDate: string;
  location?: string;
  description: string;
  severity: string;
}): Promise<HseActionState> {
  try {
    await fetchApi('/hse/incidents', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create incident report.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

export async function advanceIncidentStatus(id: string, status: string): Promise<HseActionState> {
  try {
    await fetchApi(`/hse/incidents/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update incident status.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

/**
 * ADDENDUM (HSE.2) — Corrective Actions, HSE.1's own recommended next
 * checkpoint, and the sub-resource both Incidents and Near Misses
 * already link to (`correctiveActions`, already flattened and rendered
 * read-only by `/hse/page.tsx` since HSE.1).
 *
 * NOT INVESTIGATED FIRST: whether `/pmo` already duplicates this the
 * way it turned out to duplicate `SchedulingService.computeEarnedValue`
 * (the finding that caused this session to pivot away from its own
 * prior "Earned Value on /project-tasks" recommendation) — checked
 * directly, and it does NOT: `ReportingService`/`DashboardService` both
 * grepped for `CorrectiveAction`, no hits outside `hse.service.ts`
 * itself. This checkpoint is not redundant with anything already built.
 *
 * A REAL BACKEND OBSERVATION, NOT ACTED ON: `createCorrectiveAction`'s
 * own parameter type (`CreateCorrectiveActionDto` in `hse.service.ts`)
 * is a plain TypeScript `interface`, not a `class`-based DTO — the same
 * "inline type, no `class-validator`" shape this app's history has
 * already seen elsewhere (`createWorkPackage`, `createProgressValuation`,
 * `createIncidentReport` itself), so this isn't a new pattern to flag
 * as broken, just re-confirmed directly rather than assumed symmetric
 * with `advanceIncidentStatus`'s own DTO on faith.
 *
 * `createCorrectiveAction` (`POST /hse/corrective-actions`,
 * `hse.manage`) requires EITHER `incidentReportId` OR `nearMissId` (a
 * hand-written `BadRequestException` if neither is present, confirmed
 * directly — not both required, not both optional-and-unchecked),
 * `description`, `dueDate`; `assignedToId` is optional. This form
 * exposes ONE combined "Linked to" `Select` — not two separate
 * incident/near-miss pickers — built from `incidentOptions`/
 * `nearMissOptions` `page.tsx` derives from the SAME `incidents`/
 * `nearMisses` arrays it already fetches (no new call), with each
 * option's own `value` prefixed (`incident:<id>` / `nearmiss:<id>`) so
 * the form can split it back into the correct field at submit time —
 * a single required choice matches the backend's own "exactly one of
 * these two" shape more directly than two independent optional
 * `Select`s would (which could let a user submit neither, or both).
 * `assignedToId` stays a plain optional `TextField`, NOT a `Select` —
 * confirmed directly that no Users/Employees registry exists anywhere
 * in this app's frontend yet (`CreateIssueForm`'s own `assignedToId`
 * field is the same plain `TextField`, re-checked as the precedent
 * rather than assumed).
 *
 * `completeCorrectiveAction` (`POST /hse/corrective-actions/:id/complete`)
 * takes NO body at all (confirmed directly) — a no-fields button, the
 * same shape Risk's own `monitorRisk`/Survey Plans' own `approveSurveyPlan`
 * already established elsewhere in this app's history. Also has a real
 * best-effort Microsoft To Do completion-sync side effect server-side
 * (confirmed directly, guarded on `providerTaskId`/`taskProviderCode`
 * both being set) — this action doesn't need to know about that.
 *
 * `flagOverdueCorrectiveActions` (`POST /hse/corrective-actions/flag-overdue`)
 * is DELIBERATELY NOT built here — confirmed directly it's a bulk
 * `updateMany` returning only `{ flagged: count }`, not a per-row
 * action; it reads like a scheduled/admin batch job (HSE.1's own report
 * already flagged this uncertainty) rather than something a corrective-
 * action row's own UI should trigger. Left for a future Administration-
 * stage checkpoint (Stage FE-8's own "Queue"/"System Configuration"
 * items) rather than bolted onto this one on a guess.
 */
export async function createCorrectiveAction(input: {
  incidentReportId?: string;
  nearMissId?: string;
  description: string;
  assignedToId?: string;
  dueDate: string;
}): Promise<HseActionState> {
  try {
    await fetchApi('/hse/corrective-actions', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create corrective action.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

export async function completeCorrectiveAction(id: string): Promise<HseActionState> {
  try {
    await fetchApi(`/hse/corrective-actions/${id}/complete`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to complete corrective action.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

/**
 * ADDENDUM (HSE.3) — Toolbox Talks, the smaller alternative HSE.2's own
 * report named alongside the (larger, decision-blocked) Gantt
 * bar-chart recommendation. Picked over PPE Issuances and Inspection
 * Checklists as the next "one resource per checkpoint" pick for the
 * simplest reason: `CreateToolboxTalkDto` (confirmed directly in
 * `hse.service.ts`) has the fewest fields of the three remaining
 * read-only sections, and no sub-resource/nested-array shape
 * (Inspection Checklists' own `items: InspectionChecklistItem[]` would
 * need its own repeatable-row form input, a genuinely different and
 * larger UI problem not attempted here).
 *
 * `createToolboxTalk` (`POST /hse/toolbox-talks`, `hse.manage` —
 * confirmed directly, same permission Corrective Actions' own two
 * routes use, NOT `hse.report` the way `createIncidentReport` alone
 * uses) takes `entityId` (supplied by the page, not a form field, same
 * convention every other entity-scoped create form in this app
 * already uses), `projectId` (optional, reusing the exact same
 * `projectOptions` prop `CreateIncidentReportForm` already established
 * — no new `GET /dimensions/projects` call), `topic`, `talkDate`,
 * `conductedById` (a plain, REQUIRED `TextField` — confirmed directly
 * that `CreateToolboxTalkDto.conductedById` has no `?`, not assumed
 * optional by symmetry with Corrective Actions' own `assignedToId`;
 * still free-text, not a `Select`, since no Users/Employees registry
 * exists anywhere in this app's frontend yet, the same finding HSE.2's
 * own report already confirmed for `assignedToId`), `attendeeCount`
 * (a number — `createToolboxTalk`'s own hand-written
 * `BadRequestException` rejects a negative value server-side, not
 * re-validated client-side, the same "let the backend validate"
 * posture this app takes throughout), and `notes` (optional).
 *
 * No per-row action exists for toolbox talks (confirmed directly
 * against `HseController` — only `POST`/`GET`, no status or complete
 * route the way Corrective Actions has), so unlike HSE.2 this
 * checkpoint adds no Actions column — the table itself is unchanged,
 * only a create form above it.
 */
export async function createToolboxTalk(input: {
  entityId: string;
  projectId?: string;
  topic: string;
  talkDate: string;
  conductedById: string;
  attendeeCount: number;
  notes?: string;
}): Promise<HseActionState> {
  try {
    await fetchApi('/hse/toolbox-talks', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to log toolbox talk.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

/**
 * ADDENDUM (HSE.4) — PPE Issuances, HSE.3's own recommended next
 * checkpoint. Picked over Inspection Checklists for the same reason
 * HSE.3 was picked over it: `CreatePpeIssuanceDto` (confirmed directly
 * in `hse.service.ts`) is a flat shape, no nested `items` array to
 * design a repeatable-row input for.
 *
 * `issuePpe` (`POST /hse/ppe-issuances`, `hse.manage` — confirmed
 * directly, the same permission Corrective Actions' and Toolbox Talks'
 * own create routes use) takes `entityId` (supplied by the page, not a
 * form field, same convention as every other create form here),
 * `employeeId`, `itemName`, `quantity`, `issuedDate`, and an optional
 * `expiryDate`. `createdById` is set server-side from the controller's
 * own `@CurrentUser()` decorator (confirmed directly — the same shape
 * `createIncidentReport`/`createCorrectiveAction` already use), not a
 * form field.
 *
 * Confirmed directly that `issuePpe` does two things server-side this
 * action does not duplicate client-side: rejects `quantity <= 0` with
 * a hand-written `BadRequestException` (the same "let the backend
 * validate, surface its error" posture `createToolboxTalk`'s own
 * negative-attendee-count check already established), and looks up
 * the `employeeId` against the `Employee` table, throwing
 * `NotFoundException` if it doesn't resolve — confirmed directly this
 * is the reason `employeeId` stays a plain `TextField` rather than a
 * `Select`: no employee-list endpoint reachable from `hse.manage`
 * scope exists in this app's frontend today (`GET /hr-payroll/
 * employees` is gated on `hr.view`, a different permission — see
 * `CreatePpeIssuanceForm.tsx`'s own doc comment for why that's a real
 * decision this checkpoint doesn't make unilaterally, not an oversight).
 *
 * No Actions column, no per-row route — confirmed directly against
 * `HseController` that PPE issuance has only `POST`/`GET` (plus the
 * separate `GET .../expiring` this page's own read-only table already
 * uses), the same "no per-row action exists" shape Toolbox Talks had.
 */
export async function issuePpe(input: {
  entityId: string;
  employeeId: string;
  itemName: string;
  quantity: number;
  issuedDate: string;
  expiryDate?: string;
}): Promise<HseActionState> {
  try {
    await fetchApi('/hse/ppe-issuances', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to issue PPE.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

/**
 * ADDENDUM (HSE.5) — Inspection Checklists create form, HSE.4's own
 * recommended next checkpoint. `createInspectionChecklist`
 * (`POST /hse/inspection-checklists`, `hse.manage` — confirmed
 * directly, the same permission every other HSE create route on this
 * page uses) takes `entityId` (supplied by the page, not a form field),
 * `projectId` (optional, reusing the same `projectOptions` prop the
 * other HSE forms already established), `checklistType` (free text —
 * confirmed directly against `schema.prisma` it's a bare `String`
 * column, not an enum), `inspectionDate`, `inspectorId` (plain
 * required text, same "no registry reachable" posture as this page's
 * other assignee-shaped fields), and `items` — a repeatable array of
 * `{ itemDescription: string }`, confirmed directly to require at
 * least one entry (`BadRequestException` if empty). See
 * `CreateInspectionChecklistForm.tsx`'s own doc comment for the
 * repeatable-row UI this required, reusing `CreateRequisitionForm`'s
 * own established add/remove-row pattern rather than inventing a new
 * one.
 *
 * `recordItemResult` and `finalizeChecklist` are deliberately NOT
 * added here — both act on an already-created checklist's own item
 * `id`s, which this create-only action has no reason to expose; see
 * `CreateInspectionChecklistForm.tsx`'s own doc comment for why that's
 * scoped as its own future checkpoint rather than folded in here.
 */
export async function createInspectionChecklist(input: {
  entityId: string;
  projectId?: string;
  checklistType: string;
  inspectionDate: string;
  inspectorId: string;
  items: { itemDescription: string }[];
}): Promise<HseActionState> {
  try {
    await fetchApi('/hse/inspection-checklists', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create inspection checklist.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

/**
 * ADDENDUM (HSE.6) — Inspection Checklists' remaining write paths,
 * HSE.5's own recommended next checkpoint: per-item result recording
 * and checklist finalization, both explicitly deferred out of HSE.5
 * because they act on an already-created checklist's own row-level
 * `id`s rather than anything a create form exposes.
 *
 * `recordItemResult` (`POST /inspection-checklist-items/:itemId/result`,
 * `hse.manage` — confirmed directly, the same permission every other
 * HSE write route on this page uses) takes `isCompliant` (required
 * boolean) and an optional `remarks`. Confirmed directly it 404s if
 * `itemId` doesn't resolve against `InspectionChecklistItem` — not
 * re-checked client-side, the item `id`s rendered here always come
 * from the same `checklists` array `page.tsx` already fetches, so a
 * stale/invalid id here would mean a real data-consistency bug
 * elsewhere, not a case this action needs to defend against.
 *
 * `finalizeChecklist` (`POST /inspection-checklists/:id/finalize`,
 * `hse.manage`) takes no body (confirmed directly) — a no-fields
 * action, the same shape `completeCorrectiveAction` already has.
 * Confirmed directly it re-derives `result` (`PASS`/`FAIL`/
 * `PASS_WITH_OBSERVATIONS`) from the checklist's own items, throwing
 * a `BadRequestException` if any item's `isCompliant` is still `null`
 * — this action does not pre-check that itself, the same "surface the
 * backend's own validation error" posture this page's history already
 * has throughout (see `FinalizeChecklistButton.tsx`'s own doc comment).
 *
 * See `RecordItemResultForm.tsx`'s own doc comment for why this is a
 * genuinely new UI shape (a form nested per-row inside a `DataTable`
 * cell) rather than a page-level form or a single no-fields button.
 */
export async function recordItemResult(itemId: string, isCompliant: boolean, remarks?: string): Promise<HseActionState> {
  try {
    await fetchApi(`/hse/inspection-checklist-items/${itemId}/result`, {
      method: 'POST',
      body: JSON.stringify({ isCompliant, remarks }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record item result.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

export async function finalizeChecklist(id: string): Promise<HseActionState> {
  try {
    await fetchApi(`/hse/inspection-checklists/${id}/finalize`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to finalize checklist.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}

/**
 * ADDENDUM (HSE.7) — Near Miss status actions, the small gap HSE.6's
 * own report surfaced while confirming HSE's write-path coverage: the
 * Near Misses table gained no Actions column back in HSE.1, unlike
 * Incidents in that same checkpoint, even though `advanceNearMissStatus`
 * (`POST /hse/near-misses/:id/status`, `hse.manage` — confirmed
 * directly, the same permission `advanceIncidentStatus` uses) has
 * existed on the backend the whole time.
 *
 * Confirmed directly this is a real, smaller gap, not a duplicate of
 * anything: `advanceNearMissStatus` has NO corrective-action-closed
 * guard the way `advanceIncidentStatus` does (re-read both methods in
 * `hse.service.ts` side by side rather than assumed symmetric) — just
 * a `NotFoundException` if the id doesn't resolve, then an
 * unconditional status update. `NearMissStatusActions.tsx`'s own doc
 * comment covers this difference; the action itself still forwards
 * whatever target status the caller computes and surfaces any error
 * as-is, same shape as `advanceIncidentStatus`.
 */
export async function advanceNearMissStatus(id: string, status: string): Promise<HseActionState> {
  try {
    await fetchApi(`/hse/near-misses/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update near miss status.' };
  }

  revalidatePath('/hse');
  return { ok: true };
}
