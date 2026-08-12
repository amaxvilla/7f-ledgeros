import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-8.6. Next.js App Router special file, scoped
 * to `/workflow/[code]` — same per-route Suspense boundary shape
 * `/workflow/loading.tsx` already established.
 */
export default function WorkflowDefinitionLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '260px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
      <div
        style={{
          height: '200px',
          borderRadius: tokens.radius.md,
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
        }}
      />
    </main>
  );
}
