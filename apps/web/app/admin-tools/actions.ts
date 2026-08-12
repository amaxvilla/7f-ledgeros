'use server';

import { fetchApi, ApiError } from '../../lib/api';

export interface FlagOverdueActionState {
  ok: boolean;
  error?: string;
  flagged?: number;
}

/**
 * Frontend Completion, FE-8.4 — Admin Tools, `flagOverdueCorrectiveActions`
 * finally getting the standalone page FE-8.2 and FE-8.3 both
 * independently confirmed it needs, rather than a fourth deferral.
 *
 * `POST /hse/corrective-actions/flag-overdue` (`hse.manage`) — a bulk
 * maintenance action, not a create/list/detail resource, so this file
 * has no register-style `revalidatePath` at all: this page renders no
 * list of corrective actions of its own to invalidate (that already
 * lives under HSE's own module, out of scope here), and the action's
 * own response (`{ flagged: number }`) is everything the caller needs
 * to know the result — surfaced directly, not re-fetched.
 *
 * Confirmed directly: `HseController.flagOverdue` takes a plain inline
 * `{ asOf: string }` body type, NOT a class-validator DTO (there is no
 * `dto/` directory anywhere under `apps/api/src/hse` at all) — `asOf`
 * is genuinely unvalidated server-side, unlike every other date field
 * in this app, which goes through a real DTO with `@IsDateString`. This
 * form still sends a native `type="date"` value (already the correct
 * ISO format `new Date(asOf)` needs), the same convention every other
 * date field in this app uses regardless of whether the destination
 * validates it — not a workaround for the missing validation, just the
 * same input type this app always uses for a date.
 */
export async function flagOverdueCorrectiveActions(asOf: string): Promise<FlagOverdueActionState> {
  try {
    const result = await fetchApi<{ flagged: number }>('/hse/corrective-actions/flag-overdue', {
      method: 'POST',
      body: JSON.stringify({ asOf }),
    });
    return { ok: true, flagged: result.flagged };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to flag overdue corrective actions.' };
  }
}
