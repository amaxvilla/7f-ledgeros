'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateTenantFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, Checkpoint Q — the first Server Action in this
 * app. Runs on the server, so it's the only place this form's request
 * can carry `API_SERVICE_TOKEN` — fetchApi's own doc comment is explicit
 * that token is "never exposed to the client", so CreateTenantForm (a
 * 'use client' component) cannot call fetchApi directly; it must go
 * through this action instead. This is what makes a form possible at
 * all without either leaking the token to the browser or standing up a
 * separate Next.js Route Handler just to proxy the request — a Server
 * Action already runs server-side and is directly callable from a
 * Client Component, so it's the smaller of those two options for this
 * first form.
 *
 * `revalidatePath('/tenants')` after a successful create — the same
 * entityId-scoped list this form lives alongside re-fetches on the next
 * navigation/refresh rather than showing a stale pre-create snapshot,
 * the standard App Router pattern for a mutation that should invalidate
 * a Server Component page's cached fetch.
 */
export async function createTenant(input: {
  entityId: string;
  customerId: string;
  unitId: string;
  moveInDate: string;
  notes?: string;
}): Promise<CreateTenantFormState> {
  try {
    await fetchApi('/tenants', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create tenant.' };
  }

  revalidatePath('/tenants');
  return { ok: true };
}
