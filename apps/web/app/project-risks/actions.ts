'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface ProjectRiskActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Project Risks' write paths, same
 * fetchApi + revalidatePath('/project-risks') shape every other module
 * page's actions.ts already uses. `createRisk`/`closeRisk` are this
 * file's original two (`RiskController.create`/`.close`); FE-1.5 added
 * `assignRiskOwner`/`convertRiskToIssue` below
 * (`RiskController.owner`/`.convert-to-issue`); FE-1.6's own recommended
 * next checkpoint (this one) adds `assessRisk`/`setRiskMitigationPlan`/
 * `monitorRisk` (`RiskController.assess`/`.mitigation-plan`/`.monitor`)
 * — see each function's own doc comment for the shared `assertRiskOpen`
 * guard they all go through server-side, same shape `assertIssueOpen`
 * already established for Issues' own `assign`/`start`/`escalate`
 * (FE-1.4).
 */
export async function createRisk(input: {
  entityId: string;
  projectId: string;
  title: string;
  description?: string;
  category?: string;
  probability?: string;
  impact?: string;
  ownerId?: string;
}): Promise<ProjectRiskActionState> {
  try {
    await fetchApi('/project-risks', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create risk.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}

export async function closeRisk(id: string): Promise<ProjectRiskActionState> {
  try {
    await fetchApi(`/project-risks/${id}/close`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to close risk.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}

/**
 * Frontend Completion, FE-1.5 — `owner` (`RiskController.assignOwner`),
 * the direct Risk-side analog of Issues' own `assignIssue` (FE-1.4):
 * same `assertRiskOpen` guard (`CLOSED` only), same "meaningful at any
 * non-`CLOSED` stage" reasoning.
 */
export async function assignRiskOwner(id: string, ownerId: string): Promise<ProjectRiskActionState> {
  try {
    await fetchApi(`/project-risks/${id}/owner`, { method: 'POST', body: JSON.stringify({ ownerId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to assign risk owner.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}

/**
 * Frontend Completion, FE-1.5 — `convert-to-issue`
 * (`RiskController.convertToIssue`). `ConvertRiskToIssueDto`'s five
 * fields (`title`/`description`/`priority`/`assignedToId`/`dueDate`)
 * are ALL optional — confirmed directly — and `RiskIssueService.convertRiskToIssue`
 * already fills every one of them from the risk itself when omitted
 * (title defaults to `"[Risk occurred] <risk title>"`, `assignedToId`
 * defaults to the risk's own `ownerId`). Called here with an empty
 * body, the same "simplest correct version, no extra form" posture
 * `CloseRiskButton`'s own doc comment already took for `close` — a
 * second, richer form capturing those five fields explicitly would be
 * a real, separate enhancement, not a gap this action needs to close
 * itself.
 */
export async function convertRiskToIssue(id: string): Promise<ProjectRiskActionState> {
  try {
    await fetchApi(`/project-risks/${id}/convert-to-issue`, { method: 'POST', body: JSON.stringify({}) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to convert risk to issue.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}

/**
 * Frontend Completion, FE-1.6 — `assess`/`mitigation-plan`/`monitor`
 * (`RiskController.assess`/`.mitigation-plan`/`.monitor`), the trio
 * FE-1.5's own report deliberately deferred as "a genuinely different-
 * shaped checkpoint" from `owner`/`convert-to-issue`. Freshly re-read
 * directly against `schema.prisma` rather than trusted from FE-1.5's
 * own report, per this app's own standing "verify directly, don't
 * trust a report's specific claims" discipline: `RiskProbability`/
 * `RiskImpact` are both confirmed `LOW`/`MEDIUM`/`HIGH` (matching the
 * report's own claim, but re-verified rather than assumed), and
 * `RiskStatus` is `IDENTIFIED -> ASSESSED -> MITIGATING -> MONITORING
 * -> OCCURRED -> CLOSED` (six values — one more than the report's own
 * four-value summary implied, `OCCURRED`/`CLOSED` both outside this
 * checkpoint's own three-action scope).
 *
 * All three share `closeRisk`'s own `assertRiskOpen` guard (`CLOSED`
 * only, confirmed directly in `RiskIssueService`) — same as `owner`/
 * `convert-to-issue` before them. `RiskWorkflowActions.tsx` layers one
 * further UX-level restriction beyond that bare server-side gate — see
 * that component's own doc comment for the reasoning (`OCCURRED` risks
 * hide all three, not just `CLOSED` ones).
 *
 * `assessRisk` (`AssessRiskDto`: `probability`, `impact`, both
 * required enums) recomputes `riskScore` server-side and only advances
 * `status` from `IDENTIFIED` to `ASSESSED` — re-assessing an already-
 * `MITIGATING`/`MONITORING` risk updates probability/impact/score
 * in place without moving its status backward or forward, confirmed
 * directly in `RiskIssueService.assessRisk`.
 *
 * `setRiskMitigationPlan` (`SetMitigationPlanDto`: `mitigationPlan`, a
 * required string) unconditionally sets `status` to `MITIGATING`,
 * confirmed directly — including from `MONITORING`, a real backward
 * status move if invoked there. Not specially guarded against here
 * (revising a mitigation plan while monitoring is a legitimate
 * real-world action, not obviously a mistake the way Issues' own
 * `start`-after-`OPEN` regression was) — same "don't guess at a
 * restriction the backend doesn't itself enforce" posture this app's
 * write paths already take elsewhere.
 *
 * `monitorRisk` takes no body at all and unconditionally sets `status`
 * to `MONITORING`, confirmed directly — callable even from `IDENTIFIED`
 * (skipping `ASSESSED`/`MITIGATING` entirely), no sequencing enforced
 * server-side.
 */
export async function assessRisk(id: string, input: { probability: string; impact: string }): Promise<ProjectRiskActionState> {
  try {
    await fetchApi(`/project-risks/${id}/assess`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to assess risk.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}

export async function setRiskMitigationPlan(id: string, mitigationPlan: string): Promise<ProjectRiskActionState> {
  try {
    await fetchApi(`/project-risks/${id}/mitigation-plan`, { method: 'POST', body: JSON.stringify({ mitigationPlan }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to set mitigation plan.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}

export async function monitorRisk(id: string): Promise<ProjectRiskActionState> {
  try {
    await fetchApi(`/project-risks/${id}/monitor`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start monitoring risk.' };
  }

  revalidatePath('/project-risks');
  return { ok: true };
}
