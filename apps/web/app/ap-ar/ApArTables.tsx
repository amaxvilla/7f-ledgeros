'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { PostAPInvoiceButton } from './PostAPInvoiceButton';
import { PostARInvoiceButton } from './PostARInvoiceButton';

interface CashForecastHorizon {
  days: number;
  outflow: number;
  inflow: number;
  net: number;
}

interface APInvoiceLine {
  quantity: number;
  unitCost: number;
}

interface APInvoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  purchaseOrderId: string | null;
  lines: APInvoiceLine[];
}

interface ARInvoiceLine {
  quantity: number;
  unitPrice: number;
}

interface ARInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  lines: ARInvoiceLine[];
}

const AP_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  PENDING_MATCH: 'warning',
  MATCHED: 'warning',
  MATCHED_WITH_VARIANCE: 'negative',
  POSTED: 'positive',
  CANCELLED: 'negative',
};

const AR_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  POSTED: 'positive',
  CANCELLED: 'negative',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function CashForecastTable({
  rows,
}: {
  rows: CashForecastHorizon[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Horizon' },
    { header: 'Outflow (AP due)', align: 'right' },
    { header: 'Inflow (AR due)', align: 'right' },
    { header: 'Net', align: 'right' },
  ];

  const tableRows: DataTableClientRow<CashForecastHorizon>[] = rows.map(
    (row) => ({
      id: String(row.days),
      data: row,
      cells: [
        `${row.days} days`,
        formatCurrency(row.outflow),
        formatCurrency(row.inflow),
        (
          <span
            key={`${row.days}-net`}
            style={{
              color:
                row.net < 0
                  ? tokens.color.negative
                  : tokens.color.positive,
            }}
          >
            {formatCurrency(row.net)}
          </span>
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No cash forecast data for this entity yet."
    />
  );
}

export function APInvoiceTable({
  rows,
  accountOptions,
}: {
  rows: APInvoice[];
  accountOptions: Array<{ value: string; label: string }>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Invoice #' },
    { header: 'Vendor' },
    { header: 'Total', align: 'right' },
    { header: 'Status' },
    { header: 'Invoice date' },
    { header: 'Due' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<APInvoice>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.invoiceNumber,
      row.vendorId,
      formatCurrency(
        row.lines.reduce(
          (sum, line) =>
            sum + Number(line.quantity) * Number(line.unitCost),
          0,
        ),
      ),
      (
        <Badge
          key={`${row.id}-status`}
          tone={AP_STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      new Date(row.invoiceDate).toLocaleDateString(),
      row.dueDate
        ? new Date(row.dueDate).toLocaleDateString()
        : '—',
      (
        <PostAPInvoiceButton
          key={`${row.id}-action`}
          id={row.id}
          status={row.status}
          purchaseOrderId={row.purchaseOrderId}
          accountOptions={accountOptions}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No AP invoices for this entity yet."
    />
  );
}

export function ARInvoiceTable({
  rows,
  accountOptions,
}: {
  rows: ARInvoice[];
  accountOptions: Array<{ value: string; label: string }>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Invoice #' },
    { header: 'Customer' },
    { header: 'Total', align: 'right' },
    { header: 'Status' },
    { header: 'Invoice date' },
    { header: 'Due' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<ARInvoice>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.invoiceNumber,
      row.customerId,
      formatCurrency(
        row.lines.reduce(
          (sum, line) =>
            sum + Number(line.quantity) * Number(line.unitPrice),
          0,
        ),
      ),
      (
        <Badge
          key={`${row.id}-status`}
          tone={AR_STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      new Date(row.invoiceDate).toLocaleDateString(),
      row.dueDate
        ? new Date(row.dueDate).toLocaleDateString()
        : '—',
      (
        <PostARInvoiceButton
          key={`${row.id}-action`}
          id={row.id}
          status={row.status}
          accountOptions={accountOptions}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No AR invoices for this entity yet."
    />
  );
}
