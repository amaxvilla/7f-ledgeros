'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface BankIntegrationActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Bank Integration's write paths, same
 * fetchApi + revalidatePath('/bank-integration') shape every other
 * mutation in this app already uses. `linkMonoAccount` is a `POST`
 * (`MonoLinkedAccountController.link`); `revokeLinkedAccount` is a
 * `DELETE` (`MonoLinkedAccountController.revoke`) — this file doesn't
 * normalize that difference away, it calls what the controller
 * actually exposes, same posture Requisition's own actions took toward
 * their controller's mixed verbs.
 */
export async function linkMonoAccount(input: { bankAccountId: string; code: string }): Promise<BankIntegrationActionState> {
  try {
    await fetchApi('/bank-integration/mono/link', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to link account.' };
  }

  revalidatePath('/bank-integration');
  return { ok: true };
}

export async function revokeLinkedAccount(id: string): Promise<BankIntegrationActionState> {
  try {
    await fetchApi(`/bank-integration/mono/linked-accounts/${id}`, { method: 'DELETE' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke linked account.' };
  }

  revalidatePath('/bank-integration');
  return { ok: true };
}
