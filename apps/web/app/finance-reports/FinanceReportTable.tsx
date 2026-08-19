'use client';

import { DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

type AnyRow = Record<string, unknown>;

function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatCurrency(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function asRows(value: unknown): AnyRow[] {
  if (Array.isArray(value)) return value as AnyRow[];

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    for (const key of ['rows', 'data', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as AnyRow[];
    }

    return [obj];
  }

  return [];
}

export function FinanceReportTable({
  value,
  emptyMessage,
}: {
  value: unknown;
  emptyMessage: string;
}) {
  const rows = asRows(value);

  if (!rows.length) {
    return (
      <div style={{ padding: 16, color: 'var(--ledgeros-text-secondary)' }}>
        {emptyMessage}
      </div>
    );
  }

  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const columns: DataTableClientColumn[] = keys.map((key) => ({
    header: key.replace(/_/g, ' '),
  }));

  const tableRows: DataTableClientRow<AnyRow>[] = rows.map((row, index) => ({
    id: String(
      row.id ??
        row.key ??
        row.code ??
        row.account_id ??
        row.account_code ??
        `row-${index}`,
    ),
    data: row,
    cells: keys.map((key) => displayValue(row[key])),
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage={emptyMessage}
    />
  );
}
