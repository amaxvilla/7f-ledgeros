'use client';

import { DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface UnmatchedStatementLine {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  classification: string;
}

interface UnmatchedBookLine {
  id: string;
  entryDate: string;
  debit: number;
  credit: number;
  classification: string;
}

export function UnmatchedStatementLinesTable({
  rows,
}: {
  rows: UnmatchedStatementLine[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Description' },
    { header: 'Amount', align: 'right' },
    { header: 'Classification' },
  ];

  const tableRows: DataTableClientRow<UnmatchedStatementLine>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        new Date(row.transactionDate).toLocaleDateString(),
        row.description,
        String(row.amount),
        row.classification.replace(/_/g, ' '),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No unmatched statement lines."
    />
  );
}

export function UnmatchedBookLinesTable({
  rows,
}: {
  rows: UnmatchedBookLine[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Debit', align: 'right' },
    { header: 'Credit', align: 'right' },
    { header: 'Classification' },
  ];

  const tableRows: DataTableClientRow<UnmatchedBookLine>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        new Date(row.entryDate).toLocaleDateString(),
        String(row.debit),
        String(row.credit),
        row.classification.replace(/_/g, ' '),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No unmatched book lines."
    />
  );
}
