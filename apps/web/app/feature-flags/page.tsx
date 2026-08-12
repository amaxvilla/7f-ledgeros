import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateFeatureFlagForm } from './CreateFeatureFlagForm';
import { FeatureFlagRow } from './FeatureFlagRow';

export const dynamic = 'force-dynamic';

interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPercent: number | null;
}

/**
 * Frontend Completion, FE-8.1 — Feature Flags, first checkpoint of
 * Stage FE-8 (Administration). See `actions.ts`'s own doc comment for
 * the full before-coding analysis of this module's small, single-
 * upsert-endpoint surface.
 *
 * System-wide — no `EntitySelector` gate, same structural posture
 * `/security`, `/integrations`, and `/roles` all already established
 * for genuinely global configuration (`FeatureFlag` has no `entityId`
 * column at all).
 *
 * `GET /feature-flags` itself seeds every known default flag on each
 * call (confirmed directly against the controller's own `upsert` loop)
 * — so this list is never empty once `DEFAULT_FEATURE_FLAGS` has at
 * least one entry, unlike every other list page's own genuine
 * `emptyMessage` case.
 */
export default async function FeatureFlagsPage() {
  let flags: FeatureFlag[] | null = null;
  let error: string | null = null;
  try {
    flags = await fetchApi<FeatureFlag[]>('/feature-flags');
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load feature flags.';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Feature Flags"
        subtitle="System-wide toggles — not scoped to an entity."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Feature Flags' }]}
      />

      {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>}

      <CreateFeatureFlagForm />

      {flags && (
        <DataTable
          columns={[
            { header: 'Key', render: (f: FeatureFlag) => f.key },
            { header: 'Status', render: (f: FeatureFlag) => <Badge tone={f.enabled ? 'positive' : 'neutral'}>{f.enabled ? 'Enabled' : 'Disabled'}</Badge> },
            { header: 'Rollout', align: 'right', render: (f: FeatureFlag) => (f.rolloutPercent === null ? '—' : `${f.rolloutPercent}%`) },
            {
              header: 'Edit',
              align: 'right',
              render: (f: FeatureFlag) => (
                <FeatureFlagRow flagKey={f.key} initialEnabled={f.enabled} initialDescription={f.description} initialRolloutPercent={f.rolloutPercent} />
              ),
            },
          ]}
          rows={flags}
          keyOf={(f) => f.key}
          emptyMessage="No feature flags configured yet."
        />
      )}
    </PageContainer>
  );
}
