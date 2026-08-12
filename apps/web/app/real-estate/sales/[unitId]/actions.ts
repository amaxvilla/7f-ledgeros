'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../../lib/api';

export interface UnitActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — `cancelReservation`/`cancelAllocation`
 * (`RealEstateController`, confirmed directly against
 * `RealEstateService`). Both take just `{ reason: string }`
 * (`CancelReservationDto`/`CancelAllocationDto`, both confirmed
 * directly to be identically-shaped one-field DTOs) — genuinely the
 * simplest two mutating actions on this controller, which is why they
 * were the first two this app built. `convertReservation` (below) was
 * the third. FE-4.10's own report named `transferAllocation`/
 * `swapUnitAllocation` as the last remaining pair on this controller's
 * ALLOCATION-side actions — both added at FE-4.11. `createInstallmentSchedule`
 * (FE-4.12, below) is a sixth, different-shaped action: unlike the five
 * above, it isn't keyed by a path param at all — see its own doc
 * comment for why.
 *
 * `cancelReservation` requires `realestate.sell`; `cancelAllocation`
 * requires `realestate.manage` — confirmed directly to be genuinely
 * different permissions, not assumed symmetric. Both enforced
 * server-side only.
 *
 * `revalidatePath` targets this page's own dynamic route
 * (`/real-estate/sales/[unitId]`) using the caller-supplied `unitId` —
 * `entityId`/`projectId` aren't part of the path itself (query params,
 * not segments), so they don't need to be threaded through here.
 */
