import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-10.3 — UX Polish: Loading States. One of four
 * routes found genuinely missing a `loading.tsx` (`/budgeting/[id]`,
 * `/ap-ar`, `/real-estate/customers/[customerId]/statement`,
 * `/entities/[id]`) out of 65 `page.tsx` routes total — confirmed by a
 * direct file-count comparison across the whole `app/` tree, not
 * assumed; the other 59 (plus `/login` and `/admin-tools`, both
 * correctly exempt since neither fetches data server-side — see
 * `/admin-tools/page.tsx`'s own doc comment for that exact reasoning)
 * already had one. Mirrors `/payments/loading.tsx`'s own 4-KPI-tile
 * shape exactly — `budgeting/[id]/page.tsx` has exactly 4 `KpiCard`s
 * (confirmed by direct count, not assumed), the same tile count.
 */
export default function BudgetDetailLoading() {
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
