import { tokens } from '@7f/ui';

/**
 * Frontend Completion, Checkpoint AR. Next.js App Router special file —
 * scoped to the `/api-gateway` route segment, same reasoning every
 * other page's own `loading.tsx` gives (most recently `payments/loading.tsx`'s
 * own doc comment) for why this doesn't cascade from the root
 * `app/loading.tsx` on its own.
 */
export default function ApiGatewayLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '160px',
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
