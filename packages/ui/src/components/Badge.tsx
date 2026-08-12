import * as React from 'react';
import { tokens } from '../tokens';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning';
}

const toneStyles: Record<NonNullable<BadgeProps['tone']>, { bg: string; fg: string }> = {
  neutral: { bg: tokens.color.surfaceRaised, fg: tokens.color.textMuted },
  positive: { bg: 'rgba(63,166,107,0.15)', fg: tokens.color.positive },
  negative: { bg: 'rgba(194,77,77,0.15)', fg: tokens.color.negative },
  warning: { bg: 'rgba(217,148,74,0.15)', fg: tokens.color.warning },
};

/** Small status pill, e.g. for reconciliation/invoice statuses. */
export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const style = toneStyles[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `${tokens.space(1)} ${tokens.space(2)}`,
        borderRadius: tokens.radius.sm,
        fontFamily: tokens.font.body,
        fontSize: '11px',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        background: style.bg,
        color: style.fg,
      }}
    >
      {children}
    </span>
  );
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Frontend Completion, FE-1.1 — Application Shell inventory pass
   * against the new master prompt's own FE-1 item list ("Breadcrumbs"
   * was one of the confirmed gaps; `AppShell`'s own top nav has no
   * per-route knowledge to render these itself, so this lives on
   * `PageHeader` instead — already rendered at the top of every existing
   * page, opt-in per page rather than a global, always-on chrome
   * element). Explicit `{ label, href? }[]` rather than derived
   * automatically from the URL path or `AppShell`'s own `NAV_LINKS`:
   * matches this codebase's own established preference for explicit,
   * caller-supplied data over context-sniffing (`ActionForm`'s `action`
   * prop, `PmoStatusActions`'s `onAdvance`, `Select`'s own options list
   * all follow the same pattern) — a nested route like
   * `/work-packages/[id]` has no generic way to turn its own dynamic
   * `id` segment into a human label ("Work Package WP-2024-003", not
   * the raw id) without the page itself supplying it.
   *
   * The LAST item is always rendered as plain text, never a link, even
   * if it has an `href` — it represents the current page, and linking a
   * page to itself is not a common breadcrumb convention. Every item
   * before it renders as a link only if it has an `href`; a crumb with
   * no `href` (and not the last one) renders as plain text too, for an
   * ancestor step that isn't itself a real navigable page (e.g. a
   * conceptual grouping level).
   */
  breadcrumbs?: { label: string; href?: string }[];
}

/** Section header used at the top of the dashboard and each report page. */
export function PageHeader({ title, subtitle, breadcrumbs }: PageHeaderProps) {
  return (
    <header style={{ marginBottom: tokens.space(6) }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ marginBottom: tokens.space(2) }}>
          <ol style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(1), listStyle: 'none', margin: 0, padding: 0 }}>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: tokens.space(1) }}>
                  {index > 0 && (
                    <span aria-hidden style={{ color: tokens.color.textMuted, fontSize: '12px' }}>
                      /
                    </span>
                  )}
                  {!isLast && crumb.href ? (
                    <a
                      href={crumb.href}
                      style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted, textDecoration: 'none' }}
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: '12px',
                        color: isLast ? tokens.color.textPrimary : tokens.color.textMuted,
                      }}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <h1
        style={{
          fontFamily: tokens.font.display,
          fontSize: '26px',
          fontWeight: 500,
          color: tokens.color.textPrimary,
          margin: 0,
          borderLeft: `3px solid ${tokens.color.accent}`,
          paddingLeft: tokens.space(3),
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, margin: `${tokens.space(2)} 0 0 ${tokens.space(4)}` }}>
          {subtitle}
        </p>
      )}
    </header>
  );
}
