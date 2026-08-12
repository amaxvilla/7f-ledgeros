// Design tokens for the LedgerOS dashboard. Grounded in the product
// itself — a multi-entity ledger for a capital/real-estate group — not
// a generic admin-template palette: deep ledger-navy surfaces, a brass
// accent (capital, hardware, construction), and tabular monospace for
// every financial figure so numbers read the way they do on a real
// statement.
//
// FE-1.6 — Theme (light/dark toggle). `color.*` below now reads CSS
// custom properties (`var(--ledgeros-*)`) instead of literal hex
// values, with the actual dark/light values declared once in
// `apps/web/app/globals.css` (`:root` for dark — the default, matching
// every value this file used to hard-code — and `[data-theme="light"]`
// as the override block). This is the smallest correct conversion:
// every component in this package (and every consumer) reads
// `tokens.color.X` as a plain string already — none of them care
// whether that string is a literal hex value or a `var(...)`
// reference, so this is the ONLY file that needed to change to make
// every existing `style={{ background: tokens.color.bg }}`-shaped
// call site theme-aware for free. `font`/`radius`/`space` below are
// unchanged (typography and spacing are not theme-dependent here).
export const tokens = {
  color: {
    bg: 'var(--ledgeros-bg)',
    surface: 'var(--ledgeros-surface)',
    surfaceRaised: 'var(--ledgeros-surface-raised)',
    border: 'var(--ledgeros-border)',
    textPrimary: 'var(--ledgeros-text-primary)',
    textMuted: 'var(--ledgeros-text-muted)',
    accent: 'var(--ledgeros-accent)',
    accentMuted: 'var(--ledgeros-accent-muted)',
    positive: 'var(--ledgeros-positive)',
    negative: 'var(--ledgeros-negative)',
    warning: 'var(--ledgeros-warning)',
  },
  font: {
    display: 'ui-serif, Georgia, "Times New Roman", serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace',
  },
  radius: {
    sm: '4px',
    md: '8px',
  },
  space: (n: number) => `${n * 4}px`,
} as const;
