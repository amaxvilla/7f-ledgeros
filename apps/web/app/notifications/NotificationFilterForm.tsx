'use client';

import * as React from 'react';
import { Button, Select, tokens } from '@7f/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'READ', label: 'Read' },
  { value: 'FAILED', label: 'Failed' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'IN_APP', label: 'In-app' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const UNREAD_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Unread only' },
];

/**
 * Frontend Completion, FE-8.8 — Notifications. Same native
 * `<form method="GET">` mechanism `workflow/instances/InstanceLookupForm.tsx`
 * and `tax/TaxPositionForm.tsx` both already established for a query,
 * not a mutation — submitting re-renders `NotificationsPage`'s own
 * Server Component with the new `searchParams`, no Server Action
 * needed. All three filters are optional (`NotificationsController.list`'s
 * own `@Query` params all have no `?`-less required signature —
 * confirmed directly), so each `Select` has a real, selectable "All"
 * first option (value `''`) rather than a disabled placeholder — a
 * placeholder can't be re-selected once a real option is chosen, which
 * would make "clear this filter" unreachable through the UI. Submitting
 * "All" does put an empty `?status=` in the URL (a native GET form
 * always includes every named field), but that's harmless: `page.tsx`'s
 * own `loadNotifications` only adds a param to the actual API call when
 * its value is truthy, so an empty string there is dropped before
 * `fetchApi` ever sees it.
 */
export function NotificationFilterForm({
  status,
  channel,
  unreadOnly,
}: {
  status?: string;
  channel?: string;
  unreadOnly?: string;
}) {
  const [statusValue, setStatusValue] = React.useState(status ?? '');
  const [channelValue, setChannelValue] = React.useState(channel ?? '');
  const [unreadValue, setUnreadValue] = React.useState(unreadOnly ?? '');

  return (
    <form
      method="get"
      action="/notifications"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.space(3),
        alignItems: 'flex-end',
        padding: tokens.space(4),
        marginBottom: tokens.space(6),
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Status"
        name="status"
        value={statusValue}
        onChange={(e) => setStatusValue(e.target.value)}
        options={STATUS_OPTIONS}
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Channel"
        name="channel"
        value={channelValue}
        onChange={(e) => setChannelValue(e.target.value)}
        options={CHANNEL_OPTIONS}
        style={{ minWidth: '160px' }}
      />
      <Select
        label="Read status"
        name="unreadOnly"
        value={unreadValue}
        onChange={(e) => setUnreadValue(e.target.value)}
        options={UNREAD_OPTIONS}
        style={{ minWidth: '160px' }}
      />
      <Button type="submit">Filter</Button>
    </form>
  );
}
