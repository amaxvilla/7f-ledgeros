'use client';

import { ActionForm, Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { markNotificationRead } from '../actions';

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

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PENDING: 'neutral',
  SENT: 'neutral',
  DELIVERED: 'positive',
  READ: 'positive',
  FAILED: 'negative',
};

export function NotificationsTable({
  rows,
}: {
  rows: NotificationRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Title' },
    { header: 'Body' },
    { header: 'Channel' },
    { header: 'Status' },
    { header: 'Received' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<NotificationRow>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.title} ${row.body} ${row.channel} ${row.status} ${
        row.readAt ? 'Read' : 'Unread'
      }`,
      cells: [
        row.title,
        row.body,
        row.channel,
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        new Date(row.createdAt).toLocaleString(),
        row.readAt ? (
          <span
            key={`${row.id}-read`}
            style={{
              fontFamily: tokens.font.body,
              fontSize: '12px',
              color: tokens.color.textMuted,
            }}
          >
            Read
          </span>
        ) : (
          <ActionForm
            key={`${row.id}-mark-read`}
            action={() => markNotificationRead(row.id)}
          >
            <button
              type="submit"
              style={{
                color: tokens.color.accent,
                fontFamily: tokens.font.body,
                fontSize: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Mark read
            </button>
          </ActionForm>
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No notifications match these filters."
      search={{
        placeholder: 'Search title, body, channel or status…',
      }}
    />
  );
}
