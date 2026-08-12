'use client';

import * as React from 'react';
import { tokens } from '../tokens';

const STORAGE_KEY = 'ledgeros-theme';
type Theme = 'dark' | 'light';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * FE-1.6 — Theme (light/dark toggle). The one remaining FE-1 item
 * `AppShell.tsx`'s own doc comment named as deliberately deferred
 * across every prior FE-1/FE-2 checkpoint, for the reason stated
 * there: it needed `tokens.ts` converted from literal hex values to
 * CSS custom properties first (see that file's own doc comment) — a
 * restructuring checkpoint of its own, done alongside this component
 * rather than before it, since neither is useful without the other.
 *
 * Purely client-side, no backend surface needed (the same reasoning
 * `AppShell.tsx`'s doc comment already gives for why Theme, unlike
 * Search/Settings, never needed a "does a backend endpoint exist"
 * check before being buildable). Persists the choice in
 * `localStorage` — a real browser, not a Claude Artifact sandbox, so
 * `localStorage` is the correct, standard tool here, not the
 * in-memory-only restriction that applies to Artifacts.
 *
 * Toggles a `data-theme="light"` attribute on `<html>` — absent means
 * dark, the default, so an unset/cleared/first-visit value renders
 * identically to how this app looked before this checkpoint, with no
 * flash-of-wrong-theme concern for the common case. A blocking inline
 * script in `layout.tsx` (see its own doc comment) sets the attribute
 * from `localStorage` before paint for returning visitors who chose
 * light, so there's no flash for them either.
 *
 * Deliberately reads `localStorage` directly in this component (not
 * via a prop from a Server Component the way `isLoggedIn`/
 * `notifications` are) — theme preference is a pure browser-storage
 * concern with no server-side source of truth to fetch, unlike every
 * other `AppShellProps` field.
 */
export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>('dark');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    // Mirrors the DOM attribute to whatever was actually read, not just
    // this component's own React state — a real bug caught by this
    // checkpoint's own test run: `layout.tsx`'s blocking inline script
    // (see its own doc comment) already does this before paint in a
    // real browser, but this effect is the only thing that does it in
    // any environment without that script (this component's own test
    // suite; a future consumer that doesn't render `layout.tsx`'s
    // script), so it needs to apply the attribute itself rather than
    // assuming something upstream already did.
    applyTheme(stored);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      title={mounted ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Toggle theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        background: 'none',
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.sm,
        color: tokens.color.textPrimary,
        cursor: 'pointer',
      }}
    >
      <span aria-hidden style={{ fontSize: '15px' }}>
        {/* Rendered pre-hydration default ('dark' state, mounted=false) always shows the moon — matching the no-attribute/dark default this component and layout.tsx's blocking script both already establish, so there's no hydration mismatch between server and first client render. */}
        {mounted && theme === 'light' ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