export async function cancelReservation(unitId: string, reservationId: string, reason: string): Promise<UnitActionState> {
  try {
    await fetchApi(`/real-estate/reservations/${reservationId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel reservation.' };
  }

  revalidatePath(`/real-estate/sales/${unitId}`);
  return { ok: true };
}

/**
 * Frontend Completion — `convertReservation`
 * (`RealEstateController.convertReservation`, confirmed directly
 * against `RealEstateService.convertReservationToSale`). Takes the full
 * `ConvertReservationRequestDto` object as one argument — same
 * multi-field-object shape `reviseBudget`/`transferBudget` already
 * established elsewhere in this app for a DTO with more than one or two
 * scalars, rather than a long flat parameter list.
 *
 * A real server-side side effect worth naming plainly: this one action
 * also raises AND posts an AR invoice (`AccountsReceivableService.createInvoice`
 * then `.postInvoice`, confirmed directly, reusing that module's own
 * posting engine) — this `actions.ts` doesn't call either separately or
 * duplicate any of that logic; one `POST .../convert` does the entire
 * reservation → sale → posted-invoice chain server-side in one
 * transaction-adjacent sequence.
 */
export async function convertReservation(
  unitId: string,
  reservationId: string,
  input: { salePrice: number; allocationDate: string; invoiceNumber: string; revenueAccountId: string; arControlAccountId: string },
): Promise<UnitActionState> {
  try {
    await fetchApi(`/real-estate/reservations/${reservationId}/convert`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to convert reservation to sale.' };
  }

  revalidatePath(`/real-estate/sales/${unitId}`);
  return { ok: true };
}

export async function cancelAllocation(unitId: string, allocationId: string, reason: string): Promise<UnitActionState> {
  try {
    await fetchApi(`/real-estate/allocations/${allocationId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel allocation.' };
  }

  revalidatePath(`/real-estate/sales/${unitId}`);
  return { ok: true };
}

/**
 * Frontend Completion, FE-4.11 — `transferAllocation`
 * (`RealEstateController.transferAllocation`, confirmed directly
 * against `RealEstateService.transferAllocation`). Keyed by
 * `allocationId`, NOT `reservationId` — a real difference from
 * `convertReservation` above, confirmed directly against the
 * controller's own route (`allocations/:allocationId/transfer`) and
 * `RealEstateService`'s own guard (`original.status === HANDED_OVER ||
 * SOLD` throws, `isCancelled` throws — otherwise permitted for any
 * allocation status, including `ALLOCATED`/`UNDER_CONTRACT`, the two
 * this page's own `findCurrentAllocationId` already derives an id for).
 * `newCustomerId` is the only field beyond `reason` — `TransferAllocationForm.tsx`'s
 * own doc comment explains the `Select` this needs.
 *
 * Server-side, this cancels the original allocation and creates a
 * brand-new one for the new customer in the same transaction
 * (confirmed directly) — this action doesn't duplicate any of that,
 * one `POST .../transfer` does the whole thing.
 */
export async function transferAllocation(
  unitId: string,
  allocationId: string,
  newCustomerId: string,
  reason: string,
): Promise<UnitActionState> {
  try {
    await fetchApi(`/real-estate/allocations/${allocationId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newCustomerId, reason }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to transfer allocation.' };
  }

  revalidatePath(`/real-estate/sales/${unitId}`);
  return { ok: true };
}

/**
 * Frontend Completion, FE-4.11 — `swapUnitAllocation`
 * (`RealEstateController.swapUnitAllocation`, confirmed directly
 * against `RealEstateService.swapUnitAllocation`). Same `allocationId`
 * keying and status guard as `transferAllocation` above, plus one more:
 * the target unit itself must be `AVAILABLE` server-side (confirmed
 * directly — `ConflictException` naming the unit's own current status
 * otherwise) — not re-validated client-side beyond
 * `SwapUnitForm.tsx`'s own picker already only offering `AVAILABLE`
 * units to begin with (see that file's own doc comment for why that's
 * a UI-level narrowing, not a guarantee the server-side check is
 * skipped).
 *
 * Server-side, this cancels the original allocation, flips the
 * original unit back to `AVAILABLE`, and creates a new allocation on
 * the target unit for the same customer, all in one transaction
 * (confirmed directly).
 */
export async function swapUnitAllocation(
  unitId: string,
  allocationId: string,
  newUnitId: string,
  reason: string,
): Promise<UnitActionState> {
  try {
    await fetchApi(`/real-estate/allocations/${allocationId}/swap`, {
      method: 'POST',
      body: JSON.stringify({ newUnitId, reason }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to swap unit allocation.' };
  }

  revalidatePath(`/real-estate/sales/${unitId}`);
  return { ok: true };
}

/**
 * Frontend Completion, FE-4.12 — `createInstallmentSchedule`
 * (`RealEstateController.createSchedule`, `POST
 * /real-estate/installment-schedules`, confirmed directly against
 * `RealEstateService.createInstallmentSchedule`). Unlike every other
 * action in this file, the request body carries `allocationId` itself
 * (confirmed directly: `CreateInstallmentPlanDto` is `{ allocationId,
 * installments }`, not a path param the way `transfer`/`swap`/`cancel`
 * all key their target through the URL) — this function still takes
 * `allocationId` as its own parameter rather than folding it into
 * `installments`, purely to keep this file's own calling convention
 * consistent (every action here takes the ids it needs as explicit
 * leading parameters), not because the backend requires it split out.
 *
 * Two real server-side rules confirmed directly, neither duplicated
 * client-side (same "let the backend validate, surface its error"
 * posture `convertReservation`'s own `salePrice` already established):
 * a `ConflictException` if this allocation already has a schedule
 * (`@@unique` on `InstallmentSchedule.allocationId`), and a
 * `BadRequestException` if the installments' own total doesn't match
 * the allocation's `salePrice` (within a 0.01 tolerance) — this is WHY
 * `CreateInstallmentScheduleForm.tsx` doesn't show or validate against
 * the sale price itself: the error message already names both numbers
 * when they don't match, and fetching the allocation's own `salePrice`
 * separately just to duplicate that check client-side isn't worth a
 * new fetch for a check the backend already does precisely.
 */
export async function createInstallmentSchedule(
  unitId: string,
  allocationId: string,
  installments: { dueDate: string; amountDue: number }[],
): Promise<UnitActionState> {
  try {
    await fetchApi('/real-estate/installment-schedules', {
      method: 'POST',
      body: JSON.stringify({ allocationId, installments }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create installment schedule.' };
  }

  revalidatePath(`/real-estate/sales/${unitId}`);
  return { ok: true };
}
