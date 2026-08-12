import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-8.6 — same themed-skeleton shape as every
 * other module page's loading.tsx.
 */
export default function WorkflowLoading() {
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
