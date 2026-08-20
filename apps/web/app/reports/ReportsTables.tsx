'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type { DataTableClientColumn, DataTableClientRow } from '@7f/ui';
import type { ReactNode } from 'react';

interface AgingRow {
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  invoice_total: number;
  open_balance: number;
  days_past_due: number;
  aging_bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

interface VendorAgingRow extends AgingRow {
  vendor_invoice_id: string;
  vendor_name: string;
}

interface CustomerAgingRow extends AgingRow {
  ar_invoice_id: string;
  customer_name: string;
}

interface ProjectProfitabilityRow {
  project_id: string;
  project_code: string;
  project_name: string;
  revenue_amount: number;
  cost_amount: number;
  profit_amount: number;
  margin_pct: number | null;
}

interface BankReconciliationSummaryRow {
  bank_account_id: string;
  account_name: string;
  account_number: string;
  session_status: 'DRAFT' | 'APPROVED' | null;
  session_date: string | null;
  unmatched_count: number;
}

interface CashForecastRow {
  horizon_days: number;
  outflow_due: number;
  inflow_due: number;
  net_due: number;
}

interface FixedAssetRegisterRow {
  fixed_asset_id: string;
  asset_tag: string;
  asset_name: string;
  category_name: string;
  acquisition_date: string;
  acquisition_cost: number;
  status: 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
  last_depreciated_period: string | null;
  net_book_value: number;
}

interface PaymentTransactionRegisterRow {
  payment_transaction_id: string;
  reference: string;
  provider_code: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'ABANDONED';
  total_refunded: number;
  net_amount: number;
  paid_at: string | null;
}

interface MonoLinkedAccountRegisterRow {
  mono_linked_account_id: string;
  institution_name: string | null;
  account_number_masked: string | null;
  currency: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'REQUIRES_REAUTH';
  linked_at: string;
  last_synced_at: string | null;
}

interface CommissionByAgentRow {
  agentId: string;
  agentCode: string;
  agentName: string;
  earned: number;
  paid: number;
  outstanding: number;
  count: number;
}

interface CommissionByProjectRow {
  projectId: string;
  projectCode: string;
  earned: number;
  paid: number;
  outstanding: number;
  count: number;
}

interface CommissionAgingRow {
  commissionCalculationId: string;
  agentCode: string;
  agentName: string;
  netCommission: number;
  daysOutstanding: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

interface CommissionForecastStage {
  status: string;
  label: string;
  amount: number;
  count: number;
}

type TableType =
  | 'vendor-aging'
  | 'customer-aging'
  | 'project-profitability'
  | 'bank-reconciliation'
  | 'cash-forecast'
  | 'fixed-assets'
  | 'payments'
  | 'mono-linked-accounts'
  | 'commission-by-agent'
  | 'commission-by-project'
  | 'commission-aging'
  | 'commission-forecast';

type ReportsTableProps = {
  type: 'vendor-aging';
  rows: VendorAgingRow[];
} | {
  type: 'customer-aging';
  rows: CustomerAgingRow[];
} | {
  type: 'project-profitability';
  rows: ProjectProfitabilityRow[];
} | {
  type: 'bank-reconciliation';
  rows: BankReconciliationSummaryRow[];
} | {
  type: 'cash-forecast';
  rows: CashForecastRow[];
} | {
  type: 'fixed-assets';
  rows: FixedAssetRegisterRow[];
} | {
  type: 'payments';
  rows: PaymentTransactionRegisterRow[];
} | {
  type: 'mono-linked-accounts';
  rows: MonoLinkedAccountRegisterRow[];
} | {
  type: 'commission-by-agent';
  rows: CommissionByAgentRow[];
} | {
  type: 'commission-by-project';
  rows: CommissionByProjectRow[];
} | {
  type: 'commission-aging';
  rows: CommissionAgingRow[];
} | {
  type: 'commission-forecast';
  rows: CommissionForecastStage[];
};

const BUCKET_TONE: Record<
  AgingRow['aging_bucket'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  current: 'positive',
  '1-30': 'neutral',
  '31-60': 'warning',
  '61-90': 'warning',
  '90+': 'negative',
};

const FIXED_ASSET_STATUS_TONE: Record<
  FixedAssetRegisterRow['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  FULLY_DEPRECIATED: 'neutral',
  DISPOSED: 'negative',
};

const PAYMENT_STATUS_TONE: Record<
  PaymentTransactionRegisterRow['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  SUCCESSFUL: 'positive',
  FAILED: 'negative',
  PENDING: 'warning',
  ABANDONED: 'neutral',
};

const MONO_LINK_STATUS_TONE: Record<
  MonoLinkedAccountRegisterRow['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  REVOKED: 'negative',
  REQUIRES_REAUTH: 'warning',
};

function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMinorUnits(amount: number, currency: string): string {
  return formatCurrency(amount / 100, currency);
}

function tableRows<T>(
  rows: T[],
  id: (row: T) => string,
  cells: (row: T) => ReactNode[],
): DataTableClientRow<T>[] {
  return rows.map((row) => ({
    id: id(row),
    data: row,
    cells: cells(row),
  }));
}

function renderTable<T>(
  columns: DataTableClientColumn[],
  rows: DataTableClientRow<T>[],
  emptyMessage: string,
) {
  return (
    <DataTableClient
      columns={columns}
      rows={rows}
      emptyMessage={emptyMessage}
    />
  );
}

export function ReportsTable(props: ReportsTableProps) {
  switch (props.type) {
    case 'vendor-aging':
      return renderTable(
        [
          { header: 'Vendor' },
          { header: 'Invoice #' },
          { header: 'Invoice date' },
          { header: 'Due date' },
          { header: 'Invoice total', align: 'right' },
          { header: 'Open balance', align: 'right' },
          { header: 'Days past due', align: 'right' },
          { header: 'Bucket' },
        ],
        tableRows(
          props.rows,
          (row) => row.vendor_invoice_id,
          (row) => [
            row.vendor_name,
            row.invoice_number,
            new Date(row.invoice_date).toLocaleDateString(),
            row.due_date
              ? new Date(row.due_date).toLocaleDateString()
              : '—',
            formatCurrency(row.invoice_total),
            formatCurrency(row.open_balance),
            String(row.days_past_due),
            <Badge key="bucket" tone={BUCKET_TONE[row.aging_bucket]}>
              {row.aging_bucket}
            </Badge>,
          ],
        ),
        'No open vendor invoices.',
      );

    case 'customer-aging':
      return renderTable(
        [
          { header: 'Customer' },
          { header: 'Invoice #' },
          { header: 'Invoice date' },
          { header: 'Due date' },
          { header: 'Invoice total', align: 'right' },
          { header: 'Open balance', align: 'right' },
          { header: 'Days past due', align: 'right' },
          { header: 'Bucket' },
        ],
        tableRows(
          props.rows,
          (row) => row.ar_invoice_id,
          (row) => [
            row.customer_name,
            row.invoice_number,
            new Date(row.invoice_date).toLocaleDateString(),
            row.due_date
              ? new Date(row.due_date).toLocaleDateString()
              : '—',
            formatCurrency(row.invoice_total),
            formatCurrency(row.open_balance),
            String(row.days_past_due),
            <Badge key="bucket" tone={BUCKET_TONE[row.aging_bucket]}>
              {row.aging_bucket}
            </Badge>,
          ],
        ),
        'No open customer invoices.',
      );

    case 'project-profitability':
      return renderTable(
        [
          { header: 'Project' },
          { header: 'Revenue', align: 'right' },
          { header: 'Cost', align: 'right' },
          { header: 'Profit', align: 'right' },
          { header: 'Margin', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => row.project_id,
          (row) => [
            `${row.project_code} — ${row.project_name}`,
            formatCurrency(row.revenue_amount),
            formatCurrency(row.cost_amount),
            <span
              key="profit"
              style={{
                color:
                  row.profit_amount >= 0
                    ? undefined
                    : tokens.color.negative,
              }}
            >
              {formatCurrency(row.profit_amount)}
            </span>,
            row.margin_pct === null
              ? '—'
              : `${(row.margin_pct * 100).toFixed(1)}%`,
          ],
        ),
        'No project profitability data.',
      );

    case 'bank-reconciliation':
      return renderTable(
        [
          { header: 'Account' },
          { header: 'Account number' },
          { header: 'Latest session' },
          { header: 'Session status' },
          { header: 'Unmatched lines', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => row.bank_account_id,
          (row) => [
            row.account_name,
            row.account_number,
            row.session_date
              ? new Date(row.session_date).toLocaleDateString()
              : 'No sessions yet',
            row.session_status ? (
              <Badge
                key="status"
                tone={
                  row.session_status === 'APPROVED'
                    ? 'positive'
                    : 'neutral'
                }
              >
                {row.session_status}
              </Badge>
            ) : (
              '—'
            ),
            String(row.unmatched_count),
          ],
        ),
        'No active bank accounts.',
      );

    case 'cash-forecast':
      return renderTable(
        [
          { header: 'Horizon' },
          { header: 'Outflow due (AP)', align: 'right' },
          { header: 'Inflow due (AR)', align: 'right' },
          { header: 'Net', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => String(row.horizon_days),
          (row) => [
            `${row.horizon_days} days`,
            formatCurrency(row.outflow_due),
            formatCurrency(row.inflow_due),
            <span
              key="net"
              style={{
                color:
                  row.net_due >= 0 ? undefined : tokens.color.negative,
              }}
            >
              {formatCurrency(row.net_due)}
            </span>,
          ],
        ),
        'No forecast data.',
      );

    case 'fixed-assets':
      return renderTable(
        [
          { header: 'Asset tag' },
          { header: 'Name' },
          { header: 'Category' },
          { header: 'Status' },
          { header: 'Acquisition date' },
          { header: 'Acquisition cost', align: 'right' },
          { header: 'Last depreciated' },
          { header: 'Net book value', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => row.fixed_asset_id,
          (row) => [
            row.asset_tag,
            row.asset_name,
            row.category_name,
            <Badge
              key="status"
              tone={FIXED_ASSET_STATUS_TONE[row.status]}
            >
              {row.status}
            </Badge>,
            new Date(row.acquisition_date).toLocaleDateString(),
            formatCurrency(row.acquisition_cost),
            row.last_depreciated_period
              ? new Date(row.last_depreciated_period).toLocaleDateString()
              : '—',
            formatCurrency(row.net_book_value),
          ],
        ),
        'No fixed assets recorded.',
      );

    case 'payments':
      return renderTable(
        [
          { header: 'Reference' },
          { header: 'Provider' },
          { header: 'Status' },
          { header: 'Amount', align: 'right' },
          { header: 'Refunded', align: 'right' },
          { header: 'Net', align: 'right' },
          { header: 'Paid at' },
        ],
        tableRows(
          props.rows,
          (row) => row.payment_transaction_id,
          (row) => [
            row.reference,
            row.provider_code,
            <Badge
              key="status"
              tone={PAYMENT_STATUS_TONE[row.status]}
            >
              {row.status}
            </Badge>,
            formatMinorUnits(row.amount, row.currency),
            formatMinorUnits(row.total_refunded, row.currency),
            formatMinorUnits(row.net_amount, row.currency),
            row.paid_at
              ? new Date(row.paid_at).toLocaleDateString()
              : '—',
          ],
        ),
        'No payment transactions recorded.',
      );

    case 'mono-linked-accounts':
      return renderTable(
        [
          { header: 'Institution' },
          { header: 'Account' },
          { header: 'Currency' },
          { header: 'Status' },
          { header: 'Linked' },
          { header: 'Last synced' },
        ],
        tableRows(
          props.rows,
          (row) => row.mono_linked_account_id,
          (row) => [
            row.institution_name ?? '—',
            row.account_number_masked ?? '—',
            row.currency ?? '—',
            <Badge
              key="status"
              tone={MONO_LINK_STATUS_TONE[row.status]}
            >
              {row.status}
            </Badge>,
            new Date(row.linked_at).toLocaleDateString(),
            row.last_synced_at
              ? new Date(row.last_synced_at).toLocaleDateString()
              : 'Never',
          ],
        ),
        'No linked bank accounts.',
      );

    case 'commission-by-agent':
      return renderTable(
        [
          { header: 'Agent' },
          { header: 'Calculations', align: 'right' },
          { header: 'Earned', align: 'right' },
          { header: 'Paid', align: 'right' },
          { header: 'Outstanding', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => row.agentId,
          (row) => [
            `${row.agentCode} — ${row.agentName}`,
            String(row.count),
            formatCurrency(row.earned),
            formatCurrency(row.paid),
            <span
              key="outstanding"
              style={{
                color:
                  row.outstanding > 0
                    ? tokens.color.warning
                    : undefined,
              }}
            >
              {formatCurrency(row.outstanding)}
            </span>,
          ],
        ),
        'No commission calculations yet.',
      );

    case 'commission-by-project':
      return renderTable(
        [
          { header: 'Project' },
          { header: 'Calculations', align: 'right' },
          { header: 'Earned', align: 'right' },
          { header: 'Paid', align: 'right' },
          { header: 'Outstanding', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => row.projectId,
          (row) => [
            row.projectCode,
            String(row.count),
            formatCurrency(row.earned),
            formatCurrency(row.paid),
            formatCurrency(row.outstanding),
          ],
        ),
        'No commission calculations tied to a project yet.',
      );

    case 'commission-aging':
      return renderTable(
        [
          { header: 'Agent' },
          { header: 'Net commission', align: 'right' },
          { header: 'Days outstanding', align: 'right' },
          { header: 'Bucket' },
        ],
        tableRows(
          props.rows,
          (row) => row.commissionCalculationId,
          (row) => [
            `${row.agentCode} — ${row.agentName}`,
            formatCurrency(row.netCommission),
            String(row.daysOutstanding),
            <Badge key="bucket" tone={BUCKET_TONE[row.bucket]}>
              {row.bucket}
            </Badge>,
          ],
        ),
        'No commission currently marked payable.',
      );

    case 'commission-forecast':
      return renderTable(
        [
          { header: 'Stage' },
          { header: 'Calculations', align: 'right' },
          { header: 'Amount', align: 'right' },
        ],
        tableRows(
          props.rows,
          (row) => row.status,
          (row) => [
            row.label,
            String(row.count),
            formatCurrency(row.amount),
          ],
        ),
        'No unpaid commission in the pipeline.',
      );
  }
}
