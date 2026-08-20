'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface MortgageApplication {
  id: string;
  lenderName: string;
  amountApplied: number;
  amountApproved: number | null;
  disbursedAmount: number | null;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  APPROVED: 'positive',
  DISBURSED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'negative',
  PENDING: 'warning',
  SUBMITTED: 'warning',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function MortgageApplicationsTable({
  rows,
}: {
  rows: MortgageApplication[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Lender' },
    { header: 'Applied', align: 'right' },
    { header: 'Approved', align: 'right' },
    { header: 'Disbursed', align: 'right' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<MortgageApplication>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.lenderName} ${row.status} ${row.amountApplied} ${row.amountApproved ?? ''} ${row.disbursedAmount ?? ''}`,
      cells: [
        row.lenderName,
        formatCurrency(row.amountApplied),
        row.amountApproved !== null
          ? formatCurrency(row.amountApproved)
          : '—',
        row.disbursedAmount !== null
          ? formatCurrency(row.disbursedAmount)
          : '—',
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No mortgage applications for this entity yet."
      search={{
        placeholder: 'Search lender, status or amount…',
      }}
    />
  );
}
