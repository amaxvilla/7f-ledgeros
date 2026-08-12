'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateMortgageApplicationFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Mortgage Management's write path, same
 * fetchApi + revalidatePath('/mortgage') shape as every other
 * Create*Form's action before it.
 */
export async function createMortgageApplication(input: {
  entityId: string;
  allocationId: string;
  lenderName: string;
  amountApplied: number;
  interestRatePercent?: number;
  tenorMonths?: number;
  notes?: string;
}): Promise<CreateMortgageApplicationFormState> {
  try {
    await fetchApi('/mortgage-applications', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create mortgage application.' };
  }

  revalidatePath('/mortgage');
  return { ok: true };
}
