'use server';

import { fetchApi, ApiError } from '../../../lib/api';

export interface StartInstanceFormState {
  ok: boolean;
  error?: string;
  instanceId?: string;
}

/**
 * Frontend Completion, FE-8.9 — `startInstance`, the smaller of the two
 * items FE-8.8's own report left deferred (Workflow Definitions' own
 * doubly-nested `stages[]`/`rules[]` create-form is the other, and
 * remains deferred — genuinely larger than this checkpoint's own
 * scope, confirmed directly against `CreateWorkflowDefinitionDto`
 * again rather than re-assumed).
 *
 * `POST /workflow/instances` (`workflow.manage`, confirmed directly —
 * distinct from `act`'s own `workflow.act`) takes
 * `StartWorkflowInstanceDto`: `workflowCode`, `entityType`, `entityId`
 * (the domain record this instance approves — e.g. a PurchaseOrder's
 * own id; a loose string reference, not an FK, confirmed directly
 * against the DTO's own comment), plus a flat, all-optional `context`
 * object (`WorkflowContextDto` — confirmed directly: no nested arrays
 * anywhere, unlike Definitions' own `stages`/`rules`, which is exactly
 * why this endpoint was the better-scoped of the two deferred items).
 *
 * `workflowCode`/`entityType` are NOT collected by this form — both are
 * already fixed by which definition's own detail page
 * (`/workflow/[code]`) the form is rendered on, passed in as props
 * rather than re-entered.
 *
 * `WorkflowContextDto.entityId` (an OPTIONAL field inside `context`,
 * used only for rule evaluation — e.g. "skip this stage unless
 * ENTITY = x") is a confusingly-named DIFFERENT field from
 * `StartWorkflowInstanceDto.entityId` (the REQUIRED top-level domain-
 * record id) — confirmed directly by reading both DTOs side by side,
 * not assumed to be the same field reused. `StartInstanceForm` labels
 * them "Record ID" and "Context: entity ID" respectively to keep this
 * distinction visible rather than silently dropping the less-obviously-
 * useful one.
 *
 * On success, returns the new instance's own `id` (confirmed directly
 * — `WorkflowEngineService.startInstance` returns the created
 * `WorkflowInstance` record as-is, `id` included by Prisma's own
 * default scalar-field return) so `StartInstanceForm` can offer a
 * "View instance →" link to `/workflow/instances/[id]` — an inline
 * link on success, not an automatic redirect: no create-form anywhere
 * else in this app performs a hard redirect after success (confirmed
 * by checking `CreateMasterPlanForm`/`CreateRoleForm`/every other
 * create-form's own post-success behavior — all show an inline
 * confirmation instead), so this follows that same established
 * precedent rather than introducing a new one for this one form.
 *
 * No `revalidatePath` call: this route creates a resource on a
 * DIFFERENT page (`/workflow/instances/[id]`) than the one the form is
 * rendered on (`/workflow/[code]`) — there's nothing on THIS page's own
 * data that changes as a result of starting an instance elsewhere.
 */
export async function startWorkflowInstance(input: {
  workflowCode: string;
  entityType: string;
  entityId: string;
  context: {
    amount?: number;
    departmentId?: string;
    projectId?: string;
    entityId?: string;
    role?: string;
    riskLevel?: string;
    budgetAvailable?: boolean;
  };
}): Promise<StartInstanceFormState> {
  try {
    const instance = await fetchApi<{ id: string }>('/workflow/instances', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, instanceId: instance.id };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start workflow instance.' };
  }
}
