'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface ProjectIssueActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Project Issues' write paths, same
 * fetchApi + revalidatePath('/project-issues') shape every other module
 * page's actions.ts already uses. `createIssue`/`resolveIssue` are this
 * file's original two (`IssueController.create`/`.resolve`); FE-1.4
 * added `assignIssue`/`startIssueWork`/`escalateIssue` below
 * (`IssueController.assign`/`.start`/`.escalate`) — see each function's
 * own doc comment for the shared `assertIssueOpen` guard they go
 * through server-side.
 */
export async function createIssue(input: {
  entityId: string;
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
  assignedToId?: string;
  dueDate?: string;
}): Promise<ProjectIssueActionState> {
  try {
    await fetchApi('/project-issues', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create issue.' };
  }

  revalidatePath('/project-issues');
  return { ok: true };
}

export async function resolveIssue(id: string): Promise<ProjectIssueActionState> {
  try {
    await fetchApi(`/project-issues/${id}/resolve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to resolve issue.' };
  }

  revalidatePath('/project-issues');
  return { ok: true };
}

/**
 * Frontend Completion, FE-1.4 — the three row actions `page.tsx`'s own
 * doc comment named as deferred alongside `resolve`/`close`:
 * `assign`/`start`/`escalate` (`IssueController`). All three share
 * `resolveIssue`'s own `assertIssueOpen` server-side guard (confirmed
 * directly against `RiskIssueService`: only `CLOSED` is blocked, `RESOLVED`/
 * `ESCALATED`/`IN_PROGRESS` all still accept a re-assign, a fresh
 * escalate, etc. — no additional client-side transition table to
 * duplicate here beyond what `IssueRowActions.tsx`'s own doc comment
 * chooses to hide for UX reasons).
 */
export async function assignIssue(id: string, assignedToId: string): Promise<ProjectIssueActionState> {
  try {
    await fetchApi(`/project-issues/${id}/assign`, { method: 'POST', body: JSON.stringify({ assignedToId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to assign issue.' };
  }

  revalidatePath('/project-issues');
  return { ok: true };
}

export async function startIssueWork(id: string): Promise<ProjectIssueActionState> {
  try {
    await fetchApi(`/project-issues/${id}/start`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start work on this issue.' };
  }

  revalidatePath('/project-issues');
  return { ok: true };
}

export async function escalateIssue(id: string): Promise<ProjectIssueActionState> {
  try {
    await fetchApi(`/project-issues/${id}/escalate`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to escalate issue.' };
  }

  revalidatePath('/project-issues');
  return { ok: true };
}
