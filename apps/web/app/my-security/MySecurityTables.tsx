'use client';

import { ActionForm, Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import {
  revokeSession,
  revokeDevice,
  renameDevice,
} from './actions';

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

interface TrustedDevice {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  trustedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

interface LoginHistoryEvent {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  createdAt: string;
}

const EVENT_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  LOGIN_SUCCESS: 'positive',
  LOGIN_FAILURE: 'negative',
  LOGOUT: 'neutral',
  ACCOUNT_LOCKED: 'negative',
  ACCOUNT_UNLOCKED: 'warning',
};

export function MySecuritySessionsTable({
  rows,
}: {
  rows: Session[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'IP address' },
    { header: 'Device' },
    { header: 'Started' },
    { header: 'Last used' },
    { header: '', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Session>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.ipAddress ?? '—',
      row.userAgent ?? '—',
      new Date(row.createdAt).toLocaleString(),
      row.lastUsedAt
        ? new Date(row.lastUsedAt).toLocaleString()
        : '—',
      (
        <ActionForm action={revokeSession.bind(null, row.id)}>
          <button
            type="submit"
            style={{
              color: tokens.color.negative,
              fontFamily: tokens.font.body,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Revoke
          </button>
        </ActionForm>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No active sessions."
    />
  );
}

export function MySecurityTrustedDevicesTable({
  rows,
}: {
  rows: TrustedDevice[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Device' },
    { header: 'IP address' },
    { header: 'Trusted since' },
    { header: 'Last used' },
    { header: '' },
    { header: '', align: 'right' },
  ];

  const tableRows: DataTableClientRow<TrustedDevice>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.deviceName ?? row.userAgent ?? 'Unnamed device',
      row.ipAddress ?? '—',
      new Date(row.trustedAt).toLocaleString(),
      row.lastUsedAt
        ? new Date(row.lastUsedAt).toLocaleString()
        : '—',
      (
        <ActionForm
          action={renameDevice.bind(null, row.id)}
          style={{
            display: 'flex',
            gap: tokens.space(2),
            alignItems: 'center',
          }}
        >
          <input
            name="deviceName"
            defaultValue={row.deviceName ?? ''}
            placeholder="Name this device"
            style={{
              fontFamily: tokens.font.body,
              fontSize: '13px',
              padding: `${tokens.space(1)} ${tokens.space(2)}`,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.sm,
              width: '140px',
            }}
          />
          <button
            type="submit"
            style={{
              color: tokens.color.textMuted,
              fontFamily: tokens.font.body,
              fontSize: '13px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </ActionForm>
      ),
      (
        <ActionForm action={revokeDevice.bind(null, row.id)}>
          <button
            type="submit"
            style={{
              color: tokens.color.negative,
              fontFamily: tokens.font.body,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Revoke
          </button>
        </ActionForm>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No trusted devices."
    />
  );
}

export function MySecurityLoginHistoryTable({
  rows,
}: {
  rows: LoginHistoryEvent[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Event' },
    { header: 'IP address' },
    { header: 'Device' },
    { header: 'Reason' },
    { header: 'When' },
  ];

  const tableRows: DataTableClientRow<LoginHistoryEvent>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        (
          <Badge
            key={`${row.id}-event`}
            tone={EVENT_TONE[row.eventType] ?? 'neutral'}
          >
            {row.eventType}
          </Badge>
        ),
        row.ipAddress ?? '—',
        row.userAgent ?? '—',
        row.failureReason ?? '—',
        new Date(row.createdAt).toLocaleString(),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No login events recorded yet."
    />
  );
}
