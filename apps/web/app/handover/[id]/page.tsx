import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { HandoverActions } from './HandoverActions';
import { AddSnagForm } from './AddSnagForm';
import { SnagActions } from './SnagActions';
import { HandoverSnagsTable } from './HandoverDetailTables';

export const dynamic = 'force-dynamic';

interface Snag {
  id: string;
  category: string | null;
  description: string;
  severity: string;
  status: string;
  dueDate: string | null;
  resolvedNotes: string | null;
  createdAt: string;
}

interface HandoverRecordDetail {
  id: string;
  status: string;
  scheduledDate: string;
  inspectedAt: string | null;
  completedAt: string | null;
  customerSignedAt: string | null;
  cancelledReason: string | null;
  unit: { id: string; code: string };
  customer: { id: string; name: string };
  allocation: { id: string };
  snags: Snag[];
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  SCHEDULED: 'neutral',
  INSPECTION_DONE: 'warning',
  SNAGS_PENDING: 'warning',
  COMPLETED: 'positive',
  CANCELLED: 'negative',
};

const SNAG_STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'neutral',
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
 * Frontend Completion, FE-4.1 — Handover Record detail, alongside
 * `app/handover/page.tsx`'s list. `GET /handover-records/:id`
 * (`HandoverController.getOne`, `handover.view`) already includes
 * `snags` ordered newest-first (`HandoverService.getHandoverRecord`,
 * confirmed directly), so this page needs only the one request — no
 * separate `GET /handover-records/:id/snags` call, avoiding the
 * redundant second round trip that endpoint exists for other callers
 * (e.g. a snags-only widget) to use instead.
 */
async function loadHandoverRecord(id: string) {
  return fetchApi<HandoverRecordDetail>(`/handover-records/${id}`);
}

export default async function HandoverRecordPage({ params }: { params: { id: string } }) {
  let record: HandoverRecordDetail | null = null;
  let error: string | null = null;
  try {
    record = await loadHandoverRecord(params.id);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load this handover record.';
  }

  if (error || !record) {
    return (
      <PageContainer>
        <PageHeader title="Handover" breadcrumbs={[{ label: 'Handover', href: '/handover' }, { label: params.id }]} />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Handover record not found.'}</div>
      </PageContainer>
    );
  }

  const openSnags = record.snags.filter((s) => s.status === 'OPEN' || s.status === 'IN_PROGRESS').length;

  return (
    <PageContainer>
      <PageHeader
        title={`Unit ${record.unit.code}`}
        subtitle={record.customer.name}
        breadcrumbs={[{ label: 'Handover', href: '/handover' }, { label: record.unit.code }]}
      />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
        <KpiCard label="Status" value={record.status} tone={STATUS_TONE[record.status] ?? 'neutral'} />
        <KpiCard label="Scheduled date" value={new Date(record.scheduledDate).toLocaleDateString()} />
        <KpiCard label="Open snags" value={String(openSnags)} tone={openSnags > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="Inspected" value={record.inspectedAt ? new Date(record.inspectedAt).toLocaleDateString() : '—'} />
      </section>

      {record.cancelledReason && (
        <div style={{ marginBottom: tokens.space(6), color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Cancelled: {record.cancelledReason}
        </div>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Actions" />
        <HandoverActions id={record.id} status={record.status} />
      </section>

      <section>
        <PageHeader title="Snags" />
        <AddSnagForm handoverRecordId={record.id} />
        <HandoverSnagsTable rows={record.snags} handoverRecordId={record.id} />
      </section>
    </PageContainer>
  );
}
