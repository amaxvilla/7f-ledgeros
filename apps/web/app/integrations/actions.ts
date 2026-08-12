'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface IntegrationActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-7.1 — Enterprise Integrations. Confirmed
 * directly against `prisma.schema`'s own `IntegrationCategory` enum
 * before picking this over a per-provider page: `MICROSOFT_GRAPH`,
 * `GOOGLE_WORKSPACE`, `SMS`, `WHATSAPP`, `POWER_BI`, `DIGITAL_SIGNATURE`,
 * `BANKING`, `PAYMENT`, `API_GATEWAY`, `STORAGE`, `EMAIL`, `OTHER` are
 * all one unified registry (`IntegrationProvider`/`IntegrationsController`,
 * `integrations.view`/`integrations.manage`), not twelve separate
 * per-category tables — so one connector-management page covers most of
 * FE-7's list in a single checkpoint, rather than building the same
 * list-plus-health-check UI eight more times for eight more categories.
 * Payments, Bank APIs, and Digital Signatures already have their own
 * dedicated module pages (payments/bank-integration/signatures) for
 * their own domain data (transactions, envelopes) — this page is the
 * separate, narrower "connector configuration and health" surface those
 * three (and every other category) also happen to sit on top of, not a
 * replacement for any of them.
 *
 * `createIntegrationProvider` deliberately omits `config`/`credentials`
 * — both are freeform `Record<string, unknown>` JSON blobs on
 * `CreateIntegrationProviderDto`, and this app has no established
 * JSON-textarea input pattern anywhere yet to build on (confirmed by
 * checking every existing `Create*Form`). Inventing one is a real UX
 * decision (raw JSON textarea vs. a dynamic key/value editor) that
 * deserves its own considered checkpoint rather than a guess bolted
 * onto this one — named here rather than silently left out. A provider
 * can still be created and health-checked (the no-op driver handles a
 * missing config/credentials gracefully — `NoopIntegrationDriver`,
 * confirmed directly); rotating in real credentials is that same
 * deferred follow-up.
 */
export async function createIntegrationProvider(input: {
  category: string;
  providerCode: string;
  name: string;
  entityId?: string;
}): Promise<IntegrationActionState> {
  try {
    await fetchApi('/integrations', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create integration.' };
  }

  revalidatePath('/integrations');
  return { ok: true };
}

export async function runHealthCheck(id: string): Promise<IntegrationActionState> {
  try {
    await fetchApi(`/integrations/${id}/health-check`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Health check failed.' };
  }

  revalidatePath('/integrations');
  return { ok: true };
}

export async function runHealthCheckAll(): Promise<IntegrationActionState> {
  try {
    await fetchApi('/integrations/health-check-all', { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to run health checks.' };
  }

  revalidatePath('/integrations');
  return { ok: true };
}
