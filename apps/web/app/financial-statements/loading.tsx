import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-9.2. Next.js App Router special file, scoped
 * to `/financial-statements` — same per-route Suspense boundary every
 * module page already has (see payments/loading.tsx's own doc comment).
 */
export default function FinancialStatementsLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '260px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.space(4) }}>
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
