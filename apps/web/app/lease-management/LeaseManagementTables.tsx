'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Lease {
  id: string;
  leaseNumber: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | string;
  rentAmount: number;
  rentFrequency: string;
  startDate: string;
  endDate: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  ACTIVE: 'positive',
  EXPIRED: 'warning',
  TERMINATED: 'negative',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function LeaseManagementTable({
  rows,
}: {
  rows: Lease[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Lease #' },
    { header: 'Status' },
    { header: 'Rent' },
    { header: 'Start' },
    { header: 'End' },
  ];

  const tableRows: DataTableClientRow<Lease>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.leaseNumber} ${row.status} ${row.rentFrequency} ${row.startDate} ${row.endDate}`,
    cells: [
      row.leaseNumber,
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      `${formatCurrency(row.rentAmount)} / ${row.rentFrequency.toLowerCase()}`,
      new Date(row.startDate).toLocaleDateString(),
      new Date(row.endDate).toLocaleDateString(),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No leases for this entity."
      search={{
        placeholder: 'Search lease number, status or rent frequency…',
      }}
    />
  );
}
