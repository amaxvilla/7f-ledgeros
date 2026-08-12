'use server';

import { fetchApi, ApiError } from '../../lib/api';

export interface PowerBiActionState<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * Frontend Completion, FE-9.1 — Power BI Pages, the item FE-9 names
 * directly. `PowerBiController`/`PowerBiService` are fully wired
 * end-to-end (confirmed directly — `PowerBiProviderRegistry` has a real
 * registered provider, `POWER_BI_PROVIDER_CODE = 'POWER_BI'`, despite
 * `power-bi-provider.interface.ts`'s own doc comment being stale
 * ("no concrete provider... not yet bound anywhere") — the same kind of
 * out-of-date comment-vs-actual-code gap this app's history has already
 * surfaced more than once, so it's checked directly rather than taken
 * at face value) with zero frontend anywhere.
 *
 * No `revalidatePath` calls here, unlike most of this app's other
 * `actions.ts` files — confirmed directly: `PowerBiService` has "no
 * Prisma persistence" (its own doc comment) — every one of these five
 * calls is a stateless passthrough to the registered provider, so
 * there's no local list/page state for a revalidation to refresh.
 * Every result the caller needs (a new `providerDatasetId`, a refresh
 * status, an embed config) comes back directly in this action's own
 * return value instead.
 */
export async function publishDataset(input: {
  providerCode: string;
  datasetName: string;
  tables: { name: string; columns: { name: string; dataType: string }[] }[];
}): Promise<PowerBiActionState<{ providerDatasetId: string }>> {
  try {
    const data = await fetchApi<{ providerDatasetId: string }>('/power-bi/datasets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to publish dataset.' };
  }
}

export async function pushRows(input: {
  providerCode: string;
  providerDatasetId: string;
  tableName: string;
  rows: Record<string, unknown>[];
}): Promise<PowerBiActionState> {
  try {
    const { providerDatasetId, ...body } = input;
    await fetchApi(`/power-bi/datasets/${providerDatasetId}/rows`, { method: 'POST', body: JSON.stringify(body) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to push rows.' };
  }
}

export async function triggerRefresh(input: { providerCode: string; providerDatasetId: string }): Promise<PowerBiActionState> {
  try {
    await fetchApi(`/power-bi/datasets/${input.providerDatasetId}/refresh`, {
      method: 'POST',
      body: JSON.stringify({ providerCode: input.providerCode }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to trigger refresh.' };
  }
}

export async function getRefreshStatus(input: {
  providerCode: string;
  providerDatasetId: string;
}): Promise<PowerBiActionState<{ status: string }>> {
  try {
    const data = await fetchApi<{ status: string }>(
      `/power-bi/datasets/${input.providerDatasetId}/refresh?providerCode=${encodeURIComponent(input.providerCode)}`,
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to get refresh status.' };
  }
}

export async function getEmbedConfig(input: {
  providerCode: string;
  providerReportId: string;
}): Promise<PowerBiActionState<{ embedUrl: string; accessToken: string; expiresAt: string }>> {
  try {
    const data = await fetchApi<{ embedUrl: string; accessToken: string; expiresAt: string }>(
      `/power-bi/reports/${input.providerReportId}/embed-config?providerCode=${encodeURIComponent(input.providerCode)}`,
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to get embed config.' };
  }
}
