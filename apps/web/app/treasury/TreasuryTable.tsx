'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { formatCurrency } from '../../lib/format';

type MaybeMasked = number | string;

export interface LoanFacility {
  id: string;
  lenderName: string;
  facilityAmount: MaybeMasked;
  currency: string;
  interestRatePercent: MaybeMasked;
  status: string;
  startDate: string;
  maturityDate: string;
  drawdowns: unknown[];
  repaymentSchedule: unknown[];
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  CLOSED: 'neutral',
  DEFAULTED: 'negative',
};

function renderMaybeMasked(
  value: MaybeMasked,
  currency: string,
): string {
  return typeof value === 'number'
    ? formatCurrency(value, currency)
    : value;
}

export function TreasuryTable({
  rows,
  emptyMessage,
}: {
  rows: LoanFacility[];
  emptyMessage: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Lender' },
    { header: 'Facility amount', align: 'right' },
    { header: 'Interest rate', align: 'right' },
    { header: 'Status' },
    { header: 'Maturity' },
    { header: 'Drawdowns', align: 'right' },
  ];

  const tableRows: DataTableClientRow<LoanFacility>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: [
        row.lenderName,
        row.status,
        row.maturityDate,
      ].join(' '),
      cells: [
        row.lenderName,
        renderMaybeMasked(row.facilityAmount, row.currency),
        typeof row.interestRatePercent === 'number'
          ? `${row.interestRatePercent}%`
          : row.interestRatePercent,
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        new Date(row.maturityDate).toLocaleDateString(),
        String(row.drawdowns.length),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage={emptyMessage}
      search={{ placeholder: 'Search loan facilities...' }}
    />
  );
}
