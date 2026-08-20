'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  CONVERTED: 'positive',
  DISQUALIFIED: 'negative',
  NEW: 'neutral',
  CONTACTED: 'warning',
  QUALIFIED: 'warning',
};

export function CrmLeadsTable({
  rows,
}: {
  rows: Lead[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Name' },
    { header: 'Email' },
    { header: 'Source' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Lead>[] = rows.map((row) => {
    const fullName = `${row.firstName} ${row.lastName}`;

    return {
      id: row.id,
      data: row,
      searchText: `${fullName} ${row.email ?? ''} ${row.source} ${row.status}`,
      cells: [
        fullName,
        row.email ?? '—',
        (
          <Badge
            key={`${row.id}-source`}
            tone="neutral"
          >
            {row.source}
          </Badge>
        ),
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
      ],
    };
  });

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No leads for this entity yet."
      search={{
        placeholder: 'Search name, email, source or status…',
      }}
    />
  );
}
