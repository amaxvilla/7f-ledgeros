import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-6. Next.js App Router special file, scoped to
 * `/roles/[id]` — same per-route Suspense boundary shape every module
 * detail page in this app already establishes.
 */
export default function RoleDetailLoading() {
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
