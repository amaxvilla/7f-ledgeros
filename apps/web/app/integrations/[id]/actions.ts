'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface IntegrationDetailActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-7.2 — Integration Provider detail page
 * (`/integrations/[id]`), FE-7.1's own named follow-up: the `config`/
 * `credentials` editor deferred at the time. See `KeyValueEditor.tsx`'s
 * own doc comment for the editor itself.
 *
 * `updateProvider` (`PUT /integrations/:id`, `integrations.manage`)
 * takes `name`/`config`/`isActive`/`retryMaxAttempts`/`retryBackoffMs`
 * — all optional on `UpdateIntegrationProviderDto` (confirmed
 * directly). It does NOT take `credentials` at all — that's a
 * genuinely separate endpoint (`rotateCredentials` below), not an
 * omission on this form's part.
 *
 * `rotateCredentials` (`POST /integrations/:id/rotate-credentials`,
 * same permission) is separate because the backend treats it that way:
 * `getProvider`/`findProviders` both strip `encryptedCredentials`
 * entirely and return only a `hasCredentials` boolean
 * (`IntegrationsService.redact`, confirmed directly) — there is no
 * existing value to pre-populate an edit form with, so this is
 * necessarily a write-only "set new credentials" action, not an
 * "edit existing credentials" one. Both revalidate
 * `/integrations/${id}` and `/integrations` (the list's own
 * `hasCredentials`/`isActive` columns change too) — same
 * "revalidate both routes" shape `land-bank/actions.ts`'s own ADDENDUM
 * established for its own list + detail pair.
 */
export async function updateProvider(
  id: string,
  input: { name?: string; config?: Record<string, unknown>; isActive?: boolean; retryMaxAttempts?: number; retryBackoffMs?: number },
): Promise<IntegrationDetailActionState> {
  try {
    await fetchApi(`/integrations/${id}`, { method: 'PUT', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to update integration provider.' };
  }

  revalidatePath(`/integrations/${id}`);
  revalidatePath('/integrations');
  return { ok: true };
}

export async function rotateCredentials(id: string, credentials: Record<string, unknown>): Promise<IntegrationDetailActionState> {
  try {
    await fetchApi(`/integrations/${id}/rotate-credentials`, { method: 'POST', body: JSON.stringify({ credentials }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to rotate credentials.' };
  }

  revalidatePath(`/integrations/${id}`);
  revalidatePath('/integrations');
  return { ok: true };
}
