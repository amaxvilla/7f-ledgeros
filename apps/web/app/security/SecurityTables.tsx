'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { DeactivateIpRuleButton } from './DeactivateIpRuleButton';

interface IpRule {
  id: string;
  scope: string;
  userId: string | null;
  cidr: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PasswordPolicy {
  id: string;
  entityId: string | null;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays: number | null;
  historyCount: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  isActive: boolean;
  updatedAt: string;
}

export function SecurityIpRulesTable({
  rows,
  userLabelById,
}: {
  rows: IpRule[];
  userLabelById: Record<string, string>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Scope' },
    { header: 'User' },
    { header: 'CIDR' },
    { header: 'Label' },
    { header: 'Status' },
    { header: 'Created' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<IpRule>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.scope} ${row.userId ? userLabelById[row.userId] ?? row.userId : ''} ${row.cidr} ${row.label ?? ''} ${row.isActive ? 'Active' : 'Inactive'}`,
    cells: [
      (
        <Badge
          key={`${row.id}-scope`}
          tone={row.scope === 'GLOBAL' ? 'neutral' : 'warning'}
        >
          {row.scope}
        </Badge>
      ),
      row.userId
        ? userLabelById[row.userId] ?? row.userId
        : '—',
      row.cidr,
      row.label ?? '—',
      (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
      new Date(row.createdAt).toLocaleDateString(),
      (
        <DeactivateIpRuleButton
          key={`${row.id}-actions`}
          id={row.id}
          isActive={row.isActive}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No IP restriction rules configured."
    />
  );
}

export function SecurityPasswordPoliciesTable({
  rows,
}: {
  rows: PasswordPolicy[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Scope' },
    { header: 'Min length' },
    { header: 'Expiry' },
    { header: 'History' },
    { header: 'Lockout' },
    { header: 'Updated' },
  ];

  const tableRows: DataTableClientRow<PasswordPolicy>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.entityId === null ? 'GLOBAL' : 'ENTITY'} ${row.minLength} ${row.expiryDays ?? 'Never'} ${row.historyCount} ${row.maxFailedLoginAttempts} ${row.lockoutDurationMinutes}`,
    cells: [
      (
        <Badge
          key={`${row.id}-scope`}
          tone={row.entityId === null ? 'neutral' : 'warning'}
        >
          {row.entityId === null ? 'GLOBAL' : 'ENTITY'}
        </Badge>
      ),
      String(row.minLength),
      row.expiryDays ? `${row.expiryDays} days` : 'Never',
      String(row.historyCount),
      `${row.maxFailedLoginAttempts} attempts / ${row.lockoutDurationMinutes}m`,
      new Date(row.updatedAt).toLocaleDateString(),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No password policy configured yet — defaults are in effect."
    />
  );
}
