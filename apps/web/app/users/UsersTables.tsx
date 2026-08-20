'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { RevokeDeviceButton } from './[id]/RevokeDeviceButton';

interface UserRoleSummary {
  id: string;
  code: string;
  name: string;
}

interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  lockedUntil: string | null;
  createdAt: string;
  roles: UserRoleSummary[];
}

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

interface LoginHistoryEntry {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  createdAt: string;
}

function isCurrentlyLocked(lockedUntil: string | null): boolean {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now();
}

function loginEventTone(
  eventType: string,
): 'positive' | 'negative' | 'warning' | 'neutral' {
  switch (eventType) {
    case 'LOGIN_SUCCESS':
      return 'positive';
    case 'LOGIN_FAILURE':
    case 'ACCOUNT_LOCKED':
      return 'negative';
    case 'ACCOUNT_UNLOCKED':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function UsersTable({
  rows,
}: {
  rows: UserSummary[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'Roles' },
    { header: 'MFA' },
    { header: 'Status' },
    { header: 'Manage' },
  ];

  const tableRows: DataTableClientRow<UserSummary>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      `${row.firstName} ${row.lastName}`,
      row.email,
      row.phone ?? '—',
      row.roles.length === 0 ? (
        '—'
      ) : (
        <div
          key={`${row.id}-roles`}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: tokens.space(1),
          }}
        >
          {row.roles.map((role) => (
            <Badge key={role.id} tone="neutral">
              {role.code}
            </Badge>
          ))}
        </div>
      ),
      (
        <Badge
          key={`${row.id}-mfa`}
          tone={row.mfaEnabled ? 'positive' : 'neutral'}
        >
          {row.mfaEnabled ? 'Enabled' : 'Off'}
        </Badge>
      ),
      isCurrentlyLocked(row.lockedUntil) ? (
        <Badge key={`${row.id}-status`} tone="negative">
          Locked
        </Badge>
      ) : (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
      (
        <Link
          key={`${row.id}-manage`}
          href={`/users/${row.id}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          Manage roles →
        </Link>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No users yet."
    />
  );
}

export function UserSessionsTable({
  rows,
}: {
  rows: Session[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'IP address' },
    { header: 'User agent' },
    { header: 'Created' },
    { header: 'Last used' },
    { header: 'Expires' },
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
      new Date(row.expiresAt).toLocaleString(),
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

export function UserTrustedDevicesTable({
  rows,
  userId,
}: {
  rows: TrustedDevice[];
  userId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Device' },
    { header: 'IP address' },
    { header: 'User agent' },
    { header: 'Trusted since' },
    { header: 'Last used' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<TrustedDevice>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.deviceName ?? '—',
      row.ipAddress ?? '—',
      row.userAgent ?? '—',
      new Date(row.trustedAt).toLocaleString(),
      row.lastUsedAt
        ? new Date(row.lastUsedAt).toLocaleString()
        : '—',
      (
        <RevokeDeviceButton
          key={`${row.id}-revoke`}
          userId={userId}
          deviceId={row.id}
        />
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

export function UserLoginHistoryTable({
  rows,
}: {
  rows: LoginHistoryEntry[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Event' },
    { header: 'IP address' },
    { header: 'Failure reason' },
    { header: 'When' },
  ];

  const tableRows: DataTableClientRow<LoginHistoryEntry>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        (
          <Badge
            key={`${row.id}-event`}
            tone={loginEventTone(row.eventType)}
          >
            {row.eventType}
          </Badge>
        ),
        row.ipAddress ?? '—',
        row.failureReason ?? '—',
        new Date(row.createdAt).toLocaleString(),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No login history."
    />
  );
}
