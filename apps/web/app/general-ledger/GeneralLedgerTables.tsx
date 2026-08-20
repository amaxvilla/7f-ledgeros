'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { JournalEntryStatusActions } from './JournalEntryStatusActions';

interface JournalLine {
  id: string;
  accountId: string;
  debit: string | number;
  credit: string | number;
  memo: string | null;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  entryDate: string;
  description: string;
  status: string;
  lines: JournalLine[];
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountCategory: string;
  isActive: boolean;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'warning',
  POSTED: 'positive',
  REVERSED: 'negative',
  REJECTED: 'negative',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function lineTotal(lines: JournalLine[], field: 'debit' | 'credit'): number {
  return lines.reduce((sum, line) => sum + Number(line[field]), 0);
}

export function GeneralLedgerJournalEntriesTable({
  rows,
}: {
  rows: JournalEntry[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Journal #' },
    { header: 'Date' },
    { header: 'Description' },
    { header: 'Debit', align: 'right' },
    { header: 'Credit', align: 'right' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<JournalEntry>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.journalNumber,
      new Date(row.entryDate).toLocaleDateString(),
      row.description,
      formatCurrency(lineTotal(row.lines, 'debit')),
      formatCurrency(lineTotal(row.lines, 'credit')),
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      (
        <JournalEntryStatusActions
          key={`${row.id}-actions`}
          id={row.id}
          status={row.status}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No journal entries for this entity yet."
    />
  );
}

export function GeneralLedgerAccountsTable({
  rows,
}: {
  rows: Account[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Category' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Account>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.code} ${row.name}`,
    cells: [
      row.code,
      row.name,
      row.accountType,
      row.accountCategory,
      (
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No accounts configured yet."
      search={{ placeholder: 'Search by code or name…' }}
    />
  );
}
