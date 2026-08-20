import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CalculateCommissionForm } from './CalculateCommissionForm';
import { CalculationLifecycleControls } from './CalculationLifecycleControls';
import { CommissionCalculationsTable } from './CommissionCalculationsTables';

interface Account {
  id: string;
  code: string;
  name: string;
}

export const dynamic = 'force-dynamic';

interface CommissionCalculation {
  id: string;
  agentId: string;
  agentAssignmentId: string;
  allocationId: string;
  commissionPlanId: string;
  basisType: 'GROSS' | 'NET';
  grossSaleValue: string | number;
  discountAmount: string | number;
  netSaleValue: string | number;
  collectionBasis: 'FULL' | 'COLLECTED';
  collectedPercent: string | number | null;
  proratedBasisAmount: string | number;
  grossCommission: string | number;
  whtApplied: boolean;
  whtAmount: string | number;
  netCommission: string | number;
  status: 'CALCULATED' | 'PENDING' | 'APPROVED' | 'PAYABLE' | 'PAID' | 'REJECTED' | 'REVERSED' | 'CANCELLED';
  calculatedAt: string;
}

const STATUS_TONE: Record<CommissionCalculation['status'], 'neutral' | 'positive' | 'warning' | 'negative'> = {
  CALCULATED: 'neutral',
  PENDING: 'warning',
  APPROVED: 'warning',
  PAYABLE: 'warning',
  PAID: 'positive',
  REJECTED: 'negative',
  REVERSED: 'negative',
  CANCELLED: 'neutral',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'CALCULATED', label: 'Calculated' },
  { value: 'PENDING', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAYABLE', label: 'Payable' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'REVERSED', label: 'Reversed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function money(v: string | number): string {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Agent & Commission Management, RE-COMM.2/RE-COMM.3 (frontend) —
 * Commission Calculation + Lifecycle. Same entity-scoped
 * `EntitySelector` + client-side-filtered `DataTable` pattern
 * `/commission-plans` and `/agents` already established. Row-level
 * lifecycle controls (submit/approve/reject/mark payable/mark paid/
 * cancel/reverse) live in `CalculationLifecycleControls`, rendered
 * per-row based on each row's own current status.
 */
async function loadCalculations(entityId: string) {
  const [calculations, accounts] = await Promise.all([
    fetchApi<CommissionCalculation[]>(`/commission-calculations?entityId=${encodeURIComponent(entityId)}`),
    fetchApi<Account[]>(`/accounts/entity/${encodeURIComponent(entityId)}/active`),
  ]);
  return {
    calculations,
    accountOptions: accounts.map<SelectOption>((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
  };
}

export default async function CommissionCalculationsPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let calculations: CommissionCalculation[] | null = null;
  let accountOptions: SelectOption[] = [];
  let error: string | null = null;
  if (entityId) {
    try {
      const data = await loadCalculations(entityId);
      calculations = data.calculations;
      accountOptions = data.accountOptions;
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load commission calculations.';
    }
  }

  const ACTIVE_STATUSES: CommissionCalculation['status'][] = ['CALCULATED', 'PENDING', 'APPROVED', 'PAYABLE', 'PAID'];
  const totalNet = calculations
    ? calculations.filter((c) => ACTIVE_STATUSES.includes(c.status)).reduce((sum, c) => sum + Number(c.netCommission), 0)
    : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Commission Calculations"
        subtitle="Calculate a commission for a confirmed sale-scope agent assignment, tracing every amount back to its underlying property transaction and commission plan."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Commission Calculations' }]}
      />

      <EntitySelector initialValue={entityId} />

      {!entityId && (
        <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Select an entity above to view or calculate commissions.
        </div>
      )}

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>}

      {calculations && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total calculations" value={String(calculations.length)} />
            <KpiCard label="Active (non-terminal)" value={String(calculations.filter((c) => ACTIVE_STATUSES.includes(c.status)).length)} />
            <KpiCard label="Rejected / Reversed / Cancelled" value={String(calculations.filter((c) => !ACTIVE_STATUSES.includes(c.status)).length)} />
            <KpiCard label="Net commission (active)" value={money(totalNet)} />
          </section>

          <CalculateCommissionForm />

          <CommissionCalculationsTable rows={calculations} accountOptions={accountOptions} />
        </>
      )}
    </PageContainer>
  );
}
