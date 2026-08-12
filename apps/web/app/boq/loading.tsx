import { tokens } from '@7f/ui';

/**
 * Frontend Completion, PMO.1 — same themed-skeleton shape as every
 * other module page's loading.tsx (see payments/loading.tsx's own doc
 * comment for why this exists as a route-segment-scoped file rather
 * than relying on the root app/loading.tsx). Four KPI-card placeholders
 * here, matching this page's own four `KpiCard`s (Total/In progress/
 * Certified/Total value), not the three `project-risks/loading.tsx`
 * uses for its own three-card summary.
 */
export default function BoqLoading() {
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
