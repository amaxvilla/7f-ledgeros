'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface SignatureEnvelopeActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, SIG.1 — the manual-envelope register's one write
 * path, same `fetchApi` + `revalidatePath('/signatures')` shape every
 * other module page's `actions.ts` already uses (Project Risks'
 * `closeRisk`, most directly). `POST /signatures/manual-envelopes/:id/decline`
 * (`SignaturesController.decline`, Checkpoint J) takes an optional
 * `reason` — this checkpoint's own `DeclineEnvelopeButton` doesn't
 * collect one (see that component's own doc comment), so `reason` is
 * always omitted here rather than half-wired for a UI field that
 * doesn't exist yet.
 *
 * `complete` (uploading the countersigned copy, Checkpoint I) is
 * deliberately NOT surfaced this checkpoint — it needs a file input,
 * real, separate multipart-form work on roughly the scale of
 * `CreateFixedAssetForm`'s own file-upload field, not a same-shape
 * addition to this one action file.
 */
export async function declineEnvelope(id: string): Promise<SignatureEnvelopeActionState> {
  try {
    await fetchApi(`/signatures/manual-envelopes/${id}/decline`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to decline envelope.' };
  }

  revalidatePath('/signatures');
  return { ok: true };
}
