import { tokens } from '@7f/ui';

/**
 * Frontend Completion, Checkpoint C. Next.js App Router special file —
 * scoped to the `/payments` route segment specifically.
 *
 * loading.tsx does NOT cascade from a parent segment to a child one the
 * way error.tsx's error boundary bubbling does — the existing root
 * `app/loading.tsx` (Checkpoint A) only ever wrapped `app/page.tsx`
 * itself, never `/recruitment` or this route, both of which rendered
 * with no themed loading state at all (a plain blank pause) until their
 * own Promise.all resolved. This file adds that boundary for
 * `/payments`; see `app/recruitment/loading.tsx` (added in this same
 * checkpoint) for the identical fix applied retroactively to
 * Checkpoint B's own page.
 */
export default function PaymentsLoading() {
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
