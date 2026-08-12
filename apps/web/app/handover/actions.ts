'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface HandoverActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-4.1 — Handover, the first FE-4 page for a
 * module with no frontend at all yet. Confirmed directly against
 * `HandoverController`/`HandoverService`/`prisma.schema` before writing
 * anything (not assumed from the module name): `handover-records`
 * (schedule/list/get/inspect/cancel/complete) and a separate
 * `snags` resource sharing the same `SnagItem` model, both gated by
 * `handover.view`/`handover.manage` — `complete` alone needs
 * `revenue.recognize` instead, since it's the one action that actually
 * posts a journal entry (`RevenueRecognitionService.recognizeOnHandover`,
 * reused as-is, not duplicated — see `HandoverService.completeHandover`'s
 * own doc comment).
 *
 * `revenue-recognition/actions.ts`'s own `RecognizeHandoverForm` is a
 * DIFFERENT, already-shipped capability, not this one under a different
 * name — it calls `RevenueRecognitionService.recognizeOnHandover`
 * directly, with no open-snag guard and no `HandoverRecord.status`
 * update (confirmed directly against both controllers). `completeHandover`
 * here goes through `HandoverController`'s own `:id/complete` route
 * instead, which layers both of those on top before delegating to the
 * same underlying recognition call.
 *
 * `scheduleHandover`'s four ID fields (`allocationId`/`entityId`/
 * `unitId`/`customerId`) are all plain, opaque strings on
 * `ScheduleHandoverDto` with no list endpoint behind any of them
 * (confirmed: `real-estate.controller.ts` has no `GET
 * /real-estate/allocations`) — same "opaque required field, plain
 * TextField" shape `CreateWorkPackageForm`'s own `contractorId` already
 * established, not a gap left unfilled.
 */
export async function scheduleHandover(input: {
  allocationId: string;
  entityId: string;
  unitId: string;
  customerId: string;
  scheduledDate: string;
}): Promise<HandoverActionState> {
  try {
    await fetchApi('/handover-records', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to schedule handover.' };
  }

  revalidatePath('/handover');
  return { ok: true };
}

export async function inspectHandover(id: string): Promise<HandoverActionState> {
  try {
    await fetchApi(`/handover-records/${id}/inspect`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record inspection.' };
  }

  revalidatePath('/handover');
  revalidatePath(`/handover/${id}`);
  return { ok: true };
}

export async function cancelHandover(id: string, reason: string): Promise<HandoverActionState> {
  try {
    await fetchApi(`/handover-records/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to cancel handover.' };
  }

  revalidatePath('/handover');
  revalidatePath(`/handover/${id}`);
  return { ok: true };
}

export async function completeHandover(
  id: string,
  input: {
    entryDate: string;
    salePrice: number;
    costOfUnit: number;
    deferredRevenueGlId: string;
    propertySalesRevenueGlId: string;
    costOfSalesGlId: string;
    propertyInventoryGlId: string;
  },
): Promise<HandoverActionState> {
  try {
    await fetchApi(`/handover-records/${id}/complete`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to complete handover.' };
  }

  revalidatePath('/handover');
  revalidatePath(`/handover/${id}`);
  return { ok: true };
}

export async function addSnag(
  handoverRecordId: string,
  input: {
    description: string;
    category?: string;
    severity?: string;
    assignedToId?: string;
    dueDate?: string;
  },
): Promise<HandoverActionState> {
  try {
    await fetchApi(`/handover-records/${handoverRecordId}/snags`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to add snag.' };
  }

  revalidatePath(`/handover/${handoverRecordId}`);
  return { ok: true };
}

export async function startSnag(id: string, handoverRecordId: string): Promise<HandoverActionState> {
  try {
    await fetchApi(`/snags/${id}/start`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start snag work.' };
  }

  revalidatePath(`/handover/${handoverRecordId}`);
  return { ok: true };
}

export async function resolveSnag(id: string, handoverRecordId: string, resolvedNotes?: string): Promise<HandoverActionState> {
  try {
    await fetchApi(`/snags/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolvedNotes }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to resolve snag.' };
  }

  revalidatePath(`/handover/${handoverRecordId}`);
  return { ok: true };
}

export async function verifySnag(id: string, handoverRecordId: string): Promise<HandoverActionState> {
  try {
    await fetchApi(`/snags/${id}/verify`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to verify snag.' };
  }

  revalidatePath(`/handover/${handoverRecordId}`);
  return { ok: true };
}

export async function rejectSnag(id: string, handoverRecordId: string, reason: string): Promise<HandoverActionState> {
  try {
    await fetchApi(`/snags/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject snag.' };
  }

  revalidatePath(`/handover/${handoverRecordId}`);
  return { ok: true };
}
