'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface AgentActionState {
  ok: boolean;
  error?: string;
}

/**
 * Agent Management, RE-AGENT.1 (frontend) — Agent Master. Verified
 * before building: `AgentController`/`AgentService` are fully
 * implemented (CRUD, four guarded lifecycle transitions) with no
 * frontend consumer anywhere in this app — confirmed directly by
 * grepping every `app/**\/*.tsx` for `/agents` before adding this
 * (`/agent-assignments`, RE-AGENT.2's own checkpoint, only ever calls
 * `GET /agents` as a `Select`'s option source — not a CRUD consumer of
 * this resource).
 *
 * `createAgent` (`POST /agents`, `agent.manage`) requires `entityId`/
 * `agentType`/`code`/`displayName`/`email`/`phone`; every other field
 * is optional with a real server-side default (`withholdingTaxExempt`
 * → `false`, confirmed directly in `AgentService.create`) — left as
 * `undefined` when blank rather than re-supplying that default
 * client-side, the same posture `entities/actions.ts` already
 * established. A new agent always starts `PENDING_APPROVAL` — no
 * `status` field on this form at all, since `CreateAgentDto` has none
 * either.
 *
 * Lives in this one file (register + detail actions together, unlike
 * `/consolidation`'s split between its register and its
 * `[id]/AddOwnershipForm`) because every one of these actions
 * revalidates the SAME two paths — the register and the one detail
 * page a change was just made to — and this resource has no
 * register-only vs. detail-only action split the way Consolidation's
 * ownership-recording does.
 */
export async function createAgent(input: {
  entityId: string;
  agentType: 'INDIVIDUAL' | 'COMPANY' | 'BROKER';
  code: string;
  displayName: string;
  contactPersonName?: string;
  email: string;
  phone: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  licenseNumber?: string;
  licenseIssuingBody?: string;
  licenseExpiryDate?: string;
  registrationNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSwiftCode?: string;
  taxIdentificationNumber?: string;
  withholdingTaxExempt?: boolean;
  agreementReference?: string;
  agreementStartDate?: string;
  agreementEndDate?: string;
  notes?: string;
}): Promise<AgentActionState> {
  try {
    await fetchApi('/agents', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create agent.' };
  }

  revalidatePath('/agents');
  return { ok: true };
}

export async function updateAgent(
  id: string,
  input: Partial<{
    agentType: 'INDIVIDUAL' | 'COMPANY' | 'BROKER';
    displayName: string;
    contactPersonName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    licenseNumber: string;
    licenseIssuingBody: string;
    licenseExpiryDate: string;
    registrationNumber: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankSwiftCode: string;
    taxIdentificationNumber: string;
    withholdingTaxExempt: boolean;
    agreementReference: string;
    agreementStartDate: string;
    agreementEndDate: string;
    notes: string;
  }>,
): Promise<AgentActionState> {
  try {
    await fetchApi(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update agent.' };
  }

  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return { ok: true };
}

export async function approveAgent(id: string): Promise<AgentActionState> {
  try {
    await fetchApi(`/agents/${id}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve agent.' };
  }
  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return { ok: true };
}

export async function suspendAgent(id: string, reason: string): Promise<AgentActionState> {
  try {
    await fetchApi(`/agents/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to suspend agent.' };
  }
  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return { ok: true };
}

export async function reactivateAgent(id: string): Promise<AgentActionState> {
  try {
    await fetchApi(`/agents/${id}/reactivate`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reactivate agent.' };
  }
  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return { ok: true };
}

export async function terminateAgent(id: string, reason: string): Promise<AgentActionState> {
  try {
    await fetchApi(`/agents/${id}/terminate`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to terminate agent.' };
  }
  revalidatePath('/agents');
  revalidatePath(`/agents/${id}`);
  return { ok: true };
}
