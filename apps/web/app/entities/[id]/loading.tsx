import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-10.3 — UX Polish: Loading States. See
 * `/budgeting/[id]/loading.tsx`'s own doc comment for the full
 * before-coding finding. `entities/[id]/page.tsx` has ZERO `KpiCard`s
 * (confirmed by direct count) — its own content is a hierarchy
 * breadcrumb, an edit form, and a subsidiaries table, not a KPI row —
 * so this mirrors `/roles/[id]/loading.tsx`'s own no-KPI shape (a
 * title bar plus a few narrower content-line placeholders) rather than
 * `/payments/loading.tsx`'s own KPI-tile grid, which would misrepresent
 * this page's actual layout.
 */
export default function EntityDetailLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '260px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(6),
        }}
      />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '20px',
            width: '80%',
            borderRadius: tokens.radius.sm,
            background: tokens.color.surface,
            border: `1px solid ${tokens.color.border}`,
            marginBottom: tokens.space(2),
          }}
        />
      ))}
    </main>
  );
}
