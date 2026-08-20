'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { CalculationLifecycleControls } from './CalculationLifecycleControls';

interface CommissionCalculation {
  id: string;
  agentId: string;
  agentAssignmentId: string;
  allocationId: string;
  commissionPlanId: string;
  basisType: 'GROSS' | 'NET';
  grossSaleValue: string | number;
  discountAmount: string | number;
  netSaleValue: string | number;
  collectionBasis: 'FULL' | 'COLLECTED';
  collectedPercent: string | number | null;
  proratedBasisAmount: string | number;
  grossCommission: string | number;
  whtApplied: boolean;
  whtAmount: string | number;
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
  CommissionCalculation['status'],
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

function money(value: string | number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CommissionCalculationsTable({
  rows,
  accountOptions,
}: {
  rows: CommissionCalculation[];
  accountOptions: { value: string; label: string }[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Agent' },
    { header: 'Assignment' },
    { header: 'Sale allocation' },
    { header: 'Basis' },
    { header: 'Gross commission' },
    { header: 'WHT' },
    { header: 'Net commission' },
    { header: 'Calculated' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<CommissionCalculation>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.agentId} ${row.agentAssignmentId} ${row.allocationId} ${row.status}`,
      filterValues: [row.status],
      cells: [
        row.agentId,
        row.agentAssignmentId,
        row.allocationId,
        `${row.basisType}${
          row.collectionBasis === 'COLLECTED'
            ? ` (${
                row.collectedPercent != null
                  ? `${(Number(row.collectedPercent) * 100).toFixed(1)}% collected`
                  : 'collected'
              })`
            : ''
        }`,
        money(row.grossCommission),
        row.whtApplied ? money(row.whtAmount) : '—',
        money(row.netCommission),
        new Date(row.calculatedAt).toLocaleString(),
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status]}
          >
            {row.status}
          </Badge>
        ),
        (
          <CalculationLifecycleControls
            key={`${row.id}-actions`}
            id={row.id}
            status={row.status}
            accountOptions={accountOptions}
          />
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No commissions calculated for this entity yet."
      search={{
        placeholder: 'Search agent, assignment, allocation…',
      }}
      filters={[
        {
          label: 'Status',
          options: [
            { value: 'CALCULATED', label: 'Calculated' },
            { value: 'PENDING', label: 'Pending approval' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'PAYABLE', label: 'Payable' },
            { value: 'PAID', label: 'Paid' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'REVERSED', label: 'Reversed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ],
        },
      ]}
    />
  );
}
