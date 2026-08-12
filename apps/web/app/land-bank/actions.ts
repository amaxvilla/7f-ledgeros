'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface LandBankActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-4.1 — Land Bank, first checkpoint of Stage
 * FE-4 (Real Estate), and the first item in that stage's own roadmap
 * order. `LandBankController` is large — Parcels, Acquisitions, Titles,
 * Survey Plans, Plots, Master Plans, Plot Releases — but only Land
 * Parcels has a `GET` list-by-entity endpoint (`findParcels`, confirmed
 * directly); Titles/Survey Plans/Plots/Master Plans are each only
 * listable by their PARENT's id (`GET parcels/:parcelId/titles`, etc.),
 * and Acquisitions has no list endpoint of its own at all (only nested
 * inside a parcel's own `include`). Same "smallest correct slice"
 * discipline as every FE-3 checkpoint: this one scopes to Land Parcels
 * (the resource with a real entity-scoped list) plus Land Acquisitions
 * (the one child resource simple enough to add as a single create form
 * without its own list, since a created acquisition shows up in its
 * parent parcel's own `acquisitions` count on next load). Titles,
 * Survey Plans, Plots, Master Plans, and Plot Releases are left for
 * later Land Bank checkpoints — this is clearly a multi-checkpoint
 * domain the same way Stage FE-3 itself needed six.
 *
 * `createParcel` (`POST /land-bank/parcels`, `landbank.manage`) creates
 * a parcel that starts in `LandParcelStatus.AVAILABLE`
 * (`schema.prisma`'s own default, confirmed directly) — there's no
 * direct status-update endpoint for parcels the way Plots/Acquisitions
 * each have their own `PATCH .../status` (confirmed directly against
 * the controller: no `PATCH parcels/:id/status` route exists); a
 * parcel's status instead advances only as a side effect of other
 * actions (completing an acquisition, titling, subdividing) — so this
 * checkpoint's own `page.tsx` doesn't render a parcel-status-actions
 * component the way `general-ledger`'s `JournalEntryStatusActions` does
 * for journal entries, because there's genuinely no direct transition
 * to expose.
 *
 * `recordAcquisition` (`POST /land-bank/acquisitions`,
 * `landbank.manage`) takes `parcelId`, sourced from the SAME parcels
 * list `page.tsx` already fetches for its own table — no separate
 * registry fetch needed, the same "reuse what's already in hand" shape
 * `bank-reconciliation/page.tsx`'s own `statementLineOptions` uses.
 *
 * Addendum, FE-4.6 — Estates: `createEstate` (`POST /real-estate/estates`,
 * `realestate.manage`) — a genuinely different controller/module from
 * every other action in this file (`RealEstateController`, not
 * `LandBankController`; confirmed directly), reused here rather than
 * duplicated because Estates are the parent dimension both Land Bank's
 * own Master Plans (`estates/:estateId/master-plans`) and Real Estate's
 * Projects/Sales are scoped under — this page is a reasonable home for
 * managing them even though the create endpoint itself isn't part of
 * `LandBankController`. Revalidates `/land-bank` (this page), the same
 * as every other action here.
 */
export async function createEstate(input: {
  entityId: string;
  code: string;
  name: string;
  description?: string;
  location?: string;
}): Promise<LandBankActionState> {
  try {
    await fetchApi('/real-estate/estates', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create estate.' };
  }

  revalidatePath('/land-bank');
  return { ok: true };
}
export async function createParcel(input: {
  entityId: string;
  code: string;
  name: string;
  description?: string;
  location?: string;
  stateProvince?: string;
  localGovernmentArea?: string;
  areaSqm: number;
  acquisitionCostBudget?: number;
}): Promise<LandBankActionState> {
  try {
    await fetchApi('/land-bank/parcels', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create land parcel.' };
  }

  revalidatePath('/land-bank');
  return { ok: true };
}

export async function recordAcquisition(input: {
  parcelId: string;
  vendorName: string;
  vendorContact?: string;
  agreedPrice: number;
  currency?: string;
  paymentTerms?: string;
  dueDiligenceNotes?: string;
}): Promise<LandBankActionState> {
  try {
    await fetchApi('/land-bank/acquisitions', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record acquisition.' };
  }

  revalidatePath('/land-bank');
  return { ok: true };
}
