'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateLeadFormState {
  ok: boolean;
  error?: string;
}

/**
 * Second Server Action in this app, same reasoning as tenants/actions.ts's
 * createTenant (Checkpoint Q): only the server can carry
 * API_SERVICE_TOKEN, so CreateLeadForm ('use client') must go through
 * this rather than calling fetchApi directly.
 */
export async function createLead(input: {
  entityId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
}): Promise<CreateLeadFormState> {
  try {
    await fetchApi('/crm/leads', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create lead.' };
  }

  revalidatePath('/crm');
  return { ok: true };
}
