import { tokens } from '@7f/ui';

/**
 * Frontend Completion, PMO.3 — same themed-skeleton shape as
 * `app/work-packages/loading.tsx`. Four KPI-card placeholders, matching
 * this route's own four `KpiCard`s (Work package budget/Progress
 * valuations/Latest % complete/Latest valuation amount).
 */
export default function WorkPackageDetailLoading() {
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
