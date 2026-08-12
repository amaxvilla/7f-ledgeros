import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-2.3. Next.js App Router special file, scoped
 * to `/executive` — same per-route Suspense boundary every module page
 * since Checkpoint C has gotten (see payments/loading.tsx's own doc
 * comment for why the root app/loading.tsx doesn't cover this on its
 * own).
 */
export default function ExecutiveLoading() {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4) }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '84px',
              borderRadius: tokens.radius.md,
              background: tokens.color.surface,
              border: `1px solid ${tokens.color.border}`,
            }}
          />
        ))}
      </div>
    </main>
  );
}
