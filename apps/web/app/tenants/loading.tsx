import { tokens } from '@7f/ui';

/**
 * Frontend Completion, Checkpoint P. Next.js App Router special file,
 * scoped to `/tenants` — same per-route Suspense boundary every module
 * page since Checkpoint C has gotten.
 *
 * Title-bar skeleton only, no KPI-grid placeholder — unlike every other
 * module page's loading.tsx (which all render a 4-tile KPI grid
 * skeleton), this page genuinely has no KPI section (see page.tsx's own
 * doc comment for why), so a KPI skeleton here would promise content
 * that never arrives.
 */
export default function TenantsLoading() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          height: '32px',
          width: '200px',
          borderRadius: tokens.radius.sm,
          background: tokens.color.surfaceRaised,
          marginBottom: tokens.space(8),
        }}
      />
    </main>
  );
}
