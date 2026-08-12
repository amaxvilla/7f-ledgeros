import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../../../lib/api';

export const dynamic = 'force-dynamic';

interface InstallmentLine {
  id: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidAt: string | null;
}

interface StatementPosition {
  allocationId: string;
  unitCode: string;
  salePrice: number;
  status: string;
  allocationDate: string;
  totalDue: number;
  totalPaid: number;
  outstandingBalance: number;
  installments: InstallmentLine[];
}

interface CustomerStatement {
  customer: { id: string; code: string; name: string };
  positions: StatementPosition[];
  grandTotalOutstanding: number;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  AVAILABLE: 'positive',
  RESERVED: 'warning',
  ALLOCATED: 'warning',
  UNDER_CONTRACT: 'warning',
  HANDED_OVER: 'neutral',
  SOLD: 'positive',
};

/**
 * Frontend Completion, FE-4.13 — Customer Statement
 * (`/real-estate/customers/[customerId]/statement`), the pair FE-4.11
 * named and FE-4.12 deliberately deferred ("a different key, different
 * page shape" than Installment Schedules). Read
 * `RealEstateService.getCustomerStatement` directly before building
 * anything, per FE-4.12's own instruction not to assume its return
 * shape — it's genuinely richer than a flat list, confirmed directly:
 * `{ customer: {id, code, name}, positions: [{ allocationId, unitCode,
 * salePrice, status, allocationDate, totalDue, totalPaid,
 * outstandingBalance, installments: InstallmentScheduleLine[] }],
 * grandTotalOutstanding }` — one position PER allocation this customer
 * has ever held (every unit, across every project, every status,
 * `isCancelled` allocations included — confirmed directly: the
 * `unitSaleAllocation.findMany` this method runs has no `isCancelled`
 * or status filter at all), each with its own nested installment lines
 * and running totals already computed server-side. Every number this
 * page renders is read straight off that response — no client-side
 * recomputation of `totalDue`/`totalPaid`/`outstandingBalance`/
 * `grandTotalOutstanding`, all four already correct as returned.
 *
 * `position.status` reuses `UnitStatus` (confirmed directly against
 * `schema.prisma` — `UnitSaleAllocation.status` is typed `UnitStatus`,
 * the exact same enum `sales/[unitId]/page.tsx`'s own `UNIT_STATUS_TONE`
 * already maps) — that map is mirrored here as `STATUS_TONE`, not
 * imported, since neither page exports its own local constant for the
 * other to share (no shared status-tone util exists in this app yet;
 * worth extracting only once a third page needs the same map).
 *
 * NO `EntitySelector` gate — confirmed directly, same reasoning
 * `work-packages/[id]/page.tsx` already established for its own detail
 * page: `getCustomerStatement` takes only `customerId` as a path param,
 * no `entityId`/RLS scope check of any kind (customers are shared
 * reference data with no `entityId` column at all, the same fact
 * `dimensions/page.tsx`'s own doc comment already established for the
 * customer register this page is linked from).
 *
 * Read-only — no action this checkpoint. `RealEstateController` has no
 * payment-recording endpoint (confirmed again, unchanged finding from
 * FE-4.12's own report), so there is nothing to submit here; this page
 * is a pure statement view, the Real Estate equivalent of
 * `ap-ar/page.tsx`'s own read-only balance sections.
 */
async function loadCustomerStatement(customerId: string) {
  return fetchApi<CustomerStatement>(`/real-estate/customers/${customerId}/statement`);
}

export default async function CustomerStatementPage({ params }: { params: { customerId: string } }) {
  let data: CustomerStatement | null = null;
  let error: string | null = null;
  try {
    data = await loadCustomerStatement(params.customerId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load customer statement.';
  }

  if (error || !data) {
    return (
      <PageContainer>
        <PageHeader title="Customer statement" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Customer statement not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/dimensions" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to customers
          </Link>
        </p>
      </PageContainer>
    );
  }

  const { customer, positions, grandTotalOutstanding } = data;

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/dimensions" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to customers
        </Link>
      </p>

      <PageHeader title={`${customer.code} — ${customer.name}`} subtitle="Customer statement" />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Allocations" value={String(positions.length)} />
        <KpiCard label="Total outstanding" value={formatCurrency(grandTotalOutstanding)} tone={grandTotalOutstanding > 0 ? 'warning' : 'positive'} />
      </section>

      {positions.length === 0 && (
        <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          This customer has no allocations yet.
        </p>
      )}

      {positions.map((position) => (
        <section key={position.allocationId} style={{ marginBottom: tokens.space(8) }}>
          <PageHeader
            title={position.unitCode}
            subtitle={`Allocated ${new Date(position.allocationDate).toLocaleDateString()} · Sale price ${formatCurrency(position.salePrice)}`}
          />
          <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center', marginBottom: tokens.space(4) }}>
            <Badge tone={STATUS_TONE[position.status] ?? 'neutral'}>{position.status}</Badge>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
              Due {formatCurrency(position.totalDue)} · Paid {formatCurrency(position.totalPaid)} · Outstanding{' '}
              {formatCurrency(position.outstandingBalance)}
            </span>
          </div>
          <DataTable
            columns={[
              { header: 'Due date', render: (l: InstallmentLine) => new Date(l.dueDate).toLocaleDateString() },
              { header: 'Amount due', align: 'right', render: (l: InstallmentLine) => formatCurrency(l.amountDue) },
              { header: 'Amount paid', align: 'right', render: (l: InstallmentLine) => formatCurrency(l.amountPaid) },
              {
                header: 'Status',
                render: (l: InstallmentLine) => <Badge tone={l.paidAt ? 'positive' : 'neutral'}>{l.paidAt ? 'Paid' : 'Outstanding'}</Badge>,
              },
            ]}
            rows={position.installments}
            keyOf={(l) => l.id}
            emptyMessage="No installment schedule for this allocation yet."
          />
        </section>
      ))}
    </PageContainer>
  );
}
