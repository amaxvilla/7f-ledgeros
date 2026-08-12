'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CommissionPlanActionState {
  ok: boolean;
  error?: string;
}

/**
 * Agent & Commission Management, RE-COMM.1 (frontend) — Commission
 * Plans. Verified before building: `CommissionPlanController`/
 * `CommissionPlanService` are fully implemented (CRUD, deactivate,
 * resolve) with no frontend consumer anywhere in this app — confirmed
 * by grepping every `app/**\/*.tsx` for `/commission-plans` first.
 *
 * `createCommissionPlan` deliberately only supports FLAT (non-tiered)
 * plans from this form — a dynamic min/max/rate tier-row editor is a
 * separably-sized addition of its own, not bundled into this
 * checkpoint's "smallest, closely-related" scope (matching how
 * `/agent-assignments`'s own `AgentSelector` was its own small piece
 * rather than folded into `/agents`). Tiered plans remain fully
 * creatable via the API directly; only the UI is deferred.
 */
export async function createCommissionPlan(input: {
  entityId: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  scope: 'GLOBAL' | 'PROJECT' | 'ESTATE' | 'UNIT' | 'AGENT';
  projectId?: string;
  estateId?: string;
  unitId?: string;
  agentId?: string;
  rate?: number;
  fixedAmount?: number;
  isReferral?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
}): Promise<CommissionPlanActionState> {
  try {
    await fetchApi('/commission-plans', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create commission plan.' };
  }

  revalidatePath('/commission-plans');
  return { ok: true };
}

export async function deactivateCommissionPlan(id: string, reason: string): Promise<CommissionPlanActionState> {
  try {
    await fetchApi(`/commission-plans/${id}/deactivate`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to deactivate commission plan.' };
  }
  revalidatePath('/commission-plans');
  return { ok: true };
}
