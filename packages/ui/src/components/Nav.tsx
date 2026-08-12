'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { tokens } from '../tokens';

export interface NavLinkItem {
  href: string;
  label: string;
}

export interface NavProps {
  links: NavLinkItem[];
}

/**
 * Frontend Completion, Checkpoint E — extracted out of AppShell (see
 * this component's own original doc comment, preserved in git history)
 * into its own 'use client' component for `usePathname()`.
 *
 * ADDENDUM — Sidebar conversion (FE-1.5's own recommended next
 * checkpoint, picked over the Risks `assess`/`mitigation-plan`/`monitor`
 * trio now that real `tsc`/Vitest tooling is confirmed working again
 * this session — see this repo's own CHECKPOINT_REPORT.md). 29
 * `NAV_LINKS` entries in a single horizontal top-bar row (the original
 * design) had become a genuinely worsening UX problem, flagged as such
 * by name in two prior reports (FE-1.4, FE-1.5) and deliberately
 * deferred both times pending working test-verification tooling — this
 * is that attempt, now that `pnpm install`/`tsc --noEmit`/the real
 * Vitest suite all ran clean first (non-negotiable per this repo's own
 * standing recommendation, re-run before touching this file).
 *
 * WHAT CHANGED, WHAT DIDN'T: `isActive()`'s exact-match-for-`/`,
 * prefix-match-for-everything-else logic is BYTE-FOR-BYTE UNCHANGED —
 * this checkpoint is a rendering/layout change, not a behavior change,
 * and every one of `Nav.test.tsx`'s own active-route-matching
 * assertions needed zero edits as a result (confirmed directly by
 * running them, not assumed). What changed is CSS/DOM shape only:
 *
 * 1. The always-rendered list (`.x7fnav-sidebar`, renamed from
 *    `.x7fnav-desktop` since "desktop" no longer describes what it is)
 *    is now an `<aside>`, stacked vertically (`flexDirection: 'column'`)
 *    with a fixed `width: 220px`, instead of a horizontal `<nav>` row.
 *    Active-link styling changed from an underline (`borderBottom`) to
 *    a left-edge accent bar + background tint (`borderLeft` +
 *    `background`) — the conventional sidebar affordance, and one that
 *    reads correctly at any link-label length, unlike an underline
 *    whose width is text-dependent. `fontWeight` itself (600 active /
 *    400 inactive) is UNCHANGED — every existing `toHaveStyle({
 *    fontWeight: ... })` assertion in both this file's own test and
 *    AppShell.test.tsx's still passes unmodified.
 * 2. The mobile toggle/panel mechanism (hamburger button below 640px,
 *    a slide-out link list) is KEPT, not rebuilt — same
 *    `open`/`setOpen` state, same "unmount entirely when closed, not
 *    just visually hidden" posture. What changed: the panel is now
 *    `position: fixed; inset: 0` (a full-viewport overlay) instead of
 *    `position: absolute; top: 100%` anchored to a `position:
 *    relative` header. `position: fixed` is relative to the viewport
 *    regardless of where in the DOM tree this component is mounted
 *    (no positioned ancestor required, confirmed: none of this
 *    component's new ancestors in `AppShell.tsx` use `transform`,
 *    which is the one thing that would change `fixed`'s containing
 *    block) — this is *why* AppShell.tsx's own "header positions
 *    itself relatively so Nav's mobile panel can anchor to it" test
 *    is retired this checkpoint (see AppShell.test.tsx's own updated
 *    assertions) rather than kept passing by coincidence.
 * 3. The toggle button now also carries a visible "Menu"/"Close" text
 *    label alongside the hamburger icon, not just an `aria-label` —
 *    on the old design the toggle sat inside the header next to the
 *    brand mark, where an icon-only button read clearly by context;
 *    mounted lower in the page now (`AppShell.tsx` renders it as a
 *    sibling of the sidebar/main-content row, below the header), a
 *    text label keeps it self-explanatory without that context. The
 *    `aria-label` itself (`"Open/Close navigation menu"`) is
 *    UNCHANGED — every `getByLabelText(...)` query in both test files
 *    still resolves the same element.
 *
 * NOT part of this checkpoint: an active-item auto-scroll-into-view
 * for the sidebar (29 items comfortably fit an average viewport height
 * without scrolling in the first place; worth revisiting only if the
 * nav list keeps growing) and a collapsed/icon-only sidebar mode
 * (a further UX refinement, not needed to fix the flagged "single
 * horizontal row" problem this checkpoint targets). Both left
 * unattempted rather than guessed at.
 *
 * ADDENDUM — Accessibility: `aria-current="page"` + landmark
 * `aria-label` (named across FE-10.7, FE-10.8, and FE-10.9's own
 * reports, picked up here per FE-10.10's own recommendation once the
 * red-test backlog was clear). Two real, verified gaps, not
 * speculative polish:
 * 1. The active link was distinguished only by color/`fontWeight`/
 *    border — visual-only, nothing exposed to assistive tech. Both
 *    link lists (sidebar and mobile panel) now set
 *    `aria-current={active ? 'page' : undefined}` on the active link's
 *    own `<a>`, using the SAME `isActive()` result already computed for
 *    styling — not a second, parallel active-check that could drift
 *    from the visual one.
 * 2. The sidebar was an `<aside>` (the "complementary" landmark role) —
 *    the wrong ARIA landmark for primary site navigation regardless of
 *    labeling; `<nav>` is what ARIA authoring practices call for here.
 *    Confirmed neither `Nav.test.tsx` nor `AppShell.test.tsx` asserts
 *    on the old `complementary` role anywhere before making this
 *    change (grepped both directly) — a safe swap, not a guessed-safe
 *    one. Both the sidebar and the mobile panel (a plain `<div>`
 *    before this checkpoint, not a landmark of any kind) are now
 *    `<nav aria-label="Primary navigation">`. Confirmed this doesn't
 *    create a duplicate-landmark problem: the two are mutually
 *    exclusive under normal use (`.x7fnav-sidebar`'s own `display:
 *    none` at ≤640px removes it from the accessibility tree entirely,
 *    not just visually — confirmed this is how `display: none`
 *    interacts with the AX tree, not assumed), so only one `<nav
 *    aria-label="Primary navigation">` is ever exposed at a time under
 *    normal use.
 *
 * ONE EDGE CASE NOTICED IN THE PRECEDING ADDENDUM, FIXED IN THIS ONE:
 * `open` previously had no resize awareness — opening the mobile panel
 * below 640px and then resizing/rotating past it without closing the
 * panel first left both the sidebar and the still-open panel mounted
 * simultaneously, a duplicate-landmark problem once both became `<nav
 * aria-label="Primary navigation">`. Fixed with a `matchMedia('(max-
 * width: 640px)')` change listener that calls `setOpen(false)` the
 * moment the viewport crosses back above 640px — never opens the panel,
 * only ever closes it; the toggle button remains the only way to open
 * it. Guarded for `typeof window.matchMedia !== 'function'` (confirmed
 * directly: `undefined` under this package's own jsdom test
 * environment) so the effect no-ops in tests rather than throwing —
 * no new test mock was needed as a result.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ links }: NavProps) {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = React.useState(false);

  // Fixes the resize edge case named in this file's own prior
  // accessibility addendum: `open` had no resize awareness at all, so
  // opening the mobile panel below 640px and then resizing/rotating
  // past it (without closing the panel first) left BOTH the sidebar
  // (visible again via its own CSS media query) and the still-open
  // panel mounted simultaneously — a genuine duplicate-landmark problem
  // now that both are `<nav aria-label="Primary navigation">`, not just
  // a visual one. `window.matchMedia` is unavailable in this package's
  // own test environment (confirmed directly — `typeof
  // window.matchMedia` is `undefined` under jsdom here, matching
  // `Nav.test.tsx`'s own long-standing note on why no viewport shim
  // exists), so this effect no-ops there rather than throwing — no new
  // test mock needed, and nothing for existing tests to break against.
  // The listener only ever CLOSES the panel (`!e.matches`, i.e. the
  // viewport grew past 640px) — it never opens it; opening remains the
  // toggle button's job alone.
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(max-width: 640px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setOpen(false);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: 'block',
    fontFamily: tokens.font.body,
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? tokens.color.accent : tokens.color.textMuted,
    textDecoration: 'none',
    borderLeft: active ? `3px solid ${tokens.color.accent}` : '3px solid transparent',
    background: active ? tokens.color.surfaceRaised : 'transparent',
    padding: `${tokens.space(2)} ${tokens.space(4)}`,
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Media query support: the one place in this codebase inline
          style objects can't do the job (unchanged reasoning from
          this component's original doc comment). */}
      <style>{`
        .x7fnav-sidebar { display: flex; flex-direction: column; width: 220px; flex-shrink: 0; }
        .x7fnav-toggle { display: none; }
        .x7fnav-panel { display: none; }
        @media (max-width: 640px) {
          .x7fnav-sidebar { display: none; }
          .x7fnav-toggle { display: inline-flex; }
          .x7fnav-panel.x7fnav-panel-open { display: flex; }
        }
      `}</style>

      <nav
        aria-label="Primary navigation"
        className="x7fnav-sidebar"
        style={{
          gap: tokens.space(1),
          paddingTop: tokens.space(4),
          borderRight: `1px solid ${tokens.color.border}`,
          background: tokens.color.surface,
        }}
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <a key={link.href} href={link.href} aria-current={active ? 'page' : undefined} style={linkStyle(active)}>
              {link.label}
            </a>
          );
        })}
      </nav>

      <button
        type="button"
        className="x7fnav-toggle"
        aria-expanded={open}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((o) => !o)}
        style={{
          alignItems: 'center',
          gap: tokens.space(2),
          margin: tokens.space(4),
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          cursor: 'pointer',
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          color: tokens.color.textPrimary,
        }}
      >
        <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ display: 'block', width: '18px', height: '2px', background: tokens.color.textPrimary }} />
          ))}
        </span>
        {open ? 'Close' : 'Menu'}
      </button>

      {open && (
        <nav
          aria-label="Primary navigation"
          className="x7fnav-panel x7fnav-panel-open"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'column',
            background: tokens.color.surface,
            padding: tokens.space(4),
            gap: tokens.space(1),
            zIndex: 20,
            overflowY: 'auto',
          }}
        >
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                style={{ ...linkStyle(active), borderLeft: 'none' }}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
