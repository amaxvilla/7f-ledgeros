'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface FixedAsset {
  id: string;
  assetTag: string;
  name: string;
  acquisitionDate: string;
  acquisitionCost: number;
  status: string;
  assetCategory: {
    name: string;
  };
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  FULLY_DEPRECIATED: 'neutral',
  DISPOSED: 'negative',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function FixedAssetsTable({
  rows,
}: {
  rows: FixedAsset[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Tag' },
    { header: 'Name' },
    { header: 'Category' },
    { header: 'Acquired' },
    { header: 'Cost' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<FixedAsset>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.assetTag} ${row.name} ${row.assetCategory.name} ${row.status}`,
    cells: [
      row.assetTag,
      row.name,
      row.assetCategory.name,
      new Date(row.acquisitionDate).toLocaleDateString(),
      formatCurrency(row.acquisitionCost),
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No fixed assets for this entity yet."
      search={{
        placeholder: 'Search tag, name, category or status…',
      }}
    />
  );
}
