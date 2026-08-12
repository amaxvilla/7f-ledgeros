import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateLeadForm } from './CreateLeadForm';

export const dynamic = 'force-dynamic';

interface CrmAnalytics {
  totalLeads: number;
  leadsByStatus: Record<string, number>;
  leadsBySource: Record<string, number>;
  leadConversionRate: number | null;
  totalProspects: number;
  activePipelineValue: number;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  createdAt: string;
}

/**
 * ADDENDUM — Handover.1's own recommendation, applied here:
 * `GET /dashboard/crm-pipeline` (`DashboardService.getCrmPipelineOverview`
 * -> `CrmService.getCrmPipelineSummary`, `crm.view`) had no frontend
 * consumer. Read directly alongside `ReportingService.crmPipeline`
 * (this page's own already-consumed `crm-analytics`) before wiring
 * anything in, per the backend's own comment on a neighboring method
 * (`fixedAssetRegister`) confirming the pattern: these are deliberately
 * two DIFFERENT aggregation styles for the same domain — `crmPipeline`
 * is the heavier, `vw_crm_pipeline`-view-backed reporting query this
 * page already renders in full (`leadsByStatus`/`leadsBySource`/
 * `prospectsByStatus`/`activePipelineValue`/`leadConversionRate`, the
 * last computed over CLOSED leads only — confirmed directly), while
 * `getCrmPipelineSummary` is the lighter Dashboard-widget version,
 * confirmed to compute its OWN `leadConversionRate` differently (over
 * ALL leads, not just closed ones — a real, non-typo'd difference, not
 * duplicated here to avoid two disagreeing "conversion rate" numbers on
 * one page).
 *
 * Comparing both response shapes field-by-field found exactly two
 * pieces of real, non-redundant information `getCrmPipelineSummary`
 * has that `crmPipeline` doesn't: `wonThisMonth`/`lostThisMonth`
 * (time-boxed to the current calendar month, confirmed directly against
 * `startOfMonth()`) — `crmPipeline` has no month-scoped fields at all.
 * `leadsBySource`/`leadsByStatus`/`prospectsByStatus` from this endpoint
 * are deliberately NOT re-typed or re-rendered here — this page already
 * shows those breakdowns from `crm-analytics`, and duplicating them from
 * a second endpoint with a different underlying query would risk two
 * silently-disagreeing numbers for what looks like the same metric.
 * Only the two genuinely new fields are typed below.
 */
interface CrmPipelineSummary {
  wonThisMonth: number;
  lostThisMonth: number;
}

async function loadCrm(entityId: string) {
  const [analytics, leads, pipelineSummary] = await Promise.all([
    fetchApi<CrmAnalytics>(`/dashboard/crm-analytics?entityId=${entityId}`),
    fetchApi<Lead[]>(`/crm/leads?entityId=${entityId}`),
    fetchApi<CrmPipelineSummary>(`/dashboard/crm-pipeline?entityId=${entityId}`),
  ]);
  return { analytics, leads, pipelineSummary };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  CONVERTED: 'positive',
  DISQUALIFIED: 'negative',
  NEW: 'neutral',
  CONTACTED: 'warning',
  QUALIFIED: 'warning',
};

/**
 * Frontend Completion, Checkpoint K — the fifth Module Page (after the
 * finance dashboard, Recruitment, Payments, and Security), and the fifth
 * link in AppShell's own nav. Picked the same way Payments was in
 * Checkpoint C (see that page's own doc comment for the fuller
 * rationale): of the domains without a page yet, CRM is the one whose
 * backend already has a purpose-built dashboard aggregate
 * (`GET /dashboard/crm-analytics`, Release — CRM Reporting Integration)
 * AND a ready list endpoint (`GET /crm/leads`, much earlier CRM Lead
 * Management work) — no new backend work required.
 *
 * Entity-scoped like Payments/Recruitment (not system-wide like
 * Security) — same EntitySelector + "enter an entity ID" empty state.
 *
 * leadConversionRate can be `null` (see ReportingService.crmPipeline's
 * own doc comment: no meaningful rate exists until at least one lead has
 * closed, CONVERTED or DISQUALIFIED) — rendered as an em dash rather
 * than "0%" or "NaN%", the same "reflect what the backend actually
 * returns" discipline Security's page took with its own optional
 * fields.
 *
 * activePipelineValue is already a major-unit number (unlike Payments'
 * minor-unit kobo/cents amounts — see that page's own formatMinorUnits
 * comment) — ReportingService.crmPipeline sums Prospect.budgetMax
 * directly, which this schema stores as a Decimal major-unit column, so
 * formatCurrency is used unconverted here.
 *
 * CreateLeadForm added as this app's second data-entry form, right
 * after CreateTenantForm (Checkpoint Q) — see that component's own doc
 * comment for the form-building conventions both follow. Placed inside
 * the "Leads" section directly above the table, the same "form sits
 * immediately above the list it feeds" placement CreateTenantForm
 * established, rather than above the KPI/pipeline-breakdown sections
 * this page has that tenants' page doesn't.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="CRM" subtitle="Enter an entity ID to view its lead pipeline." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadCrm>> | null = null;
  let error: string | null = null;
  try {
    data = await loadCrm(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load CRM data.';
  }

  return (
    <PageContainer>
      <PageHeader title="CRM" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Total leads" value={String(data.analytics.totalLeads)} />
            <KpiCard
              label="Conversion rate"
              value={data.analytics.leadConversionRate !== null ? `${Math.round(data.analytics.leadConversionRate * 100)}%` : '—'}
              tone={data.analytics.leadConversionRate !== null && data.analytics.leadConversionRate >= 0.3 ? 'positive' : 'neutral'}
            />
            <KpiCard label="Active prospects" value={String(data.analytics.totalProspects)} />
            <KpiCard label="Active pipeline value" value={formatCurrency(data.analytics.activePipelineValue)} tone="positive" />
            <KpiCard label="Won this month" value={String(data.pipelineSummary.wonThisMonth)} tone="positive" />
            <KpiCard
              label="Lost this month"
              value={String(data.pipelineSummary.lostThisMonth)}
              tone={data.pipelineSummary.lostThisMonth > 0 ? 'negative' : 'neutral'}
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Leads by status" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              {Object.entries(data.analytics.leadsByStatus).map(([status, count]) => (
                <Badge key={status} tone={STATUS_TONE[status] ?? 'neutral'}>
                  {status}: {count}
                </Badge>
              ))}
              {Object.keys(data.analytics.leadsByStatus).length === 0 && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No leads yet.
                </span>
              )}
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Leads by source" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              {Object.entries(data.analytics.leadsBySource).map(([source, count]) => (
                <Badge key={source} tone="neutral">
                  {source}: {count}
                </Badge>
              ))}
              {Object.keys(data.analytics.leadsBySource).length === 0 && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No leads yet.
                </span>
              )}
            </div>
          </section>

          <section>
            <PageHeader title="Leads" />
            <CreateLeadForm entityId={entityId} />
            <DataTable
              columns={[
                { header: 'Name', render: (r: Lead) => `${r.firstName} ${r.lastName}` },
                { header: 'Email', render: (r: Lead) => r.email ?? '—' },
                { header: 'Source', render: (r: Lead) => <Badge tone="neutral">{r.source}</Badge> },
                { header: 'Status', render: (r: Lead) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
              ]}
              rows={data.leads}
              keyOf={(r) => r.id}
              emptyMessage="No leads for this entity yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
