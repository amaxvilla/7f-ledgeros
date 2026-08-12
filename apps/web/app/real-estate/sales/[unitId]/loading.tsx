import { tokens } from '@7f/ui';

/**
 * Frontend Completion — same themed-skeleton shape as
 * `/land-bank/estates/[estateId]/loading.tsx` and every other module
 * page's own loading.tsx.
 */
export default function UnitDetailLoading() {
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
      <div
        style={{
          height: '140px',
          borderRadius: tokens.radius.md,
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          marginBottom: tokens.space(6),
        }}
      />
      <div
        style={{
          height: '240px',
          borderRadius: tokens.radius.md,
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
        }}
      />
    </main>
  );
}
