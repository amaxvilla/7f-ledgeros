'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreatePaymentLinkFormState {
  ok: boolean;
  error?: string;
}

/**
 * Ninth Server Action in this app, same reasoning as every prior create
 * action, most recently recruitment/actions.ts's createVacancy — and
 * the second one added to a page that predates the form-per-page
 * convention (Payments shipped read-only in Checkpoint C, same as
 * Recruitment did in Checkpoint B).
 *
 * `POST /payments/initialize` (payments.controller.ts) requires
 * `payments.manage`, not the `payments.view` this page's own read calls
 * use — same "read and write are different permissions" split every
 * other Create*Form's own doc comment already notes for its resource.
 *
 * `amount` here is ALREADY minor-unit (kobo/cents) by the time this
 * action receives it — InitializePaymentDto requires an integer minor
 * amount (see that DTO's own doc comment), but this page's KpiCard/
 * DataTable values are displayed as major-unit via its own
 * formatMinorUnits() helper, so CreatePaymentLinkForm converts
 * major-to-minor client-side (a human types "500.00" naira, not
 * "50000" kobo) before calling this action — the same "convert at the
 * form boundary, not the transport boundary" split payments/page.tsx's
 * own formatMinorUnits already established for the read side.
 *
 * `metadata` (an arbitrary JSON object on InitializePaymentDto) is
 * deliberately omitted from both this action's input type and the form
 * — no existing form in this app has a free-form JSON field, and
 * inventing that UI pattern for one optional field on one form isn't
 * this checkpoint's job.
 */
export async function createPaymentLink(input: {
  entityId: string;
  providerCode: string;
  reference: string;
  amount: number;
  currency: string;
  customerEmail: string;
  description?: string;
  callbackUrl?: string;
}): Promise<CreatePaymentLinkFormState> {
  try {
    await fetchApi('/payments/initialize', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to initialize payment.' };
  }

  revalidatePath('/payments');
  return { ok: true };
}
