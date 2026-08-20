'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface PaymentTransaction {
  id: string;
  reference: string;
  providerCode: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string;
  createdAt: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  SUCCESSFUL: 'positive',
  FAILED: 'negative',
  PENDING: 'warning',
  ABANDONED: 'neutral',
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatMinorUnits(amount: number, currency: string): string {
  return formatCurrency(amount / 100, currency);
}

export function PaymentsTable({
  rows,
}: {
  rows: PaymentTransaction[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Reference' },
    { header: 'Provider' },
    { header: 'Customer' },
    { header: 'Amount', align: 'right' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<PaymentTransaction>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.reference} ${row.providerCode} ${row.customerEmail} ${row.status} ${row.amount}`,
      cells: [
        row.reference,
        (
          <Badge
            key={`${row.id}-provider`}
            tone="neutral"
          >
            {row.providerCode}
          </Badge>
        ),
        row.customerEmail,
        formatMinorUnits(row.amount, row.currency),
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
      emptyMessage="No payment transactions for this entity yet."
      search={{
        placeholder: 'Search reference, provider, customer or status…',
      }}
    />
  );
}
