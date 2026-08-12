'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface FeatureFlagActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-8.1 — Feature Flags, first checkpoint of
 * Stage FE-8 (Administration). `FeatureFlagsController` is the
 * smallest surface of any module page in this app so far: one `GET`
 * (list, which idempotently seeds `DEFAULT_FEATURE_FLAGS` on every
 * call — confirmed directly) and one `PUT /feature-flags/:key`
 * (upsert — confirmed directly: `create` and `update` are both wired
 * to the same `dto` in the controller's own `prisma.featureFlag.upsert`
 * call). No separate create endpoint exists because none is needed —
 * `PUT` with a brand-new key creates it, the same key with an existing
 * one updates it. This file has exactly one exported action for that
 * reason, used by both `CreateFeatureFlagForm` (a new key) and
 * `FeatureFlagRow` (an existing one).
 *
 * System-wide, no `entityId` at all — `FeatureFlag` has no such column
 * (confirmed directly against `schema.prisma`), the same structural
 * posture `/security` and `/integrations` already established for
 * genuinely global configuration.
 *
 * `metadata` (a `Json?` column on the model) is deliberately NOT
 * exposed here — `UpsertFeatureFlagDto` itself has no `metadata` field
 * at all (confirmed directly), so there's no endpoint to write it
 * through regardless of whether a `KeyValueEditor`-shaped UI would
 * otherwise fit; this isn't the same "no established pattern yet" gap
 * `integrations/actions.ts` named for `config`/`credentials`, it's a
 * field the DTO simply doesn't accept.
 */
export async function upsertFeatureFlag(
  key: string,
  input: { enabled: boolean; description?: string; rolloutPercent?: number },
): Promise<FeatureFlagActionState> {
  try {
    await fetchApi(`/feature-flags/${key}`, { method: 'PUT', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to save feature flag.' };
  }

  revalidatePath('/feature-flags');
  return { ok: true };
}
