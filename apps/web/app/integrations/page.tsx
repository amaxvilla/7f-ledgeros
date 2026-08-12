import Link from 'next/link';
import { ActionForm, Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateIntegrationForm } from './CreateIntegrationForm';
import { runHealthCheck, runHealthCheckAll } from './actions';

export const dynamic = 'force-dynamic';

interface IntegrationProvider {
  id: string;
  entityId: string | null;
  category: string;
  providerCode: string;
  name: string;
  status: string;
  isActive: boolean;
  hasCredentials: boolean;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
  lastHealthCheckError: string | null;
}

interface IntegrationsOverview {
  byStatus: { status: string; count: number }[];
  activeByCategory: { category: string; count: number }[];
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
  DEGRADED: 'warning',
  ERROR: 'negative',
};

/**
 * Frontend Completion, FE-7.1 — Enterprise Integrations, opening Stage
 * FE-7. See `actions.ts`'s own doc comment for the full before-coding
 * analysis of why one connector registry covers most of this stage's
 * item list at once.
 *
 * System-wide, not entity-scoped — no `EntitySelector` gate, the same
 * structural choice `security/page.tsx` made for the identical reason
 * (`IntegrationProvider.entityId` is nullable; most rows have none).
 * Unlike Security's own aggregates, this page's list endpoint
 * (`GET /integrations`) has no `entityId` requirement either, so it's
 * shown unfiltered — a category/status filter is a reasonable future
 * addition once this list is long enough to need one, not built ahead
 * of that need here.
 *
 * `lastHealthCheckOk`/`lastHealthCheckAt` are both `null` for a
 * never-checked provider (confirmed directly: only `runHealthCheck`
 * sets them) — rendered as "Never checked" rather than a falsy-looking
 * blank or a misleading "Unhealthy", the same "reflect what the backend
 * actually returns" discipline this app's other optional-field pages
 * already follow.
 *
 * ADDENDUM (FE-7.2) — added a "Manage" column linking each row to the
 * new `/integrations/[id]` config/credentials detail page, the same
 * `Link`ed-column-in-a-`DataTable` shape `/users/page.tsx`'s own
 * "Manage" column already established. Named "Manage" for the same
 * reason as there: "Configure →" here doesn't collide with any
 * existing column the way "Roles" would have on `/users`.
 */
async function loadOverview() {
  return fetchApi<IntegrationsOverview>('/integrations/overview');
}

async function loadProviders() {
  return fetchApi<IntegrationProvider[]>('/integrations');
}

export default async function IntegrationsPage() {
  let overview: IntegrationsOverview | null = null;
  let overviewError: string | null = null;
  try {
    overview = await loadOverview();
  } catch (e) {
    overviewError = e instanceof ApiError ? e.message : 'Failed to load integrations overview.';
  }

  let providers: IntegrationProvider[] = [];
  let providersError: string | null = null;
  try {
    providers = await loadProviders();
  } catch (e) {
    providersError = e instanceof ApiError ? e.message : 'Failed to load integrations.';
  }

  const active = overview?.byStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0;
  const degraded = overview?.byStatus.find((s) => s.status === 'DEGRADED')?.count ?? 0;
  const errored = overview?.byStatus.find((s) => s.status === 'ERROR')?.count ?? 0;
  const inactive = overview?.byStatus.find((s) => s.status === 'INACTIVE')?.count ?? 0;

  return (
    <PageContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader title="Integrations" subtitle="Connected third-party providers and their health." />
        <ActionForm action={runHealthCheckAll}>
          <button
            type="submit"
            style={{
              color: tokens.color.textPrimary,
              fontFamily: tokens.font.body,
              fontSize: '13px',
              background: 'none',
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.sm,
              padding: `${tokens.space(2)} ${tokens.space(3)}`,
              cursor: 'pointer',
            }}
          >
            Check all now
          </button>
        </ActionForm>
      </div>

      {overviewError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{overviewError}</div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
        <KpiCard label="Active" value={String(active)} tone="positive" />
        <KpiCard label="Degraded" value={String(degraded)} tone={degraded > 0 ? 'warning' : 'neutral'} />
        <KpiCard label="Error" value={String(errored)} tone={errored > 0 ? 'negative' : 'neutral'} />
        <KpiCard label="Inactive" value={String(inactive)} />
      </section>

      <CreateIntegrationForm />

      {providersError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{providersError}</div>
      )}

      <DataTable
        columns={[
          { header: 'Category', render: (p: IntegrationProvider) => p.category },
          { header: 'Provider', render: (p: IntegrationProvider) => `${p.providerCode} — ${p.name}` },
          { header: 'Status', render: (p: IntegrationProvider) => <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Badge> },
          { header: 'Credentials', render: (p: IntegrationProvider) => (p.hasCredentials ? <Badge tone="positive">Configured</Badge> : <Badge tone="neutral">None</Badge>) },
          {
            header: 'Last checked',
            render: (p: IntegrationProvider) =>
              p.lastHealthCheckAt ? `${new Date(p.lastHealthCheckAt).toLocaleString()} (${p.lastHealthCheckOk ? 'OK' : p.lastHealthCheckError ?? 'failed'})` : 'Never checked',
          },
          {
            header: '',
            render: (p: IntegrationProvider) => (
              <ActionForm action={runHealthCheck.bind(null, p.id)}>
                <button type="submit" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Run health check
                </button>
              </ActionForm>
            ),
          },
          {
            header: 'Manage',
            render: (p: IntegrationProvider) => (
              <Link href={`/integrations/${p.id}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
                Configure →
              </Link>
            ),
          },
        ]}
        rows={providers}
        keyOf={(p) => p.id}
        emptyMessage="No integrations configured yet."
      />
    </PageContainer>
  );
}
