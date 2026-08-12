import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-9.1. Next.js App Router special file, scoped
 * to `/power-bi` — same per-route Suspense boundary every module page
 * already has (see payments/loading.tsx's own doc comment).
 */
export default function PowerBiLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '200px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
      <div
        style={{
          height: '180px',
          borderRadius: tokens.radius.md,
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
        }}
      />
    </main>
  );
}
