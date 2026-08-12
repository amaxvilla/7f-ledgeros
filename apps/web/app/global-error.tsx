'use client';

import { tokens } from '@7f/ui';

/**
 * Frontend Completion, FE-10.4 — UX Polish: Error Pages.
 *
 * Before writing anything, checked what already existed rather than
 * assuming the roadmap item's own name implied a large gap (the same
 * discipline FE-10.2/FE-10.3 both applied to Empty States/Loading
 * States): `app/error.tsx` (Checkpoint A) and `app/not-found.tsx`
 * (Checkpoint A) both already exist and both already replace Next's own
 * unstyled defaults. Also confirmed `notFound()` (the Next.js function
 * that would trigger `not-found.tsx` for a valid route with missing
 * data) is used NOWHERE in this app — every page that can 404 on bad
 * data does so with its own inline "not found" message instead
 * (`entities/[id]/page.tsx`'s own `if (error || !entity)` branch is one
 * of many identical examples) — a real, consistent, deliberate
 * architectural choice already made everywhere in this app, not a gap
 * to retrofit.
 *
 * THE ONE REAL GAP FOUND: `app/error.tsx`'s own React error boundary
 * cascades to catch a thrown error from ANY nested route segment below
 * it — but by Next.js's own documented App Router behavior, it can
 * NOT catch an error thrown in the ROOT LAYOUT itself
 * (`app/layout.tsx`). Only `global-error.tsx` (this file) can — it
 * replaces the entire root layout, `<html>`/`<body>` included, which is
 * why (per Next's own requirement) it renders its own complete document
 * shell rather than relying on `RootLayout`'s. `layout.tsx` now does
 * real work that could throw (`cookies().get('accessToken')`, passing
 * `isLoggedIn`/`onLogout` into `AppShell`) — before this checkpoint, an
 * error there had no themed boundary at all and fell straight through
 * to Next's own raw default screen, the exact same category of problem
 * `error.tsx` was originally added to solve for `page.tsx`-level
 * errors, just one level higher.
 *
 * Deliberately mirrors `error.tsx`'s own visual treatment as closely as
 * a full-document file can (same heading/message/button layout and
 * token usage) — a person hitting this boundary shouldn't be able to
 * tell it's a structurally different file from the one they'd see for
 * a page-level error.
 *
 * No second item bundled into this checkpoint — actively checked for
 * one (whether any specific route's own error-proneness would justify
 * a route-scoped `error.tsx` more specific than the root one) and found
 * none: page-level fetch failures are already universally handled
 * inline, and no route has been identified as needing more than the
 * root boundary already provides. Named plainly rather than padded.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
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
            {error.message || 'An unexpected error occurred while loading the application shell.'}
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
      </body>
    </html>
  );
}
