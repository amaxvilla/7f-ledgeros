'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface InstallmentLine {
  id: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidAt: string | null;
}

interface UnitRow {
  id: string;
  code: string;
  name: string | null;
  unitType: string | null;
  sizeSqm: number | null;
  listPrice: number;
  status: string;
  phaseLabel: string;
  blockLabel: string;
  floorLabel: string;
}

interface AllocationEvent {
  id: string;
  eventType: string;
  reservationId: string | null;
  allocationId: string | null;
  fromCustomer: { id: string; name: string } | null;
  toCustomer: { id: string; name: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  notes: string | null;
  createdAt: string;
}

const UNIT_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  AVAILABLE: 'positive',
  RESERVED: 'warning',
  ALLOCATED: 'warning',
  UNDER_CONTRACT: 'warning',
  HANDED_OVER: 'neutral',
  SOLD: 'positive',
};

const EVENT_TYPE_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  RESERVED: 'warning',
  RESERVATION_EXPIRED: 'negative',
  RESERVATION_CANCELLED: 'negative',
  CONVERTED_TO_SALE: 'positive',
  SALE_CANCELLED: 'negative',
  TRANSFERRED: 'neutral',
  SWAPPED: 'neutral',
  RESOLD: 'positive',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function CustomerStatementInstallmentsTable({
  rows,
}: {
  rows: InstallmentLine[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Due date' },
    { header: 'Amount due', align: 'right' },
    { header: 'Amount paid', align: 'right' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<InstallmentLine>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.dueDate).toLocaleDateString(),
      formatCurrency(row.amountDue),
      formatCurrency(row.amountPaid),
      <Badge
        key={`${row.id}-status`}
        tone={row.paidAt ? 'positive' : 'neutral'}
      >
        {row.paidAt ? 'Paid' : 'Outstanding'}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No installment schedule for this allocation yet."
    />
  );
}

export function RealEstateUnitsTable({
  rows,
  entityId,
  projectId,
}: {
  rows: UnitRow[];
  entityId: string;
  projectId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Unit' },
    { header: 'Phase / Block / Floor' },
    { header: 'Type' },
    { header: 'Size (sqm)', align: 'right' },
    { header: 'List price', align: 'right' },
    { header: 'Status' },
    { header: 'View', align: 'right' },
  ];

  const tableRows: DataTableClientRow<UnitRow>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.name ? `${row.code} — ${row.name}` : row.code,
      `${row.phaseLabel} / ${row.blockLabel} / ${row.floorLabel}`,
      row.unitType ?? '—',
      row.sizeSqm === null ? '—' : String(row.sizeSqm),
      formatCurrency(row.listPrice),
      <Badge
        key={`${row.id}-status`}
        tone={UNIT_STATUS_TONE[row.status] ?? 'neutral'}
      >
        {row.status}
      </Badge>,
      <Link
        key={`${row.id}-view`}
        href={`/real-estate/sales/${row.id}?entityId=${encodeURIComponent(entityId)}&projectId=${encodeURIComponent(projectId)}`}
        style={{
          color: tokens.color.accent,
          fontFamily: tokens.font.body,
          fontSize: '13px',
        }}
      >
        View
      </Link>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="This project has no units yet."
    />
  );
}

export function UnitInstallmentsTable({
  rows,
}: {
  rows: InstallmentLine[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Due date' },
    { header: 'Amount due', align: 'right' },
    { header: 'Amount paid', align: 'right' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<InstallmentLine>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.dueDate).toLocaleDateString(),
      formatCurrency(row.amountDue),
      formatCurrency(row.amountPaid),
      <Badge
        key={`${row.id}-status`}
        tone={row.paidAt ? 'positive' : 'neutral'}
      >
        {row.paidAt ? 'Paid' : 'Outstanding'}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="This schedule has no installments."
    />
  );
}

export function AllocationHistoryTable({
  rows,
}: {
  rows: AllocationEvent[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Event' },
    { header: 'From' },
    { header: 'To' },
    { header: 'By' },
    { header: 'Notes' },
    { header: 'When' },
  ];

  const tableRows: DataTableClientRow<AllocationEvent>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      <Badge
        key={`${row.id}-event`}
        tone={EVENT_TYPE_TONE[row.eventType] ?? 'neutral'}
      >
        {row.eventType}
      </Badge>,
      row.fromCustomer?.name ?? '—',
      row.toCustomer?.name ?? '—',
      `${row.createdBy.firstName} ${row.createdBy.lastName}`,
      row.notes ?? '—',
      new Date(row.createdAt).toLocaleString(),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No allocation events for this unit yet."
    />
  );
}
