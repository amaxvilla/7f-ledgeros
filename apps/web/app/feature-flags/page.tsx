import { PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateFeatureFlagForm } from './CreateFeatureFlagForm';
import { FeatureFlagRow } from './FeatureFlagRow';
import { FeatureFlagsTable } from './FeatureFlagsTable';

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
        <FeatureFlagsTable rows={flags} />
      )}
    </PageContainer>
  );
}
