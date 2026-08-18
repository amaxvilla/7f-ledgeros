'use client';

import { DataTable } from '@7f/ui';
import { formatCurrency } from '../../lib/format';

export interface UnsoldUnitsRow {
  entity_id: string;
  project_id: string;
  project_code: string;
  available_count: number | string;
  reserved_count: number | string;
  under_contract_count: number | string;
  total_unsold_count: number | string;
  total_unsold_value: number | string | null;
}

export interface AgeingBucketRow {
  bucket: string;
  unitCount: number;
  totalListPrice: number;
}

export interface SalesVelocityRow {
  entity_id: string;
  project_id: string;
  project_code: string;
  sale_month: string;
  units_sold: number | string;
  total_sale_value: number | string | null;
  avg_days_to_sell: number | string | null;
}

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export function RealEstateUnsoldTable({
  rows,
}: {
  rows: UnsoldUnitsRow[];
}) {
  return (
    <DataTable
      columns={[
        { header: 'Project', render: (r) => r.project_code },
        { header: 'Available', align: 'right', render: (r) => String(num(r.available_count)) },
        { header: 'Reserved', align: 'right', render: (r) => String(num(r.reserved_count)) },
        { header: 'Under contract', align: 'right', render: (r) => String(num(r.under_contract_count)) },
        { header: 'Total unsold', align: 'right', render: (r) => String(num(r.total_unsold_count)) },
        { header: 'Total unsold value', align: 'right', render: (r) => formatCurrency(num(r.total_unsold_value)) },
      ]}
      rows={rows}
      keyOf={(r) => r.project_id}
      emptyMessage="No projects with unsold units for this entity."
    />
  );
}

export function RealEstateAgeingTable({
  rows,
}: {
  rows: AgeingBucketRow[];
}) {
  return (
    <DataTable
      columns={[
        { header: 'Age band', render: (r) => `${r.bucket} days` },
        { header: 'Units', align: 'right', render: (r) => String(r.unitCount) },
        { header: 'Total list price', align: 'right', render: (r) => formatCurrency(r.totalListPrice) },
      ]}
      rows={rows}
      keyOf={(r) => r.bucket}
      emptyMessage="No unsold inventory for this entity."
    />
  );
}

export function RealEstateSalesVelocityTable({
  rows,
}: {
  rows: SalesVelocityRow[];
}) {
  return (
    <DataTable
      columns={[
        { header: 'Project', render: (r) => r.project_code },
        {
          header: 'Month',
          render: (r) =>
            new Date(r.sale_month).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            }),
        },
        { header: 'Units sold', align: 'right', render: (r) => String(num(r.units_sold)) },
        { header: 'Sale value', align: 'right', render: (r) => formatCurrency(num(r.total_sale_value)) },
        {
          header: 'Avg. days to sell',
          align: 'right',
          render: (r) =>
            r.avg_days_to_sell !== null
              ? `${Math.round(num(r.avg_days_to_sell) * 100) / 100} days`
              : '—',
        },
      ]}
      rows={rows}
      keyOf={(r) => `${r.project_id}-${r.sale_month}`}
      emptyMessage="No sales recorded for this entity yet."
    />
  );
}
