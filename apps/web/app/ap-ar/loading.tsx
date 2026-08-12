import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-10.3 — UX Polish: Loading States. See
 * `/budgeting/[id]/loading.tsx`'s own doc comment for the full
 * before-coding finding (4 of 65 routes genuinely missing this file).
 * `ap-ar/page.tsx` has exactly 3 `KpiCard`s (confirmed by direct
 * count), so this mirrors `/payments/loading.tsx`'s own shape with 3
 * tiles instead of 4.
 */
export default function ApArLoading() {
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
        {Array.from({ length: 3 }).map((_, i) => (
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
