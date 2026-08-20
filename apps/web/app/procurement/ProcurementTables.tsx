'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { RequisitionStatusActions } from './RequisitionStatusActions';
import { PurchaseOrderStatusActions } from './PurchaseOrderStatusActions';

interface Requisition {
  id: string;
  prNumber: string;
  status: string;
  projectId: string | null;
  justification: string | null;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  orderDate: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  code: string;
  name: string;
}

const PR_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'negative',
  CLOSED: 'neutral',
};

const PO_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  PARTIALLY_RECEIVED: 'warning',
  FULLY_RECEIVED: 'positive',
  PARTIALLY_INVOICED: 'warning',
  FULLY_INVOICED: 'positive',
  CLOSED: 'neutral',
  CANCELLED: 'negative',
};

export function ProcurementRequisitionsTable({
  rows,
}: {
  rows: Requisition[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'PR #' },
    { header: 'Justification' },
    { header: 'Created' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Requisition>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.prNumber} ${row.justification ?? ''} ${row.status}`,
    cells: [
      row.prNumber,
      row.justification ?? '—',
      new Date(row.createdAt).toLocaleDateString(),
      (
        <Badge
          key={`${row.id}-status`}
          tone={PR_STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      (
        <RequisitionStatusActions
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
      emptyMessage="No requisitions for this entity yet."
    />
  );
}

export function ProcurementPurchaseOrdersTable({
  rows,
  vendors,
}: {
  rows: PurchaseOrder[];
  vendors: Vendor[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'PO #' },
    { header: 'Vendor' },
    { header: 'Order date' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const vendorMap = new Map(
    vendors.map((vendor) => [vendor.id, vendor.name]),
  );

  const tableRows: DataTableClientRow<PurchaseOrder>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.poNumber} ${vendorMap.get(row.vendorId) ?? row.vendorId} ${row.status}`,
    cells: [
      row.poNumber,
      vendorMap.get(row.vendorId) ?? row.vendorId,
      new Date(row.orderDate).toLocaleDateString(),
      (
        <Badge
          key={`${row.id}-status`}
          tone={PO_STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      (
        <PurchaseOrderStatusActions
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
      emptyMessage="No purchase orders for this entity yet."
    />
  );
}
