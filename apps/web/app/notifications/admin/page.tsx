import { Badge, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';

export const dynamic = 'force-dynamic';

interface DeliveryStats {
  byStatus: { status: string; count: number }[];
  byChannel: { channel: string; count: number }[];
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PENDING: 'neutral',
  SENT: 'neutral',
  DELIVERED: 'positive',
  READ: 'positive',
  FAILED: 'negative',
};

/**
 * Frontend Completion, FE-8.8 — Notifications admin delivery stats
 * (`GET /notifications/admin/delivery-stats`,
 * `NOTIFICATIONS_ADMIN_VIEW`, confirmed directly against
 * `NotificationsController`). Global, system-wide rollup with no
 * `entityId`/`userId` scoping at all (confirmed directly against
 * `NotificationsService.getDeliveryStats`'s own two `groupBy` calls,
 * neither `where`-filtered) — same "global rollup, own explicitly-
 * labeled section" reasoning `handover/page.tsx`'s own FE-4 addendum
 * already established for `snag-overview`, reused here as a whole
 * separate route rather than a section on `/notifications` itself,
 * since this data has nothing to do with the current user's own
 * notification history that page shows and gating it behind a
 * different permission (`workflow.act`-style separation, not
 * `notifications`'s own self-service-only posture the rest of this
 * controller has) makes it a genuinely different audience, not just a
 * different section.
 *
 * No nav entry — same "sub-page of an already-linked page gets no
 * separate NAV_LINKS entry" precedent `/workflow/[code]` and
 * `/workflow/instances` both already established; linked FROM
 * `/notifications` itself instead (see that page's own small "Delivery
 * stats (admin) →" link).
 *
 * Badge-list breakdown, same shape `handover/page.tsx`'s own "Snags —
 * all entities" section and `recruitment/page.tsx`'s own "Pipeline by
 * stage" section both already use for this exact kind of small
 * groupBy-shaped result — reused directly, not a new pattern.
 */
async function loadDeliveryStats() {
  return fetchApi<DeliveryStats>('/notifications/admin/delivery-stats');
}

export default async function NotificationsDeliveryStatsPage() {
  let stats: DeliveryStats | null = null;
  let error: string | null = null;
  try {
    stats = await loadDeliveryStats();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load delivery stats.';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Notification delivery stats"
        subtitle="System-wide, across every user — not scoped to you."
        breadcrumbs={[{ label: 'Notifications', href: '/notifications' }, { label: 'Delivery stats' }]}
      />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(6) }}>
          <div>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, display: 'block', marginBottom: tokens.space(2) }}>
              By status
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(2) }}>
              {stats.byStatus.length === 0 && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>No notifications recorded yet.</span>
              )}
              {stats.byStatus.map((s) => (
                <Badge key={s.status} tone={STATUS_TONE[s.status] ?? 'neutral'}>
                  {s.status}: {s.count}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, display: 'block', marginBottom: tokens.space(2) }}>
              By channel
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(2) }}>
              {stats.byChannel.length === 0 && (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>No notifications recorded yet.</span>
              )}
              {stats.byChannel.map((c) => (
                <Badge key={c.channel} tone="neutral">
                  {c.channel}: {c.count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
