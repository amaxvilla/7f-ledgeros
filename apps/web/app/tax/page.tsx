import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateTaxCodeForm } from './CreateTaxCodeForm';
import { TaxPositionForm } from './TaxPositionForm';
import { TaxCodesTable } from './TaxTables';

export const dynamic = 'force-dynamic';

interface TaxOverview {
  whtPendingCount: number;
  whtPendingAmount: number;
  vatPendingCount: number;
  vatPendingAmount: number;
}

interface TaxPositionSummary {
  count: number;
  pendingAmount: number;
  remittedAmount: number;
  byAuthorityAccount: Record<string, number>;
}

interface TaxPosition {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  wht: TaxPositionSummary;
  vat: TaxPositionSummary;
}

interface TaxCode {
  id: string;
  code: string;
  name: string;
  taxType: 'WHT' | 'VAT';
  rate: number;
  jurisdiction: string | null;
  isActive: boolean;
}

const TAX_TYPE_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  WHT: 'warning',
  VAT: 'neutral',
};

/**
 * Frontend Completion, Checkpoint M — the seventh Module Page, picked
 * the same way Fixed Assets was in Checkpoint L (see that page's own
 * doc comment): of the domains without a page yet, Tax is the one whose
 * backend already has a purpose-built dashboard aggregate
 * (`GET /dashboard/tax-overview`, Release — Tax Center Core) AND a
 * ready list endpoint (`GET /tax/codes`) — no new backend work
 * required.
 *
 * Deliberately does NOT surface `GET /tax/position` on this page —
 * that endpoint requires a periodStart/periodEnd date range as input,
 * a materially different UI shape (a form, not just a read view) than
 * every other module page built so far. Left for its own later
 * checkpoint once a date-range-input pattern exists to reuse, rather
 * than inventing one just for this page.
 *
 * That later checkpoint: `TaxPositionForm` + the "Tax position" section
 * below. entityId/periodStart/periodEnd all come from searchParams (a
 * GET query, not a mutation — see TaxPositionForm's own doc comment for
 * why this doesn't need a Server Action the way the create-record forms
 * do). Gated behind entityId AND both period dates being present — a
 * user who's only entered an entityId still sees the overview KPIs
 * above and the form to pick a period, but not a position section with
 * nothing to show yet.
 *
 * Entity-scoped like Payments/Recruitment/CRM/Fixed-Assets for the
 * overview KPIs — but the Tax Codes table itself is NOT entity-filtered:
 * TaxCode is reference data shared across every entity (no entityId
 * column on the model at all — see TaxCode's own schema doc comment),
 * unlike the overview, which genuinely is entity-scoped (pending
 * WHT/VAT deductions). Fetched unconditionally below for that reason,
 * while the overview fetch stays gated behind entityId being present.
 * Splitting the render this way (table always shown, KPIs gated behind
 * EntitySelector) is a deliberate small deviation from Fixed
 * Assets/CRM's "nothing renders without an entityId" pattern, justified
 * by TaxCode genuinely not needing one.
 *
 * CreateTaxCodeForm added as this app's third data-entry form — see
 * that component's own doc comment for why it's the first of the three
 * to need no entityId prop at all. Rendered above the Tax Codes table,
 * ungated by entityId (matching that table's own render condition).
 */
export default async function TaxPage({
  searchParams,
}: {
  searchParams: { entityId?: string; periodStart?: string; periodEnd?: string };
}) {
  const entityId = searchParams.entityId;
  const periodStart = searchParams.periodStart;
  const periodEnd = searchParams.periodEnd;

  let codes: TaxCode[] | null = null;
  let codesError: string | null = null;
  try {
    codes = await fetchApi<TaxCode[]>('/tax/codes');
  } catch (e) {
    codesError = e instanceof ApiError ? e.message : 'Failed to load tax codes.';
  }

  let overview: TaxOverview | null = null;
  let overviewError: string | null = null;
  if (entityId) {
    try {
      overview = await fetchApi<TaxOverview>(`/dashboard/tax-overview?entityId=${entityId}`);
    } catch (e) {
      overviewError = e instanceof ApiError ? e.message : 'Failed to load tax overview.';
    }
  }

  let position: TaxPosition | null = null;
  let positionError: string | null = null;
  if (entityId && periodStart && periodEnd) {
    try {
      position = await fetchApi<TaxPosition>(
        `/tax/position?entityId=${entityId}&periodStart=${periodStart}&periodEnd=${periodEnd}`,
      );
    } catch (e) {
      positionError = e instanceof ApiError ? e.message : 'Failed to load tax position.';
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Tax" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to see pending WHT/VAT.'} />
      <EntitySelector initialValue={entityId} />

      {entityId && overviewError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {overviewError}
        </div>
      )}

      {overview && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: tokens.space(4),
            marginBottom: tokens.space(8),
          }}
        >
          <KpiCard
            label="WHT pending"
            value={formatCurrency(overview.whtPendingAmount)}
            tone={overview.whtPendingCount > 0 ? 'warning' : 'positive'}
          />
          <KpiCard label="WHT deductions pending" value={String(overview.whtPendingCount)} />
          <KpiCard
            label="VAT pending"
            value={formatCurrency(overview.vatPendingAmount)}
            tone={overview.vatPendingCount > 0 ? 'warning' : 'positive'}
          />
          <KpiCard label="VAT deductions pending" value={String(overview.vatPendingCount)} />
        </section>
      )}

      {entityId && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Tax position" subtitle="Pending vs. remitted WHT/VAT for a period." />
          <TaxPositionForm entityId={entityId} periodStart={periodStart} periodEnd={periodEnd} />
          {positionError && (
            <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
              {positionError}
            </div>
          )}
          {position && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4) }}>
              <KpiCard label="WHT pending" value={formatCurrency(position.wht.pendingAmount)} tone="warning" />
              <KpiCard label="WHT remitted" value={formatCurrency(position.wht.remittedAmount)} tone="positive" />
              <KpiCard label="VAT pending" value={formatCurrency(position.vat.pendingAmount)} tone="warning" />
              <KpiCard label="VAT remitted" value={formatCurrency(position.vat.remittedAmount)} tone="positive" />
            </div>
          )}
        </section>
      )}

      <section>
        <PageHeader title="Tax codes" subtitle="Shared reference data — not entity-specific." />
        <CreateTaxCodeForm />
        {codesError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {codesError}
          </div>
        )}
        {codes && (
          <TaxCodesTable rows={codes} />
        )}
      </section>
    </PageContainer>
  );
}
