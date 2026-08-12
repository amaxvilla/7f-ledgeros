'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface WorkflowActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-8.7 — Workflow Instances' two write paths.
 * See `instances/page.tsx`'s own doc comment for the fuller before-
 * coding analysis of this checkpoint.
 *
 * `actOnWorkflowInstance` (`POST /workflow/instances/:id/actions`,
 * `workflow.act` — confirmed directly, a DIFFERENT permission from
 * `workflow.view`/`workflow.manage` used everywhere else in this
 * module, since acting on an approval is a distinct capability from
 * viewing or administering the module) takes `ActOnWorkflowDto`
 * (`{ action: WorkflowActionType; comments?: string }`, confirmed
 * directly against the DTO). `WorkflowActionType` (confirmed directly
 * in `schema.prisma`) has 8 values — `SUBMIT`/`REVIEW`/`APPROVE`/
 * `REJECT`/`RETURN`/`POST`/`ARCHIVE`/`COMMENT` — all offered as options
 * in `ActOnWorkflowForm`'s own `Select` rather than narrowed client-side
 * to a smaller "expected" subset: `WorkflowEngineService.act` itself
 * (confirmed directly) applies the same generic advance-or-terminate
 * logic to any of them (REJECT/RETURN both terminate; every other
 * value, including COMMENT, is treated as an "advance-eligible" action
 * that only actually advances the stage once `requiredApprovals` is
 * met) — this app has no narrower list of "the right actions for this
 * stage" to offer, so all 8 are offered and the backend's own role/
 * status guards (`ConflictException` if the instance isn't
 * `IN_PROGRESS` or has no ACTIVE stage; `BadRequestException` if the
 * active stage requires a role the actor doesn't hold) are surfaced
 * as-is on failure.
 *
 * `resubmitWorkflowInstance` (`POST /workflow/instances/:id/resubmit`,
 * `workflow.manage`) takes no body — confirmed directly it only
 * succeeds on a `RETURNED` instance (`ConflictException` otherwise,
 * not pre-checked client-side, same posture as `finalizeChecklist`'s
 * own "let the backend validate" precedent elsewhere in this app).
 */
export async function actOnWorkflowInstance(instanceId: string, action: string, comments?: string): Promise<WorkflowActionState> {
  try {
    await fetchApi(`/workflow/instances/${instanceId}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, comments }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record workflow action.' };
  }

  revalidatePath(`/workflow/instances/${instanceId}`);
  return { ok: true };
}

export async function resubmitWorkflowInstance(instanceId: string): Promise<WorkflowActionState> {
  try {
    await fetchApi(`/workflow/instances/${instanceId}/resubmit`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to resubmit workflow instance.' };
  }

  revalidatePath(`/workflow/instances/${instanceId}`);
  return { ok: true };
}
