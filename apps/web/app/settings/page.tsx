import { PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';

interface UserPreference {
  id: string;
  userId: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM' | null;
  language: string | null;
  timezone: string | null;
}

/**
 * FE-1.8 — Settings, the last of FE-1's four originally-named gaps
 * (Sidebar closed by FE-1.5, Theme by FE-1.6, Search by FE-1.7). Four
 * prior checkpoints (FE-1.2 through FE-1.7, each read directly before
 * this one) deferred Settings for the same stated reason: "no obvious
 * backend surface identified." Re-checked directly rather than deferred
 * a fifth time — `admin-branding.controller.ts`'s `me/preferences`
 * pair (`GET`/`PUT`, backed by the already-migrated `UserPreference`
 * model) is exactly that surface: it existed the whole time, just never
 * consumed by any page (confirmed by grepping the entire frontend for
 * `me/preferences` before writing this — zero hits before this
 * checkpoint).
 *
 * A real, pre-existing bug was found and fixed on the way: both
 * `me/preferences` endpoints required an ADMIN permission
 * (`admin.branding.view`) despite acting only on the calling user's own
 * account — see `admin-branding.controller.ts`'s own doc comment on the
 * fix. Without that fix, this page would 403 for most seeded roles.
 *
 * `GET /admin/me/preferences` returns `null` (not a 404) when the user
 * has never set a preference — a real, valid "using defaults" state
 * (confirmed directly from `AdminBrandingService.getUserPreference`
 * and its own `@ApiOperation` description), so `null` is treated as
 * SYSTEM/blank/blank defaults here rather than as a fetch error.
 *
 * No `EntitySelector` — `UserPreference` is scoped to the calling user
 * (resolved from the JWT), not an entity, the same shape `/my-security`
 * already established as this app's precedent for user-scoped (as
 * opposed to entity-scoped) self-service pages.
 */
export default async function SettingsPage() {
  let preference: UserPreference | null = null;
  let error: string | null = null;

  try {
    preference = await fetchApi<UserPreference | null>('/admin/me/preferences');
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load your settings.';
  }

  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Your personal theme, language, and timezone preferences." />
      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{error}</div>
      )}
      {!error && (
        <SettingsForm
          initialTheme={preference?.theme ?? 'SYSTEM'}
          initialLanguage={preference?.language ?? ''}
          initialTimezone={preference?.timezone ?? ''}
        />
      )}
    </PageContainer>
  );
}
