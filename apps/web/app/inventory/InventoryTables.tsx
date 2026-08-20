'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface StockItem {
  id: string;
  code: string;
  name: string;
  domain: string;
  unitOfMeasure: string;
  isActive: boolean;
}

export function InventoryWarehousesTable({
  rows,
}: {
  rows: Warehouse[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Warehouse>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
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
      emptyMessage="No warehouses for this entity yet."
    />
  );
}

export function InventoryStockItemsTable({
  rows,
}: {
  rows: StockItem[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Domain' },
    { header: 'UoM' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<StockItem>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
      row.domain,
      row.unitOfMeasure,
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
      emptyMessage="No stock items for this entity yet."
    />
  );
}
