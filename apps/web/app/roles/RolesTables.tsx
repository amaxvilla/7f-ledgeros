'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface RoleSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

export function RolesTable({
  rows,
}: {
  rows: RoleSummary[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Description' },
    { header: 'Type' },
    { header: 'Permissions', align: 'right' },
    { header: 'Users', align: 'right' },
    { header: 'Manage', align: 'right' },
  ];

  const tableRows: DataTableClientRow<RoleSummary>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: [
      row.code,
      row.name,
      row.description ?? '',
      row.isSystem ? 'System' : 'Custom',
      String(row.permissionCount),
      String(row.userCount),
    ].join(' '),
    cells: [
      row.code,
      row.name,
      row.description ?? '—',
      (
        <Badge
          key={`${row.id}-type`}
          tone={row.isSystem ? 'neutral' : 'positive'}
        >
          {row.isSystem ? 'System' : 'Custom'}
        </Badge>
      ),
      String(row.permissionCount),
      String(row.userCount),
      (
        <Link
          key={`${row.id}-manage`}
          href={`/roles/${row.id}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          Permissions →
        </Link>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No roles yet."
      search={{
        placeholder: 'Search code, name, description or type…',
      }}
    />
  );
}
