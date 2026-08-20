'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { RevokeLinkedAccountButton } from './RevokeLinkedAccountButton';

interface BankIntegrationRow {
  id: string;
  institutionName: string | null;
  accountNumberMasked: string | null;
  status: string;
  lastSyncedAt: string | null;
  reauthRequiredAt: string | null;
  bankAccountName: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  REVOKED: 'neutral',
  REQUIRES_REAUTH: 'warning',
};

export function BankIntegrationLinkedAccountsTable({
  rows,
}: {
  rows: BankIntegrationRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Institution' },
    { header: 'Bank account' },
    { header: 'Account' },
    { header: 'Status' },
    { header: 'Last synced' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<BankIntegrationRow>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: [
        row.institutionName ?? '',
        row.bankAccountName,
        row.accountNumberMasked ?? '',
        row.status,
      ].join(' '),
      cells: [
        row.institutionName ?? '—',
        row.bankAccountName,
        row.accountNumberMasked ?? '—',
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        row.lastSyncedAt
          ? new Date(row.lastSyncedAt).toLocaleString()
          : 'Never',
        (
          <RevokeLinkedAccountButton
            key={`${row.id}-actions`}
            id={row.id}
            status={row.status}
          />
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No linked bank accounts for this entity yet."
    />
  );
}
