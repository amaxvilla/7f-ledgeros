import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import {
  RealEstateUnsoldTable,
  RealEstateAgeingTable,
  RealEstateSalesVelocityTable,
} from './RealEstateDashboardTables';

export const dynamic = 'force-dynamic';

interface SalesVelocityRow {
  entity_id: string;
  project_id: string;
  project_code: string;
  sale_month: string;
  units_sold: number | string;
  total_sale_value: number | string | null;
  avg_days_to_sell: number | string | null;
}

interface InventoryAgeingRow {
  entity_id: string;
  project_id: string;
  project_code: string;
  unit_id: string;
  unit_code: string;
  unit_status: string;
  list_price: number | string | null;
  listed_at: string;
  age_days: number | string;
  age_bucket: string;
}

interface AbsorptionRateRow {
  entity_id: string;
  project_id: string;
  project_code: string;
  sale_month: string;
  units_sold: number | string;
  total_units: number | string;
  absorption_rate_percent: number | string | null;
}

interface UnsoldUnitsRow {
  entity_id: string;
  project_id: string;
  project_code: string;
  available_count: number | string;
  reserved_count: number | string;
  under_contract_count: number | string;
  total_unsold_count: number | string;
  total_unsold_value: number | string | null;
}

interface RealEstateAnalytics {
  salesVelocity: SalesVelocityRow[];
  inventoryAgeing: InventoryAgeingRow[];
  absorptionRate: AbsorptionRateRow[];
  unsoldUnits: UnsoldUnitsRow[];
}

interface AgeingBucketRow {
  bucket: string;
  unitCount: number;
  totalListPrice: number;
}

const AGE_BUCKET_ORDER = ['0-30', '31-60', '61-90', '91-180', '180+'];

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

/**
 * Frontend Completion, FE-2.2 â€” Real Estate is FE-2's second slice, picked
 * up from FE-2.1's own release report over PMO for the same "backend
 * exists, page doesn't, and starts simplest" reasoning that put HR ahead
 * of the rest of Stage FE-2: `DashboardController.getRealEstateAnalytics`
 * (`dashboard/real-estate-analytics`, `realestate.view`) takes `entityId`
 * with `projectId` OPTIONAL (see DashboardService.getRealEstateAnalyticsOverview's
 * own doc comment) â€” no project-selection step needed before this page has
 * anything to show, unlike `pmo-analytics`, whose `projectId` is required
 * (ReportingService.pmoProjectPerformance's EVM/Gantt data "only makes
 * sense for a single project"). PMO Dashboard remains open for a
 * checkpoint that also builds a project selector.
 *
 * Entity-scoped via `EntitySelector`, same pattern as HR/CRM/Payments.
 * `projectId` itself is NOT exposed as a filter on this first pass â€” all
 * four backing views (`vw_sales_velocity`/`vw_inventory_ageing`/
 * `vw_absorption_rate`/`vw_unsold_units_dashboard`, see their own
 * migration comments) already return one row per project, so an
 * entity-wide view naturally shows every project side by side without
 * needing a picker; per-project drill-down is a reasonable future
 * addition, not a gap in this checkpoint's own scope.
 *
 * All four endpoints return raw `$queryRaw` rows over Postgres views â€”
 * numeric columns (`total_sale_value`, `list_price`, etc.) come back as
 * either `number` or `string` depending on the pg driver's own type
 * mapping for `numeric`/`bigint`, which this page's own `num()` helper
 * normalizes rather than assuming one or the other (same defensive cast
 * every currency-rendering column here needs, not a new pattern).
 *
 * `inventoryAgeing` is one row PER UNSOLD UNIT, not per project â€” for an
 * entity with hundreds of listed units that's too many rows for a
 * dashboard table (the same "one row per employee would be too many"
 * reasoning FE-2.1's own doc comment gives for aggregating HR headcount
 * by department instead of listing every employee). Bucketed
 * client-side into `AGE_BUCKET_ORDER`'s five bands (already computed
 * server-side as `age_bucket` by the view itself â€” this page only
 * groups and sums, it doesn't recompute the bucketing logic) into unit
 * count + total list price per band instead.
 */
async function loadRealEstateDashboard(entityId: string) {
  return fetchApi<RealEstateAnalytics>(`/dashboard/real-estate-analytics?entityId=${entityId}`);
}

export default async function RealEstateDashboardPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Real Estate" subtitle="Enter an entity ID to view its real estate dashboard." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: RealEstateAnalytics | null = null;
  let error: string | null = null;
  try {
    data = await loadRealEstateDashboard(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load real estate dashboard data.';
  }

  const totalUnitsSold = data ? data.salesVelocity.reduce((sum, r) => sum + num(r.units_sold), 0) : 0;
  const totalSalesValue = data ? data.salesVelocity.reduce((sum, r) => sum + num(r.total_sale_value), 0) : 0;
  const totalUnsoldUnits = data ? data.unsoldUnits.reduce((sum, r) => sum + num(r.total_unsold_count), 0) : 0;
  const totalUnsoldValue = data ? data.unsoldUnits.reduce((sum, r) => sum + num(r.total_unsold_value), 0) : 0;

  const latestMonth = data?.absorptionRate.reduce<string | null>(
    (latest, r) => (latest === null || r.sale_month > latest ? r.sale_month : latest),
    null,
  );
  const latestMonthRows = data && latestMonth ? data.absorptionRate.filter((r) => r.sale_month === latestMonth) : [];
  const avgAbsorptionRate = latestMonthRows.length
    ? round2(latestMonthRows.reduce((sum, r) => sum + num(r.absorption_rate_percent), 0) / latestMonthRows.length)
    : null;

  const daysToSellRows = data ? data.salesVelocity.filter((r) => r.avg_days_to_sell !== null) : [];
  const avgDaysToSell = daysToSellRows.length
    ? round2(daysToSellRows.reduce((sum, r) => sum + num(r.avg_days_to_sell), 0) / daysToSellRows.length)
    : null;

  const ageingBuckets: AgeingBucketRow[] = data
    ? AGE_BUCKET_ORDER.map((bucket) => {
        const rows = data!.inventoryAgeing.filter((r) => r.age_bucket === bucket);
        return {
          bucket,
          unitCount: rows.length,
          totalListPrice: rows.reduce((sum, r) => sum + num(r.list_price), 0),
        };
      }).filter((b) => b.unitCount > 0)
    : [];

  return (
    <PageContainer>
      <PageHeader title="Real Estate" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
            <KpiCard label="Units sold (all-time)" value={String(totalUnitsSold)} caption={formatCurrency(totalSalesValue)} />
            <KpiCard label="Unsold units" value={String(totalUnsoldUnits)} tone="warning" caption={formatCurrency(totalUnsoldValue)} />
            <KpiCard
              label="Absorption rate"
              value={avgAbsorptionRate !== null ? `${avgAbsorptionRate}%` : 'â€”'}
              caption={latestMonth ? new Date(latestMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : undefined}
            />
            <KpiCard label="Avg. days to sell" value={avgDaysToSell !== null ? `${avgDaysToSell} days` : 'â€”'} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Unsold units by project" />
            <RealEstateUnsoldTable rows={data.unsoldUnits} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Inventory ageing" />
            <RealEstateAgeingTable rows={ageingBuckets} />
          </section>

          <section>
            <PageHeader title="Sales velocity by month" />
            <RealEstateSalesVelocityTable rows={data.salesVelocity} />
          </section>
        </>
      )}
    </PageContainer>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}


