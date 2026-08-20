'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { SubmitBudgetButton } from './SubmitBudgetButton';
import { BudgetDecisionActions } from './BudgetDecisionActions';
import { CloseBudgetButton } from './CloseBudgetButton';

interface Budget {
  id: string;
  code: string;
  name: string;
  fiscalYear: number;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
}

interface VarianceLine {
  budgetLineId: string;
  account: {
    id: string;
    code: string;
    name: string;
  };
  period: number;
  originalAmount: number;
  budgeted: number;
  actual: number;
  committed: number;
  available: number;
  utilizationPercent: number | null;
}

interface BudgetRevisionLineRaw {
  budgetLineId: string;
  previousAmount: number;
  newAmount: number;
}

interface BudgetRevisionRaw {
  id: string;
  revisionNumber: number;
  reason: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
  lines: BudgetRevisionLineRaw[];
}

interface BudgetTransferRaw {
  id: string;
  fromLineId: string;
  toLineId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface BudgetApprovalRaw {
  id: string;
  action: string;
  comments: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  FROZEN: 'positive',
  CLOSED: 'neutral',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function BudgetRegisterTable({
  rows,
}: {
  rows: Budget[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Fiscal year', align: 'right' },
    { header: 'Status' },
    { header: 'Submitted' },
    { header: 'Approved' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Budget>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      <Link
        key={`${row.id}-code`}
        href={`/budgeting/${row.id}`}
        style={{ color: tokens.color.accent }}
      >
        {row.code}
      </Link>,
      row.name,
      String(row.fiscalYear),
      <Badge
        key={`${row.id}-status`}
        tone={STATUS_TONE[row.status] ?? 'neutral'}
      >
        {row.status}
      </Badge>,
      row.submittedAt
        ? new Date(row.submittedAt).toLocaleDateString()
        : '—',
      row.approvedAt
        ? new Date(row.approvedAt).toLocaleDateString()
        : '—',
      row.status === 'SUBMITTED' ? (
        <BudgetDecisionActions
          key={`${row.id}-actions`}
          id={row.id}
          status={row.status}
        />
      ) : row.status === 'APPROVED' ? (
        <CloseBudgetButton
          key={`${row.id}-actions`}
          id={row.id}
          status={row.status}
        />
      ) : (
        <SubmitBudgetButton
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
      emptyMessage="No budgets for this entity yet."
    />
  );
}

export function BudgetVarianceTable({
  rows,
}: {
  rows: VarianceLine[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Account' },
    { header: 'Period', align: 'right' },
    { header: 'Original', align: 'right' },
    { header: 'Budgeted', align: 'right' },
    { header: 'Actual', align: 'right' },
    { header: 'Committed', align: 'right' },
    { header: 'Available', align: 'right' },
    { header: 'Utilization', align: 'right' },
  ];

  const tableRows: DataTableClientRow<VarianceLine>[] = rows.map((row) => ({
    id: row.budgetLineId,
    data: row,
    cells: [
      `${row.account.code} — ${row.account.name}`,
      `Month ${row.period}`,
      formatCurrency(row.originalAmount),
      formatCurrency(row.budgeted),
      formatCurrency(row.actual),
      formatCurrency(row.committed),
      <span
        key={`${row.budgetLineId}-available`}
        style={{
          color:
            row.available < 0
              ? tokens.color.negative
              : undefined,
        }}
      >
        {formatCurrency(row.available)}
      </span>,
      row.utilizationPercent === null
        ? '—'
        : `${row.utilizationPercent}%`,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="This budget has no lines."
    />
  );
}

export function BudgetRevisionHistoryTable({
  rows,
  lineLabels,
}: {
  rows: BudgetRevisionRaw[];
  lineLabels: Record<string, string>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: '#' },
    { header: 'Reason' },
    { header: 'Status' },
    { header: 'Lines changed' },
    { header: 'Approved' },
  ];

  const tableRows: DataTableClientRow<BudgetRevisionRaw>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        String(row.revisionNumber),
        row.reason,
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>,
        <div
          key={`${row.id}-lines`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.space(1),
          }}
        >
          {row.lines.map((line) => (
            <span
              key={line.budgetLineId}
              style={{ fontSize: '12px' }}
            >
              {lineLabels[line.budgetLineId] ?? line.budgetLineId}:{' '}
              {formatCurrency(line.previousAmount)} →{' '}
              {formatCurrency(line.newAmount)}
            </span>
          ))}
        </div>,
        row.approvedAt
          ? new Date(row.approvedAt).toLocaleDateString()
          : '—',
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No revisions yet."
    />
  );
}

export function BudgetTransferHistoryTable({
  rows,
  lineLabels,
}: {
  rows: BudgetTransferRaw[];
  lineLabels: Record<string, string>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'From' },
    { header: 'To' },
    { header: 'Amount', align: 'right' },
    { header: 'Reason' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<BudgetTransferRaw>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        lineLabels[row.fromLineId] ?? row.fromLineId,
        lineLabels[row.toLineId] ?? row.toLineId,
        formatCurrency(row.amount),
        row.reason,
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>,
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No transfers yet."
    />
  );
}

export function BudgetApprovalTrailTable({
  rows,
}: {
  rows: BudgetApprovalRaw[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Action' },
    { header: 'Comments' },
    { header: 'When' },
  ];

  const tableRows: DataTableClientRow<BudgetApprovalRaw>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        row.action,
        row.comments ?? '—',
        new Date(row.createdAt).toLocaleString(),
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No approval events yet."
    />
  );
}
