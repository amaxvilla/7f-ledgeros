import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-3.5. Next.js App Router special file, scoped
 * to `/revenue-recognition` — same per-route Suspense boundary every
 * module page since Checkpoint C has gotten.
 */
export default function RevenueRecognitionLoading() {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(4) }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: '120px',
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
