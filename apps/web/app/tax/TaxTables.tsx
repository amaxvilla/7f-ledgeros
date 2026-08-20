'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface TaxCode {
  id: string;
  code: string;
  name: string;
  taxType: 'WHT' | 'VAT';
  rate: number;
  jurisdiction: string | null;
  isActive: boolean;
}

const TAX_TYPE_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  WHT: 'warning',
  VAT: 'neutral',
};

export function TaxCodesTable({
  rows,
}: {
  rows: TaxCode[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Rate' },
    { header: 'Jurisdiction' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<TaxCode>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: [
      row.code,
      row.name,
      row.taxType,
      `${(row.rate * 100).toFixed(2)}%`,
      row.jurisdiction ?? '',
      row.isActive ? 'Active' : 'Inactive',
    ].join(' '),
    cells: [
      row.code,
      row.name,
      (
        <Badge
          key={`${row.id}-type`}
          tone={TAX_TYPE_TONE[row.taxType] ?? 'neutral'}
        >
          {row.taxType}
        </Badge>
      ),
      `${(row.rate * 100).toFixed(2)}%`,
      row.jurisdiction ?? '—',
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
      emptyMessage="No tax codes configured yet."
      search={{
        placeholder: 'Search code, name, type or jurisdiction…',
      }}
    />
  );
}
