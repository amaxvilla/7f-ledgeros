'use client';

import { DataTableClient } from '@7f/ui';
import type { DataTableClientColumn, DataTableClientRow } from '@7f/ui';

interface LineItemRow {
  account_id: string;
  account_code: string;
  account_name: string;
  statement_section: string;
  amount?: number;
  closing_balance?: number;
}

type EquityComponent =
  | 'shareCapital'
  | 'sharePremium'
  | 'retainedEarnings'
  | 'revaluationReserve'
  | 'foreignCurrencyTranslationReserve'
  | 'otherReserves';

type EquityRow = Record<EquityComponent, number> & {
  total: number;
};

interface EquityMovement {
  label: string;
  row: EquityRow;
}

const EQUITY_COMPONENT_LABELS: Record<EquityComponent, string> = {
  shareCapital: 'Share capital',
  sharePremium: 'Share premium',
  retainedEarnings: 'Retained earnings',
  revaluationReserve: 'Revaluation reserve',
  foreignCurrencyTranslationReserve: 'FX translation reserve',
  otherReserves: 'Other reserves',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function FinancialLineItemsTable({
  rows,
  emptyMessage,
}: {
  rows: LineItemRow[];
  emptyMessage: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Section' },
    { header: 'Code' },
    { header: 'Account' },
    { header: 'Amount', align: 'right' },
  ];

  const tableRows: DataTableClientRow<LineItemRow>[] = rows.map((row) => ({
    id: row.account_id,
    data: row,
    cells: [
      row.statement_section.replace(/_/g, ' '),
      row.account_code,
      row.account_name,
      formatCurrency(row.amount ?? row.closing_balance ?? 0),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage={emptyMessage}
    />
  );
}

export function FinancialEquityTable({
  rows,
  components,
}: {
  rows: EquityMovement[];
  components: EquityComponent[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Movement' },
    ...components.map((component) => ({
      header: EQUITY_COMPONENT_LABELS[component],
      align: 'right' as const,
    })),
    { header: 'Total', align: 'right' as const },
  ];

  const tableRows: DataTableClientRow<EquityMovement>[] = rows.map((row) => ({
    id: row.label,
    data: row,
    cells: [
      row.label,
      ...components.map((component) =>
        formatCurrency(row.row[component]),
      ),
      formatCurrency(row.row.total),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No equity movements for this period."
    />
  );
}
