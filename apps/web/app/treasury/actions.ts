'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateLoanFacilityFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Treasury's write path, same fetchApi +
 * revalidatePath('/treasury') shape as every other Create*Form's
 * action before it.
 */
export async function createLoanFacility(input: {
  entityId: string;
  lenderName: string;
  facilityAmount: number;
  currency?: string;
  interestRatePercent: number;
  startDate: string;
  maturityDate: string;
}): Promise<CreateLoanFacilityFormState> {
  try {
    await fetchApi('/treasury/loan-facilities', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create loan facility.' };
  }

  revalidatePath('/treasury');
  return { ok: true };
}
