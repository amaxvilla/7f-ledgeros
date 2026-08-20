'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface Agent {
  id: string;
  code: string;
  agentType: 'INDIVIDUAL' | 'COMPANY' | 'BROKER';
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  displayName: string;
  email: string;
  phone: string;
  licenseExpiryDate: string | null;
}

interface AgentStatementCalculation {
  id: string;
  allocationId: string;
  netCommission: string | number;
  status:
    | 'CALCULATED'
    | 'PENDING'
    | 'APPROVED'
    | 'PAYABLE'
    | 'PAID'
    | 'REJECTED'
    | 'REVERSED'
    | 'CANCELLED';
  calculatedAt: string;
}

const STATUS_TONE: Record<
  Agent['status'],
  'neutral' | 'positive' | 'warning' | 'negative'
> = {
  PENDING_APPROVAL: 'warning',
  ACTIVE: 'positive',
  SUSPENDED: 'negative',
  TERMINATED: 'neutral',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const TYPE_FILTER_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'BROKER', label: 'Broker' },
];

const COMMISSION_STATUS_TONE: Record<
  AgentStatementCalculation['status'],
  'neutral' | 'positive' | 'warning' | 'negative'
> = {
  CALCULATED: 'neutral',
  PENDING: 'warning',
  APPROVED: 'warning',
  PAYABLE: 'warning',
  PAID: 'positive',
  REJECTED: 'negative',
  REVERSED: 'negative',
  CANCELLED: 'neutral',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function AgentsTable({
  rows,
}: {
  rows: Agent[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Email' },
    { header: 'Phone' },
    { header: 'License expiry' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Agent>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.code} ${row.displayName} ${row.email} ${row.phone}`,
    filterValues: [row.status, row.agentType],
    cells: [
      (
        <Link
          key={`${row.id}-code`}
          href={`/agents/${row.id}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          {row.code}
        </Link>
      ),
      row.displayName,
      row.agentType,
      row.email,
      row.phone,
      row.licenseExpiryDate
        ? new Date(row.licenseExpiryDate).toLocaleDateString()
        : '—',
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status]}
        >
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No agents registered for this entity yet."      search={{ placeholder: 'Search name, code, email, phone…' }}
      filters={[
        {
          label: 'Status',
          options: STATUS_FILTER_OPTIONS,
        },
        {
          label: 'Type',
          options: TYPE_FILTER_OPTIONS,
        },
      ]}
    />
  );
}

export function AgentCommissionTable({
  rows,
}: {
  rows: AgentStatementCalculation[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Calculation' },
    { header: 'Sale allocation' },
    { header: 'Status' },
    { header: 'Net commission', align: 'right' },
    { header: 'Calculated' },
  ];

  const tableRows: DataTableClientRow<AgentStatementCalculation>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        row.id.slice(0, 8),
        row.allocationId.slice(0, 8),
        (
          <Badge
            key={`${row.id}-status`}
            tone={COMMISSION_STATUS_TONE[row.status]}
          >
            {row.status}
          </Badge>
        ),
        formatCurrency(Number(row.netCommission)),
        new Date(row.calculatedAt).toLocaleDateString(),
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No commission calculations for this agent yet."
    />
  );
}
