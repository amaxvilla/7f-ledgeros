import { Badge, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { DeactivatePlanControl } from '../DeactivatePlanControl';

export const dynamic = 'force-dynamic';

interface CommissionPlanTier {
  id: string;
  tierOrder: number;
  minAmount: string | number;
  maxAmount: string | number | null;
  rate: string | number | null;
  fixedAmount: string | number | null;
}

interface CommissionPlanDetail {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  scope: 'GLOBAL' | 'PROJECT' | 'ESTATE' | 'UNIT' | 'AGENT';
  status: 'ACTIVE' | 'INACTIVE';
  entityId: string;
  projectId: string | null;
  estateId: string | null;
  unitId: string | null;
  agentId: string | null;
  rate: string | number | null;
  fixedAmount: string | number | null;
  isReferral: boolean;
  isTiered: boolean;
  tiers: CommissionPlanTier[];
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  deactivateReason: string | null;
}

const STATUS_TONE: Record<CommissionPlanDetail['status'], 'neutral' | 'positive' | 'warning' | 'negative'> = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
};

/**
 * Agent & Commission Management, RE-COMM.1 (frontend) —
 * `/commission-plans/[id]`, view-only detail (no edit form in this
 * checkpoint's own scope — `CreateCommissionPlanForm`'s own doc comment
 * already defers the more complex tiered-editor case, and a flat-plan
 * edit form is a small, separable follow-on rather than bundled here).
 * Shows the full tier schedule for a tiered plan, since the register's
 * own row only ever renders "Tiered" with no drill-down.
 */
export default async function CommissionPlanDetailPage({ params }: { params: { id: string } }) {
  let plan: CommissionPlanDetail | null = null;
  let error: string | null = null;
  try {
    plan = await fetchApi<CommissionPlanDetail>(`/commission-plans/${params.id}`);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load commission plan.';
  }

  if (error || !plan) {
    return (
      <PageContainer>
        <PageHeader title="Commission plan" breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Commission Plans', href: '/commission-plans' }]} />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Commission plan not found.'}</div>
      </PageContainer>
    );
  }

  const target = plan.projectId || plan.estateId || plan.unitId || plan.agentId;

  return (
    <PageContainer>
      <PageHeader
        title={`${plan.code} — ${plan.name}`}
        subtitle={`${plan.type === 'PERCENTAGE' ? 'Percentage' : 'Fixed amount'} · ${plan.scope}${target ? ` (${target})` : ''}${plan.isReferral ? ' · Referral' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Commission Plans', href: '/commission-plans' }, { label: plan.code }]}
      />

      <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center', marginBottom: tokens.space(6), flexWrap: 'wrap' }}>
        <Badge tone={STATUS_TONE[plan.status]}>{plan.status}</Badge>
        {plan.status === 'INACTIVE' && plan.deactivateReason && (
          <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Reason: {plan.deactivateReason}</span>
        )}
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, marginLeft: 'auto' }}>
          Effective {new Date(plan.effectiveFrom).toLocaleDateString()}
          {plan.effectiveTo ? ` – ${new Date(plan.effectiveTo).toLocaleDateString()}` : ' – open-ended'}
        </span>
      </div>

      <section style={{ marginBottom: tokens.space(8) }}>
        <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Lifecycle</h2>
        <DeactivatePlanControl planId={plan.id} status={plan.status} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Rate</h2>
        {!plan.isTiered ? (
          <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textPrimary }}>
            {plan.type === 'PERCENTAGE' ? `${plan.rate}%` : plan.fixedAmount}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: tokens.font.body, fontSize: '13px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${tokens.color.border}` }}>
                <th style={{ padding: tokens.space(2) }}>Tier</th>
                <th style={{ padding: tokens.space(2) }}>From</th>
                <th style={{ padding: tokens.space(2) }}>To</th>
                <th style={{ padding: tokens.space(2) }}>{plan.type === 'PERCENTAGE' ? 'Rate' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {plan.tiers.map((tier) => (
                <tr key={tier.id} style={{ borderBottom: `1px solid ${tokens.color.border}` }}>
                  <td style={{ padding: tokens.space(2) }}>{tier.tierOrder}</td>
                  <td style={{ padding: tokens.space(2) }}>{tier.minAmount}</td>
                  <td style={{ padding: tokens.space(2) }}>{tier.maxAmount ?? '∞'}</td>
                  <td style={{ padding: tokens.space(2) }}>{plan.type === 'PERCENTAGE' ? `${tier.rate}%` : tier.fixedAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {plan.notes && (
        <section>
          <h2 style={{ fontFamily: tokens.font.body, fontSize: '15px', color: tokens.color.textPrimary, marginBottom: tokens.space(3) }}>Notes</h2>
          <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textPrimary }}>{plan.notes}</div>
        </section>
      )}
    </PageContainer>
  );
}
