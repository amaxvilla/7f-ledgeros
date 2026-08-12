'use client';

import { tokens } from '@7f/ui';

/**
 * Frontend Completion, Checkpoint A. Next.js App Router special file —
 * a Client Component by Next.js's own requirement (it receives an
 * error + a reset() callback from the framework's error boundary).
 *
 * NOTE: page.tsx's own loadDashboard() call is already wrapped in a
 * try/catch that renders its own inline error banner for a failed
 * fetchApi call (see DashboardPage's own `error` state) — this file is
 * NOT that path and won't fire for it. This is the framework-level
 * fallback for anything ELSE that throws during render (a bug in a
 * component, an error thrown by a Client Component like EntitySelector,
 * etc.) — before this checkpoint, that fell through to Next.js's own
 * default unstyled error screen, breaking out of this codebase's dark
 * theme entirely.
 *
 * Addendum, FE-10.4: this file's own React error boundary cascades to
 * every nested route segment below it, but by Next.js's own design it
 * cannot catch an error thrown in the root layout itself
 * (`app/layout.tsx`) — `global-error.tsx` (added in that checkpoint)
 * is the only boundary that can, since it has to replace the entire
 * root layout (`<html>`/`<body>` included) to do so.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h1
        style={{
          fontFamily: tokens.font.display,
          fontSize: '22px',
          color: tokens.color.textPrimary,
          borderLeft: `3px solid ${tokens.color.negative}`,
          paddingLeft: tokens.space(3),
          textAlign: 'left',
        }}
      >
        Something went wrong
      </h1>
      <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, textAlign: 'left' }}>
        {error.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: tokens.space(4),
          padding: `${tokens.space(2)} ${tokens.space(5)}`,
          borderRadius: tokens.radius.sm,
          border: `1px solid ${tokens.color.accent}`,
          background: 'transparent',
          color: tokens.color.accent,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </main>
  );
}
