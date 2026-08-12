import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../lib/api';
import { EntitySelector } from './EntitySelector';

export const dynamic = 'force-dynamic';

interface BudgetOverview {
  totals: { budgeted: number; actual: number; committed: number; available: number };
}
interface PayablesReceivables {
  payables: { total: number; invoiceCount: number };
  receivables: { total: number; invoiceCount: number };
  netPosition: number;
}
interface CashForecast {
  horizons: { days: number; outflow: number; inflow: number; net: number }[];
}
interface LoanExposure {
  totalOutstanding: number;
  facilities: { facilityId: string; lenderName: string; outstanding: number; maturityDate: string }[];
}
interface BankReconStatus {
  bankAccounts: { bankAccountId: string; accountName: string; status: string; unmatchedCount: number }[];
}
interface ProjectVariance {
  projectId: string;
  projectName: string;
  budgeted: number;
  actual: number;
  variance: number;
}
interface CommissionOverview {
  earned: number;
  approved: number;
  payable: number;
  paid: number;
  outstanding: number;
}

async function loadDashboard(entityId: string) {
  const [budget, arAp, cash, loans, bankRecon, topProjects, commission] = await Promise.all([
    fetchApi<BudgetOverview>(`/dashboard/budget-vs-actual?entityId=${entityId}`),
    fetchApi<PayablesReceivables>(`/dashboard/outstanding-payables-receivables?entityId=${entityId}`),
    fetchApi<CashForecast>(`/dashboard/cash-forecast?entityId=${entityId}`),
    fetchApi<LoanExposure>(`/dashboard/loan-exposure?entityId=${entityId}`),
    fetchApi<BankReconStatus>(`/dashboard/bank-reconciliation-status?entityId=${entityId}`),
    fetchApi<ProjectVariance[]>(`/dashboard/top-projects-by-variance?entityId=${entityId}&limit=5`),
    fetchApi<CommissionOverview>(`/dashboard/commission-overview?entityId=${entityId}`),
  ]);
  return { budget, arAp, cash, loans, bankRecon, topProjects, commission };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="7F LedgerOS" subtitle="Enter an entity ID to view its dashboard." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadDashboard>> | null = null;
  let error: string | null = null;
  try {
    data = await loadDashboard(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load dashboard data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Dashboard" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
            <KpiCard label="Budgeted" value={formatCurrency(data.budget.totals.budgeted)} />
            <KpiCard label="Actual" value={formatCurrency(data.budget.totals.actual)} />
            <KpiCard label="Committed" value={formatCurrency(data.budget.totals.committed)} tone="warning" />
            <KpiCard label="Available" value={formatCurrency(data.budget.totals.available)} tone="positive" />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
            <KpiCard label="Payables (open)" value={formatCurrency(data.arAp.payables.total)} tone="negative" caption={`${data.arAp.payables.invoiceCount} invoices`} />
            <KpiCard label="Receivables (open)" value={formatCurrency(data.arAp.receivables.total)} tone="positive" caption={`${data.arAp.receivables.invoiceCount} invoices`} />
            <KpiCard label="Net position" value={formatCurrency(data.arAp.netPosition)} tone={data.arAp.netPosition >= 0 ? 'positive' : 'negative'} />
            <KpiCard label="Loan exposure" value={formatCurrency(data.loans.totalOutstanding)} tone="warning" caption={`${data.loans.facilities.length} facilities`} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Cash forecast" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4) }}>
              {data.cash.horizons.map((h) => (
                <KpiCard
                  key={h.days}
                  label={`${h.days}-day net`}
                  value={formatCurrency(h.net)}
                  tone={h.net >= 0 ? 'positive' : 'negative'}
                  caption={`in ${formatCurrency(h.inflow)} / out ${formatCurrency(h.outflow)}`}
                />
              ))}
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Commission" subtitle="See /reports for the full Commission Reports breakdown (by agent, by project, aging, forecast)." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4) }}>
              <KpiCard label="Earned" value={formatCurrency(data.commission.earned)} />
              <KpiCard label="Approved" value={formatCurrency(data.commission.approved)} tone="warning" />
              <KpiCard label="Payable" value={formatCurrency(data.commission.payable)} tone="warning" />
              <KpiCard label="Paid" value={formatCurrency(data.commission.paid)} tone="positive" />
              <KpiCard label="Outstanding" value={formatCurrency(data.commission.outstanding)} tone={data.commission.outstanding > 0 ? 'negative' : 'positive'} />
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Top projects by variance" />
            <DataTable
              columns={[
                { header: 'Project', render: (r: ProjectVariance) => r.projectName },
                { header: 'Budgeted', align: 'right', render: (r: ProjectVariance) => formatCurrency(r.budgeted) },
                { header: 'Actual', align: 'right', render: (r: ProjectVariance) => formatCurrency(r.actual) },
                {
                  header: 'Variance',
                  align: 'right',
                  render: (r: ProjectVariance) => (
                    <Badge tone={r.variance >= 0 ? 'positive' : 'negative'}>{formatCurrency(r.variance)}</Badge>
                  ),
                },
              ]}
              rows={data.topProjects}
              keyOf={(r) => r.projectId}
              emptyMessage="No approved budgets with project-level lines yet."
            />
          </section>

          <section>
            <PageHeader title="Bank reconciliation status" />
            <DataTable
              columns={[
                { header: 'Account', render: (r: BankReconStatus['bankAccounts'][number]) => r.accountName },
                {
                  header: 'Status',
                  render: (r: BankReconStatus['bankAccounts'][number]) => (
                    <Badge tone={r.status === 'APPROVED' ? 'positive' : r.status === 'NOT_STARTED' ? 'neutral' : 'warning'}>
                      {r.status}
                    </Badge>
                  ),
                },
                { header: 'Unmatched lines', align: 'right', render: (r: BankReconStatus['bankAccounts'][number]) => String(r.unmatchedCount) },
              ]}
              rows={data.bankRecon.bankAccounts}
              keyOf={(r) => r.bankAccountId}
              emptyMessage="No active bank accounts for this entity."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
