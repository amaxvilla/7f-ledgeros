import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-4.1. Scoped to `/handover/[id]` specifically
 * — a separate boundary from `/handover`'s own `loading.tsx`, same
 * per-route pattern `work-packages/[id]/loading.tsx` already
 * established (confirmed directly — `budgeting/[id]` has no equivalent
 * file, so this isn't universal across every detail route yet, just the
 * pattern this checkpoint follows).
 */
export default function HandoverRecordLoading() {
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
