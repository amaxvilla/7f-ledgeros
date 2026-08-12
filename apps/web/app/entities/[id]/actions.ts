'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface EntityDetailActionState {
  ok: boolean;
  error?: string;
}

/**
 * `updateEntity` (`PATCH /entities/:id`, `entity.manage`) — the field
 * set FE-8.2's own report deferred to this detail-page checkpoint.
 * Revalidates BOTH `/entities/${id}` (this page) AND `/entities` (the
 * register) — a deliberate difference from this app's usual "detail
 * page's own actions only revalidate themselves" convention (e.g.
 * `/work-packages/[id]`'s own actions.ts, which only revalidates
 * itself because the register there shows none of the same fields):
 * the Entities register table displays `code`/`name`/`parentEntityId`
 * directly, exactly the fields this form can change, so leaving the
 * register stale until its own next unrelated revalidation would be a
 * real correctness gap, not a wasted invalidation.
 */
export async function updateEntity(
  id: string,
  input: {
    code: string;
    name: string;
    legalName: string;
    taxIdentificationNumber?: string;
    registrationNumber?: string;
    baseCurrency?: string;
    fiscalYearStartMonth?: number;
    parentEntityId?: string;
    isConsolidationParent?: boolean;
  },
): Promise<EntityDetailActionState> {
  try {
    await fetchApi(`/entities/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to save entity.' };
  }

  revalidatePath(`/entities/${id}`);
  revalidatePath('/entities');
  return { ok: true };
}
