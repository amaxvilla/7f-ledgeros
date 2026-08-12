'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateLeaseFormState {
  ok: boolean;
  error?: string;
}

/**
 * Fifth Server Action in this app, same reasoning as tenants/actions.ts's
 * createTenant, crm/actions.ts's createLead, tax/actions.ts's
 * createTaxCode, and fixed-assets/actions.ts's createFixedAsset.
 *
 * `POST /leases` (LeaseController — see lease.controller.ts's own
 * `@Controller('leases')`, a sibling of the already-used
 * `@Controller('tenants')` in the same file) requires entityId,
 * matching every predecessor except createTaxCode.
 */
export async function createLease(input: {
  entityId: string;
  tenantId: string;
  unitId: string;
  leaseNumber: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  rentFrequency?: string;
  depositAmount?: number;
}): Promise<CreateLeaseFormState> {
  try {
    await fetchApi('/leases', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create lease.' };
  }

  revalidatePath('/lease-management');
  return { ok: true };
}
