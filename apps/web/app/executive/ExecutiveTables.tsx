'use client';

import { DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(value);
}
interface CashForecastRow {
  days: number;
  outflow: number;
  inflow: number;
  net: number;
}

interface TopVarianceProject {
  projectId: string;
  projectName: string;
  budgeted: number;
  actual: number;
  variance: number;
}

interface ExecutiveTablesProps {
  cashForecast: CashForecastRow[];
  topVarianceProjects: TopVarianceProject[];
}

export function ExecutiveTables({
  cashForecast,
  topVarianceProjects,
}: ExecutiveTablesProps) {
  const cashForecastColumns: DataTableClientColumn[] = [
    { header: 'Horizon' },
    { header: 'Inflow', align: 'right' },
    { header: 'Outflow', align: 'right' },
    { header: 'Net', align: 'right' },
  ];

  const cashForecastRows: DataTableClientRow<CashForecastRow>[] =
    cashForecast.map((row) => ({
      id: String(row.days),
      data: row,
      cells: [
        `${row.days} days`,
        formatCurrency(row.inflow),
        formatCurrency(row.outflow),
        formatCurrency(row.net),
      ],
    }));

  const projectColumns: DataTableClientColumn[] = [
    { header: 'Project' },
    { header: 'Budgeted', align: 'right' },
    { header: 'Actual', align: 'right' },
    { header: 'Variance', align: 'right' },
  ];

  const projectRows: DataTableClientRow<TopVarianceProject>[] =
    topVarianceProjects.map((row) => ({
      id: row.projectId,
      data: row,
      cells: [
        row.projectName,
        formatCurrency(row.budgeted),
        formatCurrency(row.actual),
        <span
          key={`${row.projectId}-variance`}
          style={{
            color:
              row.variance >= 0
                ? tokens.color.positive
                : tokens.color.negative,
          }}
        >
          {formatCurrency(row.variance)}
        </span>,
      ],
    }));

  return (
    <>
      <section style={{ marginBottom: tokens.space(8) }}>
        <DataTableClient
          columns={cashForecastColumns}
          rows={cashForecastRows}
          emptyMessage="No cash forecast data for this entity yet."
        />
      </section>

      <section>
        <DataTableClient
          columns={projectColumns}
          rows={projectRows}
          emptyMessage="No approved budgets for this entity yet."
        />
      </section>
    </>
  );
}

