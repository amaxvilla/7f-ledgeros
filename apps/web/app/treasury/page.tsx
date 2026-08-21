import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateLoanFacilityForm } from './CreateLoanFacilityForm';
import { TreasuryTable } from './TreasuryTable';
import type { LoanFacility } from './TreasuryTable';

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

async function loadTreasury(entityId: string) {
  const [loanExposure, loanFacilities] = await Promise.all([
    fetchApi<LoanExposureSummary>(`/dashboard/loan-exposure?entityId=${entityId}`),
    fetchApi<LoanFacility[]>(`/treasury/loan-facilities?entityId=${entityId}`),
  ]);
  return { loanExposure, loanFacilities };
}



/**
 * Frontend Completion â€” Treasury (Loan Facilities), the next module
 * page after Mortgage Management, picked by the same criterion
 * `mortgage/page.tsx`'s own doc comment used: a ready-made dashboard
 * aggregate (`GET /dashboard/loan-exposure`) plus a ready list endpoint
 * (`GET /treasury/loan-facilities`), no new backend work required.
 * `TreasuryController` also exposes bank accounts, cash accounts,
 * drawdowns, repayment schedules/repayments, interest accruals, and
 * placements â€” all deliberately out of scope here; this checkpoint is
 * Loan Facilities only, the one sub-area with its own dashboard
 * aggregate already wired. The rest remain a reasonable next checkpoint
 * once this one establishes the page.
 *
 * GENUINELY NEW CONSIDERATION â€” masked fields: `findLoanFacilities`
 * (unlike every other list endpoint this app has consumed so far) is
 * decorated `@MaskFields({ group: 'loanValues', fields:
 * ['facilityAmount', 'interestRatePercent'] })` â€” a caller without
 * `security.field.loanValues.view` gets back the literal string
 * `'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'` in place of either field, not the number. `formatCurrency`
 * (lib/api.ts) assumes a real `number` argument, so this page cannot
 * call it unconditionally the way every prior page's amount columns do
 * — the client-side TreasuryTable checks the field type before formatting masked values.
 * and renders the masked string as-is otherwise. The dashboard
 * aggregate's own `getLoanExposure` (dashboard.controller.ts) has no
 * `@MaskFields` decorator at all, so `loanExposure`'s KPI figures are
 * always real numbers regardless of the caller's field-level
 * permission â€” an existing backend asymmetry between the summary and
 * detail endpoints, not something this page's own read path
 * introduces or attempts to reconcile.
 *
 * Same architecture as every other module page otherwise: an async
 * Server Component, one Promise.all of fetchApi calls, no client-side
 * state beyond the one write-path form below.
 */

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
              value={typeof data.loanExposure.totalOutstanding === 'number' ? formatCurrency(data.loanExposure.facilities.reduce((sum, f) => sum + (f.facilityAmount as number), 0)) : data.loanExposure.totalOutstanding}
            />
            <KpiCard
              label="Outstanding"
              value={typeof data.loanExposure.totalOutstanding === 'number' ? formatCurrency(data.loanExposure.totalOutstanding) : data.loanExposure.totalOutstanding}
              tone={typeof data.loanExposure.totalOutstanding === 'number' && data.loanExposure.totalOutstanding > 0 ? 'warning' : 'neutral'}
            />
          </section>

          <section>
            <PageHeader title="Loan facilities" />
            <CreateLoanFacilityForm entityId={entityId} />
            <TreasuryTable
              rows={data.loanFacilities}
              emptyMessage="No loan facilities for this entity yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
