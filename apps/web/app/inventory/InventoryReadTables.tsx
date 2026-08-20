'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

export interface InventoryReceiptLine {
  id: string;
  stockItemId: string;
  quantity: string | number;
  unitCost: string | number;
}

export interface InventoryReceiptRow {
  id: string;
  warehouseId: string;
  vendorId?: string | null;
  receiptDate: string;
  referenceNumber?: string | null;
  status: string;
  createdById: string;
  createdAt: string;
  lines: InventoryReceiptLine[];
}

export interface InventoryIssueLine {
  id: string;
  stockItemId: string;
  quantity: string | number;
}

export interface InventoryIssueRow {
  id: string;
  warehouseId: string;
  projectId?: string | null;
  costCenterId?: string | null;
  issueDate: string;
  purpose?: string | null;
  status: string;
  createdById: string;
  createdAt: string;
  lines: InventoryIssueLine[];
}

export interface InventoryTransferLine {
  id: string;
  stockItemId: string;
  quantity: string | number;
}

export interface InventoryTransferRow {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  status: string;
  createdById: string;
  createdAt: string;
  lines: InventoryTransferLine[];
}

export interface InventoryCountLine {
  id: string;
  stockItemId: string;
  countedQuantity: string | number;
  systemQuantity: string | number;
  varianceQuantity: string | number;
}

export interface InventoryCountRow {
  id: string;
  warehouseId: string;
  countDate: string;
  status: string;
  createdById: string;
  createdAt: string;
  lines: InventoryCountLine[];
}

export interface InventoryMovementRow {
  id: string;
  stockItemId: string;
  warehouseId: string;
  movementType: string;
  quantity: string | number;
  unitCost: string | number;
  totalCost: string | number;
  movementDate: string;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  stockItem?: {
    id: string;
    code: string;
    name: string;
    unitOfMeasure: string;
  } | null;
  warehouse?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatNumber(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString();
}

function statusTone(status: string) {
  if (status === 'POSTED') return 'positive' as const;
  if (status === 'CANCELLED') return 'negative' as const;
  return 'neutral' as const;
}

export function InventoryReceiptsTable({
  rows,
}: {
  rows: InventoryReceiptRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Warehouse' },
    { header: 'Reference' },
    { header: 'Lines' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<InventoryReceiptRow>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      formatDate(row.receiptDate),
      row.warehouseId,
      row.referenceNumber ?? '—',
      String(row.lines.length),
      <Badge key={`${row.id}-status`} tone={statusTone(row.status)}>
        {row.status}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No goods receipts found."
    />
  );
}

export function InventoryIssuesTable({
  rows,
}: {
  rows: InventoryIssueRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Warehouse' },
    { header: 'Purpose' },
    { header: 'Lines' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<InventoryIssueRow>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      formatDate(row.issueDate),
      row.warehouseId,
      row.purpose ?? '—',
      String(row.lines.length),
      <Badge key={`${row.id}-status`} tone={statusTone(row.status)}>
        {row.status}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No material issues found."
    />
  );
}

export function InventoryTransfersTable({
  rows,
}: {
  rows: InventoryTransferRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'From' },
    { header: 'To' },
    { header: 'Lines' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<InventoryTransferRow>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      formatDate(row.transferDate),
      row.fromWarehouseId,
      row.toWarehouseId,
      String(row.lines.length),
      <Badge key={`${row.id}-status`} tone={statusTone(row.status)}>
        {row.status}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No stock transfers found."
    />
  );
}

export function InventoryCountsTable({
  rows,
}: {
  rows: InventoryCountRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Warehouse' },
    { header: 'Lines' },
    { header: 'Variance' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<InventoryCountRow>[] = rows.map((row) => {
    const variance = row.lines.reduce(
      (sum, line) => sum + Number(line.varianceQuantity),
      0,
    );

    return {
      id: row.id,
      data: row,
      cells: [
        formatDate(row.countDate),
        row.warehouseId,
        String(row.lines.length),
        formatNumber(variance),
        <Badge key={`${row.id}-status`} tone={statusTone(row.status)}>
          {row.status}
        </Badge>,
      ],
    };
  });

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No stock counts found."
    />
  );
}

export function InventoryMovementsTable({
  rows,
}: {
  rows: InventoryMovementRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Movement' },
    { header: 'Stock Item' },
    { header: 'Warehouse' },
    { header: 'Quantity' },
    { header: 'Total Cost' },
    { header: 'Reference' },
  ];

  const tableRows: DataTableClientRow<InventoryMovementRow>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      formatDate(row.movementDate),
      <Badge key={`${row.id}-movement`} tone="neutral">
        {row.movementType}
      </Badge>,
      row.stockItem
        ? `${row.stockItem.code} — ${row.stockItem.name}`
        : row.stockItemId,
      row.warehouse
        ? `${row.warehouse.code} — ${row.warehouse.name}`
        : row.warehouseId,
      `${formatNumber(row.quantity)}${row.stockItem?.unitOfMeasure ? ` ${row.stockItem.unitOfMeasure}` : ''}`,
      formatNumber(row.totalCost),
      row.referenceType
        ? `${row.referenceType}${row.referenceId ? ` / ${row.referenceId}` : ''}`
        : '—',
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No stock movements found."
    />
  );
}