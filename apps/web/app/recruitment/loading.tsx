import { tokens } from '@7f/ui';

/**
 * Frontend Completion, Checkpoint C. Retroactive fix for a gap left by
 * Checkpoint B: see `app/payments/loading.tsx`'s own doc comment (added
 * in this same checkpoint) for why the root `app/loading.tsx` never
 * covered this route in the first place. Same skeleton shape as that
 * file and the root one — four KPI-tile placeholders, matching this
 * page's own four-KpiCard section.
 */
export default function RecruitmentLoading() {
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
