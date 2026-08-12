'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface GenerateApiKeyState {
  ok: boolean;
  plaintextKey?: string;
  error?: string;
}

export interface RevokeApiKeyState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, Checkpoint AR — API Gateway's first page.
 * `POST /api-gateway/keys` (ApiKeyController.generate, `api_gateway.manage`)
 * returns `{ plaintextKey, apiKey }` — the ONLY place the raw key ever
 * exists outside this one response (ApiKeyService.generateKey's own doc
 * comment). Passed straight through as `plaintextKey`, same "returned
 * once, never re-fetchable" shape this app already has twice
 * (MfaService.confirmEnrollment's recovery codes, TrustedDeviceService.
 * trustDevice's raw token) — GenerateApiKeyForm's own doc comment covers
 * why it's never persisted client-side beyond this response either.
 *
 * `scopes` arrives here as a plain string array (already split from the
 * form's comma-separated text field) — this action does no validation
 * beyond what GenerateApiKeyDto's own `@IsString({ each: true })`
 * already enforces server-side.
 */
export async function generateApiKey(input: {
  entityId: string;
  name: string;
  scopes?: string[];
  expiresAt?: string;
  rateLimitPerMinute?: number;
}): Promise<GenerateApiKeyState> {
  try {
    const result = await fetchApi<{ plaintextKey: string }>('/api-gateway/keys', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/api-gateway');
    return { ok: true, plaintextKey: result.plaintextKey };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to generate API key.' };
  }
}

/**
 * `POST /api-gateway/keys/:id/revoke` (ApiKeyController.revoke,
 * `api_gateway.manage`) — no reason field on this form; RevokeApiKeyDto's
 * own `reason` is optional, and no existing revoke action in this app
 * (revokeSession/revokeDevice in my-security/actions.ts) collects one
 * either, so this stays consistent with that precedent rather than
 * being the first revoke action to ask for one.
 */
export async function revokeApiKey(id: string): Promise<RevokeApiKeyState> {
  try {
    await fetchApi(`/api-gateway/keys/${id}/revoke`, { method: 'POST', body: JSON.stringify({}) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke API key.' };
  }
  revalidatePath('/api-gateway');
  return { ok: true };
}
