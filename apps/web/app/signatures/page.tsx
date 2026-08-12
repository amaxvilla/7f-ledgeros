import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { DeclineEnvelopeButton } from './DeclineEnvelopeButton';

export const dynamic = 'force-dynamic';

interface ManualSignatureEnvelope {
  id: string;
  documentName: string;
  subject: string | null;
  status: string;
  createdAt: string;
}

/**
 * Frontend Completion, SIG.1 — the twentieth Module Page, and the
 * direct continuation of the Digital Signature Providers Checkpoint L
 * backend session: `GET /signatures/manual-envelopes` was the missing
 * piece every prior Frontend Completion checkpoint's own report flagged
 * as blocking this exact page. Now that it exists, this is that page.
 *
 * NO EntitySelector — same structural reasoning `security/page.tsx`'s
 * own doc comment gives for its four dashboard aggregates:
 * `ManualSignatureEnvelope` has no `entityId`/dimension field at all
 * (confirmed directly against its own schema comment, Checkpoint H),
 * so there is nothing to scope the list by even if this page wanted to.
 *
 * Read-only register plus one row action (Decline) — no create form.
 * Manual envelopes are created indirectly, through `GenericSignatureProvider`'s
 * own `sendForSignature` flow (a different controller, `SignatureController`
 * at `/signatures/envelopes`, Checkpoint K), not by a form on this page;
 * inventing a direct "create a manual envelope" form here would bypass
 * that flow rather than surface it. `complete` (uploading the
 * countersigned copy) is real, separate file-upload work, deliberately
 * deferred — see `DeclineEnvelopeButton`'s own doc comment.
 *
 * KPI section derived client-side from the same list response — no
 * dedicated dashboard aggregate exists for manual envelopes (unlike
 * Project Risks' `pmo-risk-issue-overview`), and building one for a
 * single small counts-by-status breakdown would be more than this
 * checkpoint's own scope calls for.
 */
async function loadSignatureEnvelopes() {
  const envelopes = await fetchApi<ManualSignatureEnvelope[]>('/signatures/manual-envelopes');
  const outstanding = envelopes.filter((e) => e.status === 'SENT' || e.status === 'DELIVERED').length;
  const completed = envelopes.filter((e) => e.status === 'COMPLETED').length;
  const declinedOrVoided = envelopes.filter((e) => e.status === 'DECLINED' || e.status === 'VOIDED').length;
  return { envelopes, kpis: { total: envelopes.length, outstanding, completed, declinedOrVoided } };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  SENT: 'neutral',
  DELIVERED: 'warning',
  COMPLETED: 'positive',
  DECLINED: 'negative',
  VOIDED: 'negative',
};

export default async function SignaturesPage() {
  let data: Awaited<ReturnType<typeof loadSignatureEnvelopes>> | null = null;
  let error: string | null = null;
  try {
    data = await loadSignatureEnvelopes();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load signature envelopes.';
  }

  return (
    <PageContainer>
      <PageHeader title="Signatures" subtitle="Manual signature envelope register" />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total envelopes" value={String(data.kpis.total)} />
            <KpiCard label="Outstanding" value={String(data.kpis.outstanding)} tone={data.kpis.outstanding > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Completed" value={String(data.kpis.completed)} tone="positive" />
            <KpiCard
              label="Declined / voided"
              value={String(data.kpis.declinedOrVoided)}
              tone={data.kpis.declinedOrVoided > 0 ? 'negative' : 'neutral'}
            />
          </section>

          <section>
            <PageHeader title="Envelope register" />
            <DataTable
              columns={[
                { header: 'Document', render: (e: ManualSignatureEnvelope) => e.documentName },
                { header: 'Subject', render: (e: ManualSignatureEnvelope) => e.subject ?? '—' },
                { header: 'Status', render: (e: ManualSignatureEnvelope) => <Badge tone={STATUS_TONE[e.status] ?? 'neutral'}>{e.status}</Badge> },
                { header: 'Created', render: (e: ManualSignatureEnvelope) => new Date(e.createdAt).toLocaleDateString() },
                { header: 'Actions', align: 'right', render: (e: ManualSignatureEnvelope) => <DeclineEnvelopeButton id={e.id} status={e.status} /> },
              ]}
              rows={data.envelopes}
              keyOf={(e) => e.id}
              emptyMessage="No signature envelopes yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
