'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface ProjectTaskActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-5.1 — Project Tasks, first checkpoint of
 * Stage FE-5 (PMO). A fresh "what's actually built" pass found `/pmo`
 * is a read-only dashboard (project performance + risk/issue register,
 * confirmed directly against its own doc comment) and `tasks.controller.ts`
 * is a Microsoft/Google Tasks provider-sync integration (create/update/
 * delete by `providerTaskId`, confirmed directly) — NEITHER is the PMO
 * "Tasks" roadmap item. The actual `ProjectTask` CRUD lives on
 * `SchedulingController` (`@Controller('project-tasks')`), and it has
 * had no frontend page at all until now — a genuine, checked gap, the
 * same kind of verification `RecordAcquisitionForm`'s and
 * `ProjectSelector`'s own doc comments insist on before building.
 *
 * `SchedulingController` also covers dependencies, critical-path,
 * Gantt data, and earned value — all read/visualization-shaped
 * features on the scale of their own checkpoint (the same "Gantt
 * rendering is its own visualization checkpoint" scoping `/pmo`'s own
 * doc comment already draws a line at). This checkpoint scopes to
 * exactly `createTask`/`updateProgress`/`setStatus` — the three CRUD
 * actions a Tasks register page needs — leaving dependencies/critical-
 * path/Gantt/earned-value for a later FE-5 checkpoint.
 *
 * `createTask` (`POST /project-tasks`, `pmo.manage`) takes BOTH
 * `entityId` AND `projectId` (confirmed directly against
 * `CreateProjectTaskDto` — neither is optional), matching the
 * `EntitySelector` → `ProjectSelector` two-step gate `/pmo` already
 * established for this exact combination.
 *
 * `updateProgress` (`POST /project-tasks/:id/progress`) auto-derives
 * `status` server-side from `percentComplete` (0 → `NOT_STARTED`, 100 →
 * `COMPLETED`, anything between → `IN_PROGRESS` — confirmed directly
 * against `SchedulingService.updateProgress`'s own ternary) and is
 * blocked entirely on a `CANCELLED` task (`ConflictException`,
 * confirmed directly). `setStatus` (`POST /project-tasks/:id/status`)
 * is the separate, unguarded direct setter — the only way to reach
 * `ON_HOLD` or `CANCELLED`, since progress alone can never produce
 * either. Both exist as separate actions here because they're
 * genuinely separate endpoints with different semantics, not two views
 * of the same transition.
 */
export async function createTask(input: {
  entityId: string;
  projectId: string;
  parentTaskId?: string;
  code?: string;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  budgetedCost?: number;
}): Promise<ProjectTaskActionState> {
  try {
    await fetchApi('/project-tasks', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create task.' };
  }

  revalidatePath('/project-tasks');
  return { ok: true };
}

export async function updateTaskProgress(
  id: string,
  input: { percentComplete: number; actualStart?: string; actualEnd?: string; actualCost?: number },
): Promise<ProjectTaskActionState> {
  try {
    await fetchApi(`/project-tasks/${id}/progress`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update task progress.' };
  }

  revalidatePath('/project-tasks');
  return { ok: true };
}

export async function setTaskStatus(id: string, status: string): Promise<ProjectTaskActionState> {
  try {
    await fetchApi(`/project-tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to set task status.' };
  }

  revalidatePath('/project-tasks');
  return { ok: true };
}

/**
 * ADDENDUM (FE-5.2) — Scheduling, FE-5.1's own recommended next
 * checkpoint: dependencies + a critical-path view, both reusing the
 * SAME `entityId`/`projectId` gate `/project-tasks` already
 * established rather than a new page — the recommendation named this
 * directly ("same projectId gate this checkpoint already established").
 *
 * `addDependency` (`POST /project-tasks/dependencies`, `pmo.manage`)
 * takes `predecessorId`/`successorId` — both real `Select`s sourced
 * from the SAME `taskOptions` `CreateTaskForm`'s own `parentTaskId`
 * field already uses, no new fetch. Cycle-checking happens server-side
 * (`SchedulingService.addDependency`'s own DFS reachability check,
 * confirmed directly) — this action surfaces whatever error message
 * that check produces rather than re-implementing it client-side.
 *
 * No `revalidatePath` call needed beyond the existing `/project-tasks`
 * one below: `computeCriticalPath` is re-fetched by `page.tsx` on every
 * load anyway (`force-dynamic`, no caching), so a fresh dependency is
 * picked up the same way a fresh task already is.
 */
export async function addDependency(input: {
  predecessorId: string;
  successorId: string;
  type?: string;
  lagDays?: number;
}): Promise<ProjectTaskActionState> {
  try {
    await fetchApi('/project-tasks/dependencies', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to add dependency.' };
  }

  revalidatePath('/project-tasks');
  return { ok: true };
}
