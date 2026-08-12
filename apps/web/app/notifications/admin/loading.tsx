import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-8.8. Next.js App Router special file, same
 * per-route Suspense boundary shape every other route's own
 * `loading.tsx` already established.
 */
export default function NotificationsDeliveryStatsLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '300px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
      <div
        style={{
          height: '120px',
          borderRadius: tokens.radius.md,
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
        }}
      />
    </main>
  );
}
