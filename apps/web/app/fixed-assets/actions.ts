'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateFixedAssetFormState {
  ok: boolean;
  error?: string;
}

/**
 * Fourth Server Action in this app, same reasoning as
 * tenants/actions.ts's createTenant, crm/actions.ts's createLead, and
 * tax/actions.ts's createTaxCode.
 *
 * Unlike CreateTaxCodeDto, CreateFixedAssetDto DOES require entityId —
 * FixedAsset is entity-scoped (unlike TaxCode's shared-reference-data
 * status — see tax/CreateTaxCodeForm's own doc comment), matching
 * CreateTenantDto's/CreateLeadDto's own entityId requirement instead.
 */
export async function createFixedAsset(input: {
  entityId: string;
  assetCategoryId: string;
  assetTag: string;
  name: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeYears: number;
}): Promise<CreateFixedAssetFormState> {
  try {
    await fetchApi('/fixed-assets', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create fixed asset.' };
  }

  revalidatePath('/fixed-assets');
  return { ok: true };
}
