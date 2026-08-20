'use client';

import Link from 'next/link';
import { DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface EntitySummary {
  id: string;
  code: string;
  name: string;
}

export function EntitySubsidiariesTable({
  rows,
}: {
  rows: EntitySummary[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: '', align: 'right' },
  ];

  const tableRows: DataTableClientRow<EntitySummary>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.code} ${row.name}`,
    cells: [
      row.code,
      row.name,
      (
        <Link
          key={`${row.id}-view`}
          href={`/entities/${row.id}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          View →
        </Link>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No subsidiaries under this entity."
      search={{
        placeholder: 'Search subsidiaries...',
      }}
    />
  );
}
