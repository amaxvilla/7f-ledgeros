'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface ProjectVariance {
  projectId: string;
  projectName: string;
  budgeted: number;
  actual: number;
  variance: number;
}

interface BankAccountStatus {
  bankAccountId: string;
  accountName: string;
  status: string;
  unmatchedCount: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function DashboardProjectVarianceTable({
  rows,
}: {
  rows: ProjectVariance[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Project' },
    { header: 'Budgeted', align: 'right' },
    { header: 'Actual', align: 'right' },
    { header: 'Variance', align: 'right' },
  ];

  const tableRows: DataTableClientRow<ProjectVariance>[] = rows.map((row) => ({
    id: row.projectId,
    data: row,
    searchText: `${row.projectName} ${row.budgeted} ${row.actual} ${row.variance}`,
    cells: [
      row.projectName,
      formatCurrency(row.budgeted),
      formatCurrency(row.actual),
      (
        <Badge
          key={`${row.projectId}-variance`}
          tone={row.variance >= 0 ? 'positive' : 'negative'}
        >
          {formatCurrency(row.variance)}
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No approved budgets with project-level lines yet."
    />
  );
}

export function DashboardBankReconciliationTable({
  rows,
}: {
  rows: BankAccountStatus[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Account' },
    { header: 'Status' },
    { header: 'Unmatched lines', align: 'right' },
  ];

  const tableRows: DataTableClientRow<BankAccountStatus>[] = rows.map((row) => ({
    id: row.bankAccountId,
    data: row,
    searchText: `${row.accountName} ${row.status} ${row.unmatchedCount}`,
    cells: [
      row.accountName,
      (
        <Badge
          key={`${row.bankAccountId}-status`}
          tone={
            row.status === 'APPROVED'
              ? 'positive'
              : row.status === 'NOT_STARTED'
                ? 'neutral'
                : 'warning'
          }
        >
          {row.status}
        </Badge>
      ),
      String(row.unmatchedCount),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No active bank accounts for this entity."
    />
  );
}
