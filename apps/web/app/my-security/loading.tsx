import { tokens } from '@7f/ui';

/**
 * Frontend Completion. Next.js App Router special file, scoped to
 * `/my-security` — same per-route Suspense boundary every module page
 * since Checkpoint C has gotten.
 */
export default function MySecurityLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '220px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
      <div style={{ height: '160px', borderRadius: tokens.radius.md, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }} />
    </main>
  );
}
