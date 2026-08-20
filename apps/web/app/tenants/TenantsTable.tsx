'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Tenant {
  id: string;
  status: 'ACTIVE' | 'FORMER' | string;
  moveInDate: string;
  moveOutDate: string | null;
  customer: { name: string; code: string };
  unit: { code: string; name: string | null };
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  FORMER: 'neutral',
};

export function TenantsTable({
  rows,
}: {
  rows: Tenant[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Customer' },
    { header: 'Unit' },
    { header: 'Status' },
    { header: 'Move-in' },
    { header: 'Move-out' },
  ];

  const tableRows: DataTableClientRow<Tenant>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: [
      row.customer.name,
      row.customer.code,
      row.unit.name ?? '',
      row.unit.code,
      row.status,
      new Date(row.moveInDate).toLocaleDateString(),
      row.moveOutDate ? new Date(row.moveOutDate).toLocaleDateString() : '',
    ].join(' '),
    cells: [
      `${row.customer.name} (${row.customer.code})`,
      row.unit.name ?? row.unit.code,
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      new Date(row.moveInDate).toLocaleDateString(),
      row.moveOutDate
        ? new Date(row.moveOutDate).toLocaleDateString()
        : '—',
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No tenants for this entity."
      search={{
        placeholder: 'Search customer, unit or status…',
      }}
    />
  );
}
