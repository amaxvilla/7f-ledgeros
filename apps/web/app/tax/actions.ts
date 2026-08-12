'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateTaxCodeFormState {
  ok: boolean;
  error?: string;
}

/**
 * Third Server Action in this app, same reasoning as tenants/actions.ts's
 * createTenant and crm/actions.ts's createLead.
 */
export async function createTaxCode(input: {
  code: string;
  name: string;
  taxType: string;
  rate: number;
  jurisdiction?: string;
  taxAuthorityAccountId: string;
}): Promise<CreateTaxCodeFormState> {
  try {
    await fetchApi('/tax/codes', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create tax code.' };
  }

  revalidatePath('/tax');
  return { ok: true };
}
