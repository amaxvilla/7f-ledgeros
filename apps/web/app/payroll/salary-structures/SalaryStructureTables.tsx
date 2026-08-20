'use client';

import { DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface SalaryStructure {
  id: string;
  code: string;
  name: string;
  basicSalary?: number | string | null;
  housingAllowance?: number | string | null;
  transportAllowance?: number | string | null;
  otherAllowances?: number | string | null;
}

function displayAmount(value: number | string | null | undefined): string {
  return value == null ? 'Masked' : String(value);
}

export function SalaryStructuresTable({
  rows,
}: {
  rows: SalaryStructure[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Basic salary', align: 'right' },
    { header: 'Housing', align: 'right' },
    { header: 'Transport', align: 'right' },
    { header: 'Other', align: 'right' },
  ];

  const tableRows: DataTableClientRow<SalaryStructure>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: [
      row.code,
      row.name,
      displayAmount(row.basicSalary),
      displayAmount(row.housingAllowance),
      displayAmount(row.transportAllowance),
      displayAmount(row.otherAllowances),
    ].join(' '),
    cells: [
      row.code,
      row.name,
      displayAmount(row.basicSalary),
      displayAmount(row.housingAllowance),
      displayAmount(row.transportAllowance),
      displayAmount(row.otherAllowances),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No salary structures exist for this entity."
      search={{
        placeholder: 'Search code, name or salary structure amounts…',
      }}
    />
  );
}
