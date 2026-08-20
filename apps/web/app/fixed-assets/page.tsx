import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateFixedAssetForm } from './CreateFixedAssetForm';
import { FixedAssetsTable } from './FixedAssetsTable';

export const dynamic = 'force-dynamic';

interface FixedAssetSummary {
  byStatus: { status: string; count: number; acquisitionCost: number }[];
  categoriesCount: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
}

interface FixedAsset {
  id: string;
  assetTag: string;
  name: string;
  acquisitionDate: string;
  acquisitionCost: number;
  status: string;
  assetCategory: { name: string };
}

async function loadFixedAssets(entityId: string) {
  const [summary, assets] = await Promise.all([
    fetchApi<FixedAssetSummary>(`/dashboard/fixed-asset-overview?entityId=${entityId}`),
    fetchApi<FixedAsset[]>(`/fixed-assets?entityId=${entityId}`),
  ]);
  return { summary, assets };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  FULLY_DEPRECIATED: 'neutral',
  DISPOSED: 'negative',
};

/**
 * Frontend Completion, Checkpoint L — the sixth Module Page, picked the
 * same way CRM was in Checkpoint K (see that page's own doc comment):
 * of the domains without a page yet, Fixed Assets is the one whose
 * backend already has a purpose-built dashboard aggregate
 * (`GET /dashboard/fixed-asset-overview`, Release — Fixed Assets Core)
 * AND a ready list endpoint (`GET /fixed-assets`) — no new backend work
 * required.
 *
 * Entity-scoped like Payments/Recruitment/CRM (not system-wide like
 * Security).
 *
 * All three money fields (totalAcquisitionCost, totalAccumulatedDepreciation,
 * totalNetBookValue) and each row's acquisitionCost are already
 * major-unit numbers — FixedAsset.acquisitionCost is a Decimal(18,2)
 * column, not a minor-unit integer the way Payments' amounts are (see
 * that page's own formatMinorUnits comment) — so formatCurrency is used
 * unconverted here, the same choice CRM's page made for its own
 * major-unit Decimal fields.
 *
 * CreateFixedAssetForm added as this app's fourth data-entry form — see
 * that component's own doc comment.
 */
export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Fixed Assets" subtitle="Enter an entity ID to view its asset register." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadFixedAssets>> | null = null;
  let error: string | null = null;
  try {
    data = await loadFixedAssets(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load fixed asset data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Fixed Assets" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Net book value" value={formatCurrency(data.summary.totalNetBookValue)} tone="positive" />
            <KpiCard label="Acquisition cost" value={formatCurrency(data.summary.totalAcquisitionCost)} />
            <KpiCard label="Accumulated depreciation" value={formatCurrency(data.summary.totalAccumulatedDepreciation)} />
            <KpiCard label="Asset categories" value={String(data.summary.categoriesCount)} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Assets by status" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              {data.summary.byStatus.map((s) => (
                <Badge key={s.status} tone={STATUS_TONE[s.status] ?? 'neutral'}>
                  {s.status}: {s.count} ({formatCurrency(s.acquisitionCost)})
                </Badge>
              ))}
              {data.summary.byStatus.length === 0 && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No fixed assets yet.
                </span>
              )}
            </div>
          </section>

          <section>
            <PageHeader title="Asset register" />
            <CreateFixedAssetForm entityId={entityId} />
            <FixedAssetsTable rows={data.assets} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
