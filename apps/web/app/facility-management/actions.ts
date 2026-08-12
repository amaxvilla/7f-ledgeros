'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateMaintenanceRequestFormState {
  ok: boolean;
  error?: string;
}

/**
 * Sixth Server Action in this app, same reasoning as tenants/actions.ts's
 * createTenant, crm/actions.ts's createLead, tax/actions.ts's
 * createTaxCode, fixed-assets/actions.ts's createFixedAsset, and
 * lease-management/actions.ts's createLease.
 *
 * `POST /facility/maintenance-requests` (FacilityController) requires
 * entityId and category; priority/source are both optional
 * `@IsIn`-validated enums on CreateMaintenanceRequestDto — sent as
 * `undefined` when left unset (Select's own placeholder-not-selected
 * state), matching CreateLeaseDto's own optional rentFrequency handling
 * in createLease.
 */
export async function createMaintenanceRequest(input: {
  entityId: string;
  category: string;
  description: string;
  priority?: string;
  facilityId?: string;
  targetResolutionDate?: string;
}): Promise<CreateMaintenanceRequestFormState> {
  try {
    await fetchApi('/facility/maintenance-requests', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create maintenance request.' };
  }

  revalidatePath('/facility-management');
  return { ok: true };
}
