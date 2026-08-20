import { ActionForm, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { markNotificationRead, markAllNotificationsRead } from '../actions';
import { NotificationFilterForm } from './NotificationFilterForm';
import { NotificationsTable } from './NotificationsTables';

export const dynamic = 'force-dynamic';

interface NotificationRow {
  id: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PENDING: 'neutral',
  SENT: 'neutral',
  DELIVERED: 'positive',
  READ: 'positive',
  FAILED: 'negative',
};

/**
 * Frontend Completion, FE-8.8 — Notifications, following FE-8.7's own
 * recommendation. **Correcting a real error in that recommendation
 * before building anything**: FE-8.7's report named Notifications as
 * "the one remaining genuinely-real FE-8 gap," entirely unbuilt — false,
 * confirmed directly by grepping `apps/web` for every `/notifications`
 * and `/dashboard/my-notifications` call already made. FE-1.2 already
 * built `NotificationsMenu` (`packages/ui`) wired into `layout.tsx`'s
 * own header chrome, backed by `GET /dashboard/my-notifications` (a
 * `{ unreadCount, recent }` widget, `recent` = `take: 5, unreadOnly:
 * true` — confirmed directly against `DashboardService.getMyNotificationsWidget`)
 * plus `PATCH /notifications/:id/read` and `POST /notifications/read-all`
 * (already exported from `app/actions.ts` at the root, not
 * route-scoped — same file this page reuses its two actions from
 * directly, adding none of its own).
 *
 * **The real, remaining gap, confirmed by reading `NotificationsController`
 * in full**: `GET /notifications` itself (the full paginated,
 * filterable list — `status`/`channel`/`unreadOnly`/`take`/`skip`) has
 * no consumer anywhere; the header widget only ever shows the 5 most
 * recent UNREAD notifications, never READ ones, never more than 5,
 * never filtered by channel. This page is that missing full register —
 * genuinely additive, not a rebuild of what FE-1.2 already shipped.
 * `GET /notifications/unread-count` is NOT separately called here
 * either — confirmed directly it's the exact same
 * `this.prisma.notification.count({ where: { userId, readAt: null } })`
 * the header widget's own `unreadCount` already computes, so a second
 * call here would just be a second network round-trip to the same
 * number the header already shows live.
 *
 * Filter form is a native `<form method="GET">` (`NotificationFilterForm.tsx`),
 * the same mechanism `workflow/instances/InstanceLookupForm.tsx` and
 * `tax/TaxPositionForm.tsx` both already established for a query, not a
 * mutation. Mark-read/mark-all-read reuse `app/actions.ts`'s own
 * existing `markNotificationRead`/`markAllNotificationsRead` directly
 * via `ActionForm` (`@7f/ui`) — the exact same two actions, the exact
 * same `() => action(id)` (not `.bind`) wrapping `NotificationsMenu.tsx`'s
 * own doc comment already established the reasoning for (`.bind(null,
 * id)` would leak an unwanted `FormData` argument into an action that
 * takes none) — imported and used directly in this Server Component,
 * the same "ActionForm composed straight into page.tsx, no wrapper
 * component" pattern `my-security/page.tsx`'s own "revoke all other
 * sessions" button already uses. Their existing `revalidatePath('/',
 * 'layout')` refreshes this page AND the header widget together on any
 * mark-read here — not duplicated or special-cased for this page.
 *
 * `take`/`skip` pagination exists on the backend (`take` capped at 100
 * server-side) but this checkpoint does NOT add page-forward/back
 * controls — `take=50` (a fixed, generous default) is passed and
 * `skip` is left at 0; genuine prev/next pagination UI is deliberately
 * left for a future checkpoint if the 50-row default proves
 * insufficient in practice, the same "don't build UI for a need not yet
 * confirmed real" restraint this app's history applies throughout.
 *
 * The "Delivery stats (admin) →" link to `/notifications/admin` is
 * shown unconditionally, not gated behind a client-side permission
 * check — same posture this app takes everywhere else (no
 * `RequirePermissions`-equivalent duplicated client-side; the backend's
 * own `NOTIFICATIONS_ADMIN_VIEW` check on that route is what actually
 * enforces it, and a non-admin following the link simply sees that
 * page's own error state, the same as any other forbidden request in
 * this app).
 */
async function loadNotifications(filters: { status?: string; channel?: string; unreadOnly?: string }) {
  const params = new URLSearchParams({ take: '50' });
  if (filters.status) params.set('status', filters.status);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.unreadOnly === 'true') params.set('unreadOnly', 'true');
  return fetchApi<NotificationRow[]>(`/notifications?${params.toString()}`);
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { status?: string; channel?: string; unreadOnly?: string };
}) {
  let notifications: NotificationRow[] = [];
  let error: string | null = null;
  try {
    notifications = await loadNotifications(searchParams);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load notifications.';
  }

  const anyUnread = notifications.some((n) => !n.readAt);

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        subtitle="Your full notification history (most recent 50)."
      />
      <div style={{ marginBottom: tokens.space(4) }}>
        <a href="/notifications/admin" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          Delivery stats (admin) →
        </a>
      </div>
      <NotificationFilterForm status={searchParams.status} channel={searchParams.channel} unreadOnly={searchParams.unreadOnly} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {anyUnread && (
        <div style={{ marginBottom: tokens.space(4) }}>
          <ActionForm action={() => markAllNotificationsRead()}>
            <button
              type="submit"
              style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Mark all read
            </button>
          </ActionForm>
        </div>
      )}

      <NotificationsTable rows={notifications} />
    </PageContainer>
  );
}
