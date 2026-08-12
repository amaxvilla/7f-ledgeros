'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateWorkflowDefinitionState {
  ok: boolean;
  error?: string;
}

export interface CreateStageInput {
  sequence: number;
  name: string;
  stageType: string;
  requiredRoleCode?: string;
  minApprovals?: number;
}

/**
 * Frontend Completion, FE-8.10 — Workflow Definitions create form, the
 * first-pass version FE-8.9's own report recommended: flat `stages[]`
 * only (`sequence`/`name`/`stageType`/`requiredRoleCode`/`minApprovals`),
 * no stage-level `rules[]`, no workflow-level `workflowRules[]` — both
 * confirmed directly, re-reading `CreateWorkflowDefinitionDto`, to be
 * genuinely optional on every stage and at the top level
 * (`WorkflowEngineService.createDefinition`'s own `stage.rules ? ... :
 * undefined` / `dto.workflowRules?.length` guards, confirmed directly)
 * — omitting both entirely is valid, not a partial/broken submission.
 *
 * `POST /workflow/definitions` requires `workflow.admin` (confirmed
 * directly — a fourth, distinct permission from this same controller's
 * own `workflow.view`/`.manage`/`.act`, none of which would authorize
 * this action).
 *
 * `WorkflowEngineService.createDefinition` itself does two checks
 * before creating anything (confirmed directly, both surfaced here via
 * the same `fetchApi`/`ApiError` shape every other action in this app
 * already uses, not re-implemented client-side): a duplicate `code`
 * (`ConflictException`) and duplicate `sequence` numbers across stages
 * within the same submission (`BadRequestException`) — the latter is
 * also defended against client-side in `CreateWorkflowDefinitionForm`
 * itself (disabling submission on a detected duplicate) so the person
 * building a workflow sees the problem before submitting, not only
 * after a round-trip.
 */
export async function createWorkflowDefinition(input: {
  code: string;
  name: string;
  description?: string;
  entityType: string;
  stages: CreateStageInput[];
}): Promise<CreateWorkflowDefinitionState> {
  try {
    await fetchApi('/workflow/definitions', {
      method: 'POST',
      body: JSON.stringify({
        code: input.code,
        name: input.name,
        description: input.description || undefined,
        entityType: input.entityType,
        stages: input.stages.map((s) => ({
          sequence: s.sequence,
          name: s.name,
          stageType: s.stageType,
          requiredRoleCode: s.requiredRoleCode || undefined,
          minApprovals: s.minApprovals,
        })),
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create workflow definition.' };
  }

  revalidatePath('/workflow');
  return { ok: true };
}
