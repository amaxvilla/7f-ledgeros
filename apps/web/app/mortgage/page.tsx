import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateMortgageApplicationForm } from './CreateMortgageApplicationForm';

export const dynamic = 'force-dynamic';

interface MortgagePipelineSummary {
  totalApplications: number;
  byStatus: Record<string, number>;
  totalAmountApproved: number;
  totalDisbursed: number;
  totalOutstanding: number;
}

interface MortgageApplication {
  id: string;
  lenderName: string;
  amountApplied: number;
  amountApproved: number | null;
  disbursedAmount: number | null;
  status: string;
  createdAt: string;
}

async function loadMortgages(entityId: string) {
  const [summary, applications] = await Promise.all([
    fetchApi<MortgagePipelineSummary>(`/dashboard/mortgage-exposure?entityId=${entityId}`),
    fetchApi<MortgageApplication[]>(`/mortgage-applications?entityId=${entityId}`),
  ]);
  return { summary, applications };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  APPROVED: 'positive',
  DISBURSED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'negative',
  PENDING: 'warning',
  SUBMITTED: 'warning',
};

/**
 * Frontend Completion — Mortgage Management, the next module page after
 * Tenants/Lease Management/Fixed Assets/Tax. Picked by the same
 * criterion PaymentsPage's own doc comment established: of the domains
 * still without a page, this is the one with BOTH a ready-made
 * dashboard aggregate (`GET /dashboard/mortgage-exposure`) AND a ready
 * list endpoint (`GET /mortgage-applications`) — no new backend work
 * required. Transfer APIs remains the one PaymentsPage's own comment
 * flagged as blocked on a missing `/dashboard/transfers-overview`
 * aggregate; still true as of this checkpoint, so it stays deferred.
 *
 * Same architecture as every other module page: an async Server
 * Component, one Promise.all of fetchApi calls, no client-side state
 * beyond the one write-path form below.
 *
 * amountApplied/amountApproved/disbursedAmount are already major-unit
 * (Naira) — MortgageApplication has no minor-unit convention the way
 * PaymentTransaction does (see PaymentsPage's own formatMinorUnits
 * note), so this page calls formatCurrency directly, matching the root
 * dashboard's own budget/AR-AP figures.
 */
export default async function MortgagePage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Mortgage Management" subtitle="Enter an entity ID to view its mortgage pipeline." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadMortgages>> | null = null;
  let error: string | null = null;
  try {
    data = await loadMortgages(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load mortgage data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Mortgage Management" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
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
            <KpiCard label="Applications" value={String(data.summary.totalApplications)} />
            <KpiCard label="Approved" value={formatCurrency(data.summary.totalAmountApproved)} tone="positive" />
            <KpiCard label="Disbursed" value={formatCurrency(data.summary.totalDisbursed)} tone="positive" />
            <KpiCard
              label="Outstanding"
              value={formatCurrency(data.summary.totalOutstanding)}
              tone={data.summary.totalOutstanding > 0 ? 'warning' : 'neutral'}
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="By status" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              {Object.entries(data.summary.byStatus)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <Badge key={status} tone={STATUS_TONE[status] ?? 'neutral'}>
                    {status}: {count}
                  </Badge>
                ))}
              {Object.values(data.summary.byStatus).every((count) => count === 0) && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No mortgage applications yet.
                </span>
              )}
            </div>
          </section>

          <section>
            <PageHeader title="Applications" />
            <CreateMortgageApplicationForm entityId={entityId} />
            <DataTable
              columns={[
                { header: 'Lender', render: (r: MortgageApplication) => r.lenderName },
                { header: 'Applied', align: 'right', render: (r: MortgageApplication) => formatCurrency(r.amountApplied) },
                {
                  header: 'Approved',
                  align: 'right',
                  render: (r: MortgageApplication) => (r.amountApproved !== null ? formatCurrency(r.amountApproved) : '—'),
                },
                {
                  header: 'Disbursed',
                  align: 'right',
                  render: (r: MortgageApplication) => (r.disbursedAmount !== null ? formatCurrency(r.disbursedAmount) : '—'),
                },
                {
                  header: 'Status',
                  render: (r: MortgageApplication) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge>,
                },
              ]}
              rows={data.applications}
              keyOf={(r) => r.id}
              emptyMessage="No mortgage applications for this entity yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
