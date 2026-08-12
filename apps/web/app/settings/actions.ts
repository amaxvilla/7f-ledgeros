'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface SettingsActionState {
  ok: boolean;
  error?: string;
}

/**
 * FE-1.8 — Settings. `PUT /admin/me/preferences` (`AdminBrandingController`,
 * confirmed by reading it directly before wiring this) upserts
 * `UserPreference` (theme/language/timezone) for the calling user only —
 * it takes no `entityId`/`userId` in its body, resolving the caller
 * entirely from the request's own JWT the same way every other genuine
 * self-service endpoint in this app does (`/security/sessions/me`,
 * `/security/devices/me`). Same permission-gate fix landed on the
 * backend controller in this checkpoint (see its own doc comment) —
 * this endpoint used to require an admin permission (`admin.branding.view`)
 * that most seeded roles don't have, which would have made this page 403
 * for most users before that fix.
 *
 * Only revalidates `/settings` itself — no other page currently reads
 * `UserPreference` (confirmed by grepping the whole frontend for
 * `me/preferences` before writing this), so there's nothing else to
 * invalidate, unlike `updateEntity`'s own two-path revalidation.
 */
export async function updateMyPreferences(input: {
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  language?: string;
  timezone?: string;
}): Promise<SettingsActionState> {
  try {
    await fetchApi('/admin/me/preferences', { method: 'PUT', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to save settings.' };
  }

  revalidatePath('/settings');
  return { ok: true };
}
