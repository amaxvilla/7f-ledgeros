import { Badge, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { UpdateProviderForm } from './UpdateProviderForm';
import { RotateCredentialsForm } from './RotateCredentialsForm';

export const dynamic = 'force-dynamic';

interface IntegrationProviderDetail {
  id: string;
  entityId: string | null;
  category: string;
  providerCode: string;
  name: string;
  status: string;
  isActive: boolean;
  hasCredentials: boolean;
  config: Record<string, unknown> | null;
  retryMaxAttempts: number;
  retryBackoffMs: number;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
  lastHealthCheckError: string | null;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
  DEGRADED: 'warning',
  ERROR: 'negative',
};

/**
 * Frontend Completion, FE-7.2 — Integration Provider detail
 * (`/integrations/[id]`), FE-7.1's own named follow-up. See
 * `actions.ts`'s and `KeyValueEditor.tsx`'s own doc comments for the
 * full reasoning.
 *
 * `UpdateProviderForm` is pre-populated directly from this fetch —
 * `config` included, `encryptedCredentials` never present at all (only
 * `hasCredentials`, confirmed directly against `IntegrationsService
 * .redact`) — this page renders that boolean as a plain badge next to
 * `RotateCredentialsForm` so an admin can see whether they're setting
 * credentials for the first time before the (always-empty)
 * write-only form below it.
 *
 * NO `EntitySelector` — same structural posture `/integrations`'s own
 * list page already took (`entityId` is nullable on most rows; this is
 * an id-addressed detail page regardless of whether the provider has
 * one).
 */
export default async function IntegrationProviderPage({ params }: { params: { id: string } }) {
  const { id } = params;

  let provider: IntegrationProviderDetail | null = null;
  let error: string | null = null;
  try {
    provider = await fetchApi<IntegrationProviderDetail>(`/integrations/${id}`);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load integration provider.';
  }

  return (
    <PageContainer>
      <PageHeader
        title={provider ? provider.name : 'Integration Provider'}
        subtitle={provider ? `${provider.category} — ${provider.providerCode}` : undefined}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Integrations', href: '/integrations' }, { label: provider?.name ?? 'Provider' }]}
      />

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>}

      {provider && (
        <>
          <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center', marginBottom: tokens.space(6) }}>
            <Badge tone={STATUS_TONE[provider.status] ?? 'neutral'}>{provider.status}</Badge>
            <Badge tone={provider.hasCredentials ? 'positive' : 'neutral'}>{provider.hasCredentials ? 'Credentials configured' : 'No credentials set'}</Badge>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
              {provider.lastHealthCheckAt
                ? `Last checked ${new Date(provider.lastHealthCheckAt).toLocaleString()} (${provider.lastHealthCheckOk ? 'OK' : provider.lastHealthCheckError ?? 'failed'})`
                : 'Never checked'}
            </span>
          </div>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Settings" />
            <UpdateProviderForm
              id={provider.id}
              initialName={provider.name}
              initialIsActive={provider.isActive}
              initialRetryMaxAttempts={provider.retryMaxAttempts}
              initialRetryBackoffMs={provider.retryBackoffMs}
              initialConfig={provider.config}
            />
          </section>

          <section>
            <PageHeader title="Rotate credentials" subtitle="Existing values are never shown here — this always sets new ones." />
            <RotateCredentialsForm id={provider.id} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
