import { tokens } from '@7f/ui';

/**
 * FE-1.8 — Settings. Next.js App Router special file, scoped to
 * `/settings` — same per-route Suspense boundary every module page
 * since Checkpoint C has gotten (mirrors `/my-security/loading.tsx`,
 * this app's closest precedent for a single-form self-service page).
 */
export default function SettingsLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '160px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
      <div style={{ height: '100px', borderRadius: tokens.radius.md, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }} />
    </main>
  );
}
