import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-4.7. Next.js App Router special file, scoped
 * to `/land-bank/estates/[estateId]` — same per-route Suspense boundary
 * shape `/land-bank/[parcelId]/loading.tsx` already established. Three
 * KPI-card placeholders, matching this route's own three `KpiCard`s.
 */
export default function EstateDetailLoading() {
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: tokens.space(4) }}>
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
