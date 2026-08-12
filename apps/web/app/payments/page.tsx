import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreatePaymentLinkForm } from './CreatePaymentLinkForm';

export const dynamic = 'force-dynamic';

interface PaymentsOverview {
  totalCount: number;
  successfulAmount: number;
  byStatus: Record<string, { count: number; totalAmount: number }>;
  refundsByStatus: Record<string, { count: number; totalAmount: number }>;
  totalRefundedAmount: number;
}

interface PaymentTransaction {
  id: string;
  reference: string;
  providerCode: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string;
  createdAt: string;
}

async function loadPayments(entityId: string) {
  const [overview, transactions] = await Promise.all([
    fetchApi<PaymentsOverview>(`/dashboard/payments-overview?entityId=${entityId}`),
    fetchApi<PaymentTransaction[]>(`/payments?entityId=${entityId}`),
  ]);
  return { overview, transactions };
}

/** Amount fields on PaymentTransaction are minor-unit integers (kobo, cents) — see InitializePaymentDto's own doc comment. Every other money value in this app (the finance dashboard's budget/AR-AP/cash figures) is already major-unit, so this conversion is local to this page, not added to formatCurrency itself. */
function formatMinorUnits(amount: number, currency: string): string {
  return formatCurrency(amount / 100, currency);
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  SUCCESSFUL: 'positive',
  FAILED: 'negative',
  PENDING: 'warning',
  ABANDONED: 'neutral',
};

/**
 * Frontend Completion, Checkpoint C — the third Module Page (after the
 * finance dashboard at `/` and Recruitment at `/recruitment`), and the
 * third link in AppShell's own nav. Payments was picked the same way
 * Recruitment was in Checkpoint B (see that page's own doc comment):
 * of the domains without a page yet, it's the one whose backend already
 * has a purpose-built dashboard aggregate (`GET /dashboard/payments-overview`,
 * Release IE.1 Checkpoint G) AND a ready list endpoint (`GET /payments`,
 * Release IE.1 Checkpoint D) — no new backend work required, the same
 * "don't build a page for endpoints that don't exist yet" discipline
 * Checkpoint B's own doc comment established. Transfer APIs was the
 * other domain finished this recently but was passed over for this
 * checkpoint: it has no equivalent `/dashboard/transfers-overview`
 * aggregate yet (see BankTransferController's own routes), which would
 * have meant either building a new backend aggregate first or shipping
 * a page with no KPI section — a natural candidate for a later
 * checkpoint once that aggregate exists.
 *
 * Same architecture as both existing pages: an async Server Component,
 * one Promise.all of fetchApi calls, no client-side state, no new data
 * layer.
 *
 * Frontend Completion — this page's first write path:
 * CreatePaymentLinkForm (see that component's own doc comment), added
 * once Recruitment (the other page that had predated the form-per-page
 * convention) got its own first write path in the prior checkpoint.
 * With this checkpoint, every module page now has the same read+write
 * shape. This page's own read side was left untouched — same
 * "additive, don't touch what already works" posture every prior form
 * checkpoint has followed.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Payments" subtitle="Enter an entity ID to view its payment activity." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadPayments>> | null = null;
  let error: string | null = null;
  try {
    data = await loadPayments(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load payments data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Payments" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Total transactions" value={String(data.overview.totalCount)} />
            <KpiCard label="Successful amount" value={formatMinorUnits(data.overview.successfulAmount, 'NGN')} tone="positive" />
            <KpiCard label="Pending" value={String(data.overview.byStatus.PENDING?.count ?? 0)} tone="warning" />
            <KpiCard
              label="Refunded"
              value={formatMinorUnits(data.overview.totalRefundedAmount, 'NGN')}
              tone={data.overview.totalRefundedAmount > 0 ? 'warning' : 'neutral'}
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="By status" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              {Object.entries(data.overview.byStatus)
                .filter(([, v]) => v.count > 0)
                .map(([status, v]) => (
                  <Badge key={status} tone={STATUS_TONE[status] ?? 'neutral'}>
                    {status}: {v.count}
                  </Badge>
                ))}
              {Object.values(data.overview.byStatus).every((v) => v.count === 0) && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No payment transactions yet.
                </span>
              )}
            </div>
          </section>

          <section>
            <PageHeader title="Recent transactions" />
            <CreatePaymentLinkForm entityId={entityId} />
            <DataTable
              columns={[
                { header: 'Reference', render: (r: PaymentTransaction) => r.reference },
                { header: 'Provider', render: (r: PaymentTransaction) => <Badge tone="neutral">{r.providerCode}</Badge> },
                { header: 'Customer', render: (r: PaymentTransaction) => r.customerEmail },
                { header: 'Amount', align: 'right', render: (r: PaymentTransaction) => formatMinorUnits(r.amount, r.currency) },
                {
                  header: 'Status',
                  render: (r: PaymentTransaction) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge>,
                },
              ]}
              rows={data.transactions}
              keyOf={(r) => r.id}
              emptyMessage="No payment transactions for this entity yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
