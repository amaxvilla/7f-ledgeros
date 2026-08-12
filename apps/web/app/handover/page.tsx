import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { ScheduleHandoverForm } from './ScheduleHandoverForm';

export const dynamic = 'force-dynamic';

interface HandoverRecord {
  id: string;
  status: string;
  scheduledDate: string;
  inspectedAt: string | null;
  completedAt: string | null;
  unit: { id: string; code: string };
  customer: { id: string; name: string };
  snags: { id: string; status: string }[];
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  SCHEDULED: 'neutral',
  INSPECTION_DONE: 'warning',
  SNAGS_PENDING: 'warning',
  COMPLETED: 'positive',
  CANCELLED: 'negative',
};

interface SnagOverview {
  byStatus: { status: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
}

const SNAG_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'warning',
  RESOLVED: 'positive',
  VERIFIED: 'positive',
  REJECTED: 'negative',
};

const SNAG_SEVERITY_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  MINOR: 'neutral',
  MAJOR: 'warning',
  CRITICAL: 'negative',
};

/**
 * Frontend Completion, FE-4.1 — Handover, opening Stage FE-4 (Real
 * Estate) for a module with no frontend page at all yet. See
 * `actions.ts`'s own doc comment for the full before-coding analysis
 * confirmed against `HandoverController`/`HandoverService` directly.
 *
 * `GET /handover-records` (`HandoverController.findAll`, `handover.view`)
 * takes an optional `status` filter alongside `entityId` — deliberately
 * NOT exposed as its own filter control on this first pass, same
 * "don't build a control for a need nobody's confirmed yet" restraint
 * `real-estate/page.tsx`'s own per-project filter omission used: every
 * row already shows its own status `Badge`, and the list is entity-scoped
 * (usually a handful of in-flight handovers at a time), so a second
 * filter dimension isn't an obvious win yet. A future checkpoint can add
 * one if asked for.
 *
 * `openSnagCount` is computed client-side from the `snags` relation
 * already included on every list row (`HandoverService.findHandoverRecords`,
 * confirmed directly: `include: { unit: true, customer: true, snags: true }`)
 * rather than a second request to `GET /handover-records/:id/snags/summary`
 * per row, which would be N+1 for a list of N handovers.
 *
 * ADDENDUM — Recruitment.1's own recommendation, applied to this page:
 * `GET /dashboard/snag-overview` (`DashboardService.getSnagOverview`,
 * `handover.view`) had no frontend consumer anywhere, confirmed
 * directly. Investigated before wiring it in and found a real, worth-
 * naming scope mismatch: this page is entity-scoped throughout (every
 * KPI/table row above is filtered to the selected `entityId`), but
 * `getSnagOverview()` takes NO `entityId` at all — confirmed directly,
 * it calls `HandoverService.getSnagSummary()` with no argument even
 * though that method itself accepts an optional `handoverRecordId`
 * filter — so it's a genuinely GLOBAL, cross-entity rollup, not a
 * scoped-down version of the KPIs above. Rather than mixing global data
 * into an otherwise entity-scoped section (which would misrepresent it
 * as belonging to the selected entity), this checkpoint adds it as its
 * own explicitly-labeled "All entities" section, the same way
 * `recruitment/page.tsx`'s own "Pipeline by stage" section already
 * renders a badge-list breakdown — reused directly, not a new pattern.
 * `bySeverity` is real, new information this page had no equivalent of
 * before (the existing `openSnagCount`/`snagsPending` KPIs only ever
 * broke snags down by status, never severity).
 */
async function loadHandoverRecords(entityId: string) {
  const [records, snagOverview] = await Promise.all([
    fetchApi<HandoverRecord[]>(`/handover-records?entityId=${entityId}`),
    fetchApi<SnagOverview>('/dashboard/snag-overview'),
  ]);
  return { records, snagOverview };
}

export default async function HandoverPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Handover" subtitle="Enter an entity ID to view its handover records." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let records: HandoverRecord[] = [];
  let snagOverview: SnagOverview | null = null;
  let error: string | null = null;
  try {
    const result = await loadHandoverRecords(entityId);
    records = result.records;
    snagOverview = result.snagOverview;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load handover records.';
  }

  const scheduled = records.filter((r) => r.status === 'SCHEDULED').length;
  const snagsPending = records.filter((r) => r.status === 'SNAGS_PENDING').length;
  const completed = records.filter((r) => r.status === 'COMPLETED').length;
  const openSnagsTotal = records.reduce((sum, r) => sum + r.snags.filter((s) => s.status === 'OPEN' || s.status === 'IN_PROGRESS').length, 0);

  return (
    <PageContainer>
      <PageHeader title="Handover" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
        <KpiCard label="Scheduled" value={String(scheduled)} />
        <KpiCard label="Snags pending" value={String(snagsPending)} tone={snagsPending > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="Completed" value={String(completed)} tone="positive" />
        <KpiCard label="Open snags (all records)" value={String(openSnagsTotal)} tone={openSnagsTotal > 0 ? 'warning' : 'neutral'} />
      </section>

      <ScheduleHandoverForm entityId={entityId} />

      <DataTable
        columns={[
          { header: 'Unit', render: (r: HandoverRecord) => <Link href={`/handover/${r.id}`} style={{ color: tokens.color.accent }}>{r.unit.code}</Link> },
          { header: 'Customer', render: (r: HandoverRecord) => r.customer.name },
          { header: 'Scheduled', render: (r: HandoverRecord) => new Date(r.scheduledDate).toLocaleDateString() },
          { header: 'Status', render: (r: HandoverRecord) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
          {
            header: 'Open snags',
            align: 'right',
            render: (r: HandoverRecord) => String(r.snags.filter((s) => s.status === 'OPEN' || s.status === 'IN_PROGRESS').length),
          },
        ]}
        rows={records}
        keyOf={(r) => r.id}
        emptyMessage="No handover records for this entity yet."
      />

      {snagOverview && (
        <section style={{ marginTop: tokens.space(8) }}>
          <PageHeader title="Snags — all entities" subtitle="Global rollup, not scoped to the selected entity." />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(6) }}>
            <div>
              <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, display: 'block', marginBottom: tokens.space(2) }}>
                By status
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(2) }}>
                {snagOverview.byStatus.length === 0 && (
                  <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>No snags recorded yet.</span>
                )}
                {snagOverview.byStatus.map((s) => (
                  <Badge key={s.status} tone={SNAG_STATUS_TONE[s.status] ?? 'neutral'}>
                    {s.status}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, display: 'block', marginBottom: tokens.space(2) }}>
                By severity
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(2) }}>
                {snagOverview.bySeverity.length === 0 && (
                  <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>No snags recorded yet.</span>
                )}
                {snagOverview.bySeverity.map((s) => (
                  <Badge key={s.severity} tone={SNAG_SEVERITY_TONE[s.severity] ?? 'neutral'}>
                    {s.severity}: {s.count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
