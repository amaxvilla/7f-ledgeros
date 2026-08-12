'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface AssignmentActionState {
  ok: boolean;
  error?: string;
}

/**
 * Agent Management, RE-AGENT.2 (frontend) — Agent Assignment. Verified
 * before building: `AgentAssignmentController`/`AgentAssignmentService`
 * are fully implemented on the backend (create, by-agent, by-target,
 * findOne, end) with no frontend consumer anywhere in this app —
 * confirmed directly by grepping every `app/**\/*.tsx` for
 * `/agent-assignment` before adding this. `AgentController` (RE-AGENT.1,
 * the Agent master) is also already fully implemented backend-side with
 * no frontend either; building a full Agent directory/profile UI is
 * that checkpoint's own scope, not this one's — this page consumes
 * `GET /agents` only as a `Select`'s option source (the same "reuse an
 * existing list endpoint without building that resource's own CRUD
 * page" pattern `/consolidation`'s own `CreateGroupForm` already
 * established for `GET /entities`).
 *
 * `createAssignment` (`POST /agent-assignments`, `agent.manage`) sends
 * `entityId` as the page's currently-selected entity — the backend
 * cross-validates this against the target's own real structural entity
 * and rejects a mismatch with a 400 (confirmed directly in
 * `AgentAssignmentService.create`); not re-validated client-side, the
 * backend-validates-surface-the-error posture this app takes
 * throughout. A second active PRIMARY on the same target, or a
 * duplicate active (agent, scope, role, target) tuple, both come back
 * as a 409 from the backend and are surfaced as-is.
 *
 * `endAssignment` (`POST /agent-assignments/:id/end`, `agent.manage`)
 * requires a `reason`; rejected with a 409 if the assignment already
 * ended (confirmed directly) — surfaced as-is, not re-checked
 * client-side against `isActive`, since a table row could be stale by
 * the time the button is clicked either way.
 */
export async function createAssignment(input: {
  agentId: string;
  entityId: string;
  scope: 'PROJECT' | 'UNIT' | 'SALE';
  role: 'PRIMARY' | 'CO_AGENT' | 'REFERRAL';
  projectId?: string;
  unitId?: string;
  allocationId?: string;
  notes?: string;
}): Promise<AssignmentActionState> {
  try {
    await fetchApi('/agent-assignments', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create agent assignment.' };
  }

  revalidatePath('/agent-assignments');
  return { ok: true };
}

export async function endAssignment(id: string, reason: string): Promise<AssignmentActionState> {
  try {
    await fetchApi(`/agent-assignments/${id}/end`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to end agent assignment.' };
  }

  revalidatePath('/agent-assignments');
  return { ok: true };
}
