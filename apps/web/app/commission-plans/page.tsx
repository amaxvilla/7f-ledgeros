import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateCommissionPlanForm } from './CreateCommissionPlanForm';
import { DeactivatePlanControl } from './DeactivatePlanControl';
import { CommissionPlansTable } from './CommissionPlansTables';

export const dynamic = 'force-dynamic';

interface CommissionPlan {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  scope: 'GLOBAL' | 'PROJECT' | 'ESTATE' | 'UNIT' | 'AGENT';
  status: 'ACTIVE' | 'INACTIVE';
  rate: string | number | null;
  fixedAmount: string | number | null;
  isReferral: boolean;
  isTiered: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  projectId: string | null;
  estateId: string | null;
  unitId: string | null;
  agentId: string | null;
}

const STATUS_TONE: Record<CommissionPlan['status'], 'neutral' | 'positive' | 'warning' | 'negative'> = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const SCOPE_FILTER_OPTIONS = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'ESTATE', label: 'Estate' },
  { value: 'UNIT', label: 'Unit' },
  { value: 'AGENT', label: 'Agent' },
];

function scopeTarget(plan: CommissionPlan): string {
  if (plan.scope === 'GLOBAL') return '—';
  return plan.projectId || plan.estateId || plan.unitId || plan.agentId || '—';
}

function rateDisplay(plan: CommissionPlan): string {
  if (plan.isTiered) return 'Tiered';
  if (plan.type === 'PERCENTAGE') return plan.rate != null ? `${plan.rate}%` : '—';
  return plan.fixedAmount != null ? String(plan.fixedAmount) : '—';
}

/**
 * Agent & Commission Management, RE-COMM.1 (frontend) — Commission
 * Plans directory. Same entity-scoped `EntitySelector` +
 * client-side-filtered `DataTable` pattern `/agents` already
 * established. Tiered plans display as "Tiered" in the rate column
 * with no drill-down into their bands from this checkpoint's own
 * scope — see `CreateCommissionPlanForm`'s own doc comment for why a
 * tier editor/viewer is deferred.
 */
async function loadPlans(entityId: string) {
  return fetchApi<CommissionPlan[]>(`/commission-plans?entityId=${encodeURIComponent(entityId)}`);
}

export default async function CommissionPlansPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let plans: CommissionPlan[] | null = null;
  let error: string | null = null;
  if (entityId) {
    try {
      plans = await loadPlans(entityId);
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to load commission plans.';
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Commission Plans"
        subtitle="Configurable commission structures — percentage or fixed, global or scoped to a project/estate/unit/agent, flat or tiered, including referral plans."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Commission Plans' }]}
      />

      <EntitySelector initialValue={entityId} />

      {!entityId && (
        <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
          Select an entity above to view or create commission plans.
        </div>
      )}

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>}

      {plans && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total plans" value={String(plans.length)} />
            <KpiCard label="Active" value={String(plans.filter((p) => p.status === 'ACTIVE').length)} />
            <KpiCard label="Referral plans" value={String(plans.filter((p) => p.isReferral).length)} />
            <KpiCard label="Tiered plans" value={String(plans.filter((p) => p.isTiered).length)} />
          </section>

          <CreateCommissionPlanForm entityId={entityId!} />

          <CommissionPlansTable rows={plans} />
        </>
      )}
    </PageContainer>
  );
}
