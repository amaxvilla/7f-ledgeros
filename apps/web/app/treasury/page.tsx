import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateLoanFacilityForm } from './CreateLoanFacilityForm';

export const dynamic = 'force-dynamic';

interface LoanExposureFacilityRow {
  facilityId: string;
  lenderName: string;
  facilityAmount: number;
  drawn: number;
  principalRepaid: number;
  outstanding: number;
  maturityDate: string;
}

interface LoanExposureSummary {
  entityId: string;
  totalOutstanding: number;
  facilities: LoanExposureFacilityRow[];
}

/**
 * A `@MaskFields`-guarded numeric field: either a real number, or the
 * literal string `'••••••••'` (`MASKED_VALUE`,
 * `apps/api/src/security/security.types.ts`) when the caller lacks the
 * `security.field.loanValues.view` permission — see this page's own
 * doc comment below.
 */
type MaybeMasked = number | string;

interface LoanFacility {
  id: string;
  lenderName: string;
  facilityAmount: MaybeMasked;
  currency: string;
  interestRatePercent: MaybeMasked;
  status: string;
  startDate: string;
  maturityDate: string;
  drawdowns: unknown[];
  repaymentSchedule: unknown[];
}

async function loadTreasury(entityId: string) {
  const [loanExposure, loanFacilities] = await Promise.all([
    fetchApi<LoanExposureSummary>(`/dashboard/loan-exposure?entityId=${entityId}`),
    fetchApi<LoanFacility[]>(`/treasury/loan-facilities?entityId=${entityId}`),
  ]);
  return { loanExposure, loanFacilities };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  CLOSED: 'neutral',
  DEFAULTED: 'negative',
};

/**
 * Frontend Completion — Treasury (Loan Facilities), the next module
 * page after Mortgage Management, picked by the same criterion
 * `mortgage/page.tsx`'s own doc comment used: a ready-made dashboard
 * aggregate (`GET /dashboard/loan-exposure`) plus a ready list endpoint
 * (`GET /treasury/loan-facilities`), no new backend work required.
 * `TreasuryController` also exposes bank accounts, cash accounts,
 * drawdowns, repayment schedules/repayments, interest accruals, and
 * placements — all deliberately out of scope here; this checkpoint is
 * Loan Facilities only, the one sub-area with its own dashboard
 * aggregate already wired. The rest remain a reasonable next checkpoint
 * once this one establishes the page.
 *
 * GENUINELY NEW CONSIDERATION — masked fields: `findLoanFacilities`
 * (unlike every other list endpoint this app has consumed so far) is
 * decorated `@MaskFields({ group: 'loanValues', fields:
 * ['facilityAmount', 'interestRatePercent'] })` — a caller without
 * `security.field.loanValues.view` gets back the literal string
 * `'••••••••'` in place of either field, not the number. `formatCurrency`
 * (lib/api.ts) assumes a real `number` argument, so this page cannot
 * call it unconditionally the way every prior page's amount columns do
 * — `renderMaybeMasked` below checks `typeof value === 'number'` first
 * and renders the masked string as-is otherwise. The dashboard
 * aggregate's own `getLoanExposure` (dashboard.controller.ts) has no
 * `@MaskFields` decorator at all, so `loanExposure`'s KPI figures are
 * always real numbers regardless of the caller's field-level
 * permission — an existing backend asymmetry between the summary and
 * detail endpoints, not something this page's own read path
 * introduces or attempts to reconcile.
 *
 * Same architecture as every other module page otherwise: an async
 * Server Component, one Promise.all of fetchApi calls, no client-side
 * state beyond the one write-path form below.
 */
function renderMaybeMasked(value: MaybeMasked, currency: string): string {
  return typeof value === 'number' ? formatCurrency(value, currency) : value;
}

export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Treasury" subtitle="Enter an entity ID to view its loan facilities." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadTreasury>> | null = null;
  let error: string | null = null;
  try {
    data = await loadTreasury(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load treasury data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Treasury" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

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
            <KpiCard label="Active facilities" value={String(data.loanExposure.facilities.length)} />
            <KpiCard
              label="Total facility value"
              value={formatCurrency(data.loanExposure.facilities.reduce((sum, f) => sum + f.facilityAmount, 0))}
            />
            <KpiCard
              label="Outstanding"
              value={formatCurrency(data.loanExposure.totalOutstanding)}
              tone={data.loanExposure.totalOutstanding > 0 ? 'warning' : 'neutral'}
            />
          </section>

          <section>
            <PageHeader title="Loan facilities" />
            <CreateLoanFacilityForm entityId={entityId} />
            <DataTable
              columns={[
                { header: 'Lender', render: (r: LoanFacility) => r.lenderName },
                { header: 'Facility amount', align: 'right', render: (r: LoanFacility) => renderMaybeMasked(r.facilityAmount, r.currency) },
                {
                  header: 'Interest rate',
                  align: 'right',
                  render: (r: LoanFacility) => (typeof r.interestRatePercent === 'number' ? `${r.interestRatePercent}%` : r.interestRatePercent),
                },
                { header: 'Status', render: (r: LoanFacility) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
                { header: 'Maturity', render: (r: LoanFacility) => new Date(r.maturityDate).toLocaleDateString() },
                { header: 'Drawdowns', align: 'right', render: (r: LoanFacility) => String(r.drawdowns.length) },
              ]}
              rows={data.loanFacilities}
              keyOf={(r) => r.id}
              emptyMessage="No loan facilities for this entity yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
