'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface SalesActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Property Sales, opening Stage FE-4's last
 * unbuilt roadmap item (Land Bank/Master Planning, Handover, Lease,
 * Facility Management, Mortgage all already have pages — confirmed
 * directly by listing `apps/web/app` before starting, per FE-4.7's own
 * recommendation to do a fresh "which already exist" pass rather than
 * narrowing Land Bank further).
 *
 * `POST /real-estate/reservations` (`RealEstateController.reserveUnit`
 * → `RealEstateService.reserveUnit`, `realestate.sell` — a different
 * permission from every other Real Estate page's own `realestate.view`/
 * `.manage`, confirmed directly) takes `ReserveUnitRequestDto`:
 * `unitId`/`customerId`/`entityId`/`projectId` all required,
 * `expiresInHours`/`reservationFee` both optional (confirmed directly
 * against `property-sales.dto.ts`). `entityId`/`projectId` are passed
 * through from this page's own already-selected scope, not re-entered
 * by the form itself.
 *
 * NO CANCEL/CONVERT ACTIONS IN THIS CHECKPOINT, NAMED HERE RATHER THAN
 * SILENTLY DROPPED: `cancelReservation`/`convertReservationToSale` both
 * exist on the backend and both need a `reservationId` to act on — but
 * there is genuinely no endpoint anywhere that lists reservations (only
 * per-unit `allocation-history`, per-customer `statement`, and the
 * aggregate `pipeline-summary` counts this page's own KPI row already
 * uses, all confirmed directly by reading every `@Get` on
 * `RealEstateController`). Without a reservation list, there is no row
 * to attach a Cancel/Convert action to yet — a real, checked backend
 * gap (unlike the Projects-registry claim FE-2.5 corrected), not a
 * scoping choice. `getAllocationHistory(unitId)` is the closest
 * available substitute and is a real candidate for the next checkpoint
 * once a specific unit is selected (see this page's own doc comment).
 */
export async function reserveUnit(input: {
  unitId: string;
  customerId: string;
  entityId: string;
  projectId: string;
  expiresInHours?: number;
  reservationFee?: number;
}): Promise<SalesActionState> {
  try {
    await fetchApi('/real-estate/reservations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reserve unit.' };
  }

  revalidatePath('/real-estate/sales');
  return { ok: true };
}
