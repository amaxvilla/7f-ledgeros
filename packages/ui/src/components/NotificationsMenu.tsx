'use client';

import * as React from 'react';
import { tokens } from '../tokens';
import { ActionForm } from './ActionForm';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsMenuProps {
  unreadCount: number;
  recent: NotificationItem[];
  /** Server Action reference — same "caller supplies it, component doesn't import auth/data logic itself" contract `LogoutButton.onLogout`'s own doc comment establishes. */
  onMarkRead: (id: string) => Promise<{ ok: boolean; error?: string } | void>;
  onMarkAllRead: () => Promise<{ ok: boolean; error?: string } | void>;
}

/**
 * Frontend Completion, FE-1.2 — Notifications (header indicator), the
 * other confirmed FE-1 gap picked up alongside User Profile (see
 * `layout.tsx`'s own doc comment for why both landed in one
 * checkpoint). Fully backend-ready with zero new backend work: `GET
 * /dashboard/my-notifications` (`recent`/`unreadCount`), `PATCH
 * /notifications/:id/read`, `POST /notifications/read-all` all already
 * existed (Release F) — confirmed by reading `notifications.controller.ts`
 * and `dashboard.service.ts`'s `getMyNotificationsWidget` directly
 * before writing this, not assumed.
 *
 * Data flows the same "Server Component fetches once at layout render,
 * Client Component only handles interaction + calls Server Actions"
 * split every other stateful piece of chrome in this app already uses
 * (`Nav` renders `NAV_LINKS` data AppShell already had; this renders
 * `initial` notification data `layout.tsx` already fetched) — no
 * client-side `fetchApi` call exists anywhere in this app, and
 * `fetchApi` itself can't run in a Client Component regardless (it
 * calls `next/headers`'s `cookies()`, a Server-only API — confirmed
 * directly against `lib/api.ts` before designing this component this
 * way, not assumed).
 *
 * Does NOT poll for new notifications — the badge count reflects
 * whatever was true when the current page's Server Component last
 * rendered, same "no client-side data layer, no new state management
 * introduced" restraint `payments/page.tsx`'s own doc comment already
 * established for its own read side. Refreshes on navigation (a new
 * page render re-runs `layout.tsx`) or after either action below
 * resolves (`revalidatePath('/', 'layout')` — see `app/actions.ts`'s
 * own doc comment), not in real time.
 *
 * `ActionForm` reused for both "Mark all read" and each row's own "Mark
 * read" — the same shared primitive `LogoutButton`/`api-gateway`/
 * `my-security` already use, rather than a sixth near-identical
 * pending/error wrapper. Unlike those five call sites (whose actions
 * genuinely consume the submitted `FormData`, so `.bind(null, id)` is
 * the right way to partially apply an id ahead of it), `onMarkRead`/
 * `onMarkAllRead` are plain `(id?) => Promise<...>` callbacks with no
 * form fields of their own — `.bind(null, id)` would still type-check
 * against `ActionForm`'s `(formData) => Promise<...>` contract (fewer
 * params is always assignable) but leaks an unwanted `FormData` as a
 * real extra runtime argument once `ActionForm` calls it. Each is
 * wrapped in a plain arrow (`() => onMarkRead(n.id)`) that discards the
 * FormData `ActionForm` passes instead.
 */
export function NotificationsMenu({ unreadCount, recent, onMarkRead, onMarkAllRead }: NotificationsMenuProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={open}
        style={{
          position: 'relative',
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
        <span aria-hidden style={{ fontSize: '16px' }}>
          🔔
        </span>
        {unreadCount > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '16px',
              height: '16px',
              padding: '0 3px',
              borderRadius: '8px',
              background: tokens.color.negative,
              color: tokens.color.textPrimary,
              fontFamily: tokens.font.body,
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            maxHeight: '400px',
            overflowY: 'auto',
            background: tokens.color.surface,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            zIndex: 10,
            padding: tokens.space(3),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.space(2) }}>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px', fontWeight: 600, color: tokens.color.textPrimary }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <ActionForm action={() => onMarkAllRead()}>
                <button
                  type="submit"
                  style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Mark all read
                </button>
              </ActionForm>
            )}
          </div>

          {recent.length === 0 ? (
            <div style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, padding: tokens.space(2) }}>
              No unread notifications.
            </div>
          ) : (
            recent.map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: tokens.space(1),
                  padding: tokens.space(2),
                  borderBottom: `1px solid ${tokens.color.border}`,
                }}
              >
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', fontWeight: 600, color: tokens.color.textPrimary }}>
                  {n.title}
                </span>
                <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>{n.body}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: tokens.font.body, fontSize: '11px', color: tokens.color.textMuted }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                  <ActionForm action={() => onMarkRead(n.id)}>
                    <button
                      type="submit"
                      style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Mark read
                    </button>
                  </ActionForm>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
