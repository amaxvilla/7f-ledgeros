'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface QueueActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-8.5 — Queue. `JobsController`/`JobRunsController`
 * (confirmed directly, not assumed — the existence-check sweep FIX.7
 * recommended found 5 backend modules genuinely missing a frontend:
 * Workflow, Notifications, Queue, Monitoring, Storage). Queue was picked
 * as this checkpoint's own slice: `GET /monitoring/metrics` is a raw
 * Prometheus text-exposition endpoint (`Content-Type: text/plain;
 * version=0.0.4`) meant for an external scraper, not JSON an app UI
 * would render; `GET /storage/files/*` is a single generic file-download
 * passthrough with no list/manage surface at all — neither is a real
 * frontend candidate on its own merits, confirmed by reading both
 * controllers directly before ruling them out, not assumed from their
 * names. Workflow (8 routes) and Notifications (2 controllers, 10
 * routes) are both real candidates but larger than this session's own
 * "2-3 related components" sizing — left for their own future
 * checkpoints.
 *
 * Only the two simplest of `JobsController`'s four trigger endpoints
 * were surfaced in FE-8.5: `TriggerDashboardRefreshDto` (one optional
 * field) and `TriggerBudgetRecalculationDto` (two optional fields).
 * `TriggerBankStatementImportDto` (8 required fields, including a
 * `fileUrl` implying a file-upload prerequisite this app still has no
 * pattern for) remains deferred. `TriggerReportGenerationDto` is added
 * THIS checkpoint (FC-3.1) — its four fields (`reportKey` 7-value enum,
 * `entityId`, optional `fiscalYear`, `format` 'json'|'csv') need no new
 * pattern this app doesn't already have (`Select` for the two enums,
 * plain fields for the rest), unlike bank-statement import's own
 * blocking file-upload gap.
 */
export async function triggerDashboardRefresh(entityId: string | undefined): Promise<QueueActionState> {
  try {
    await fetchApi('/jobs/dashboard-refresh', { method: 'POST', body: JSON.stringify({ entityId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to queue a dashboard refresh.' };
  }

  revalidatePath('/queue');
  return { ok: true };
}

export async function triggerBudgetRecalculation(
  budgetId: string | undefined,
  entityId: string | undefined,
): Promise<QueueActionState> {
  try {
    await fetchApi('/jobs/budget-recalculation', { method: 'POST', body: JSON.stringify({ budgetId, entityId }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to queue a budget recalculation.' };
  }

  revalidatePath('/queue');
  return { ok: true };
}

export async function triggerReportGeneration(input: {
  reportKey: string;
  entityId: string;
  fiscalYear?: number;
  format: string;
}): Promise<QueueActionState> {
  try {
    await fetchApi('/jobs/report-generation', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to queue report generation.' };
  }

  revalidatePath('/queue');
  return { ok: true };
}
