'use client';

import Link from 'next/link';
import { Badge, DataTable, tokens } from '@7f/ui';
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
import { WorkPackageStatusActions } from './WorkPackageStatusActions';

export interface WorkPackageTableRow {
  id: string;
  projectId: string;
  code: string;
  name: string;
  budgetAmount: number;
  status: string;
  createdAt: string;
  contractorName: string;
  projectLabel: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'positive',
  CERTIFIED: 'positive',
  REJECTED: 'negative',
};

export function WorkPackagesTable({ rows }: { rows: WorkPackageTableRow[] }) {
  return (
    <DataTable
      columns={[
        { header: 'Code', render: (wp: WorkPackageTableRow) => wp.code },
        { header: 'Name', render: (wp: WorkPackageTableRow) => wp.name },
        {
          header: 'Project',
          render: (wp: WorkPackageTableRow) => wp.projectLabel || wp.projectId,
        },
        {
          header: 'Contractor',
          render: (wp: WorkPackageTableRow) => wp.contractorName,
        },
        {
          header: 'Budget',
          align: 'right',
          render: (wp: WorkPackageTableRow) =>
            formatCurrency(Number(wp.budgetAmount)),
        },
        {
          header: 'Status',
          render: (wp: WorkPackageTableRow) => (
            <Badge tone={STATUS_TONE[wp.status] ?? 'neutral'}>
              {wp.status}
            </Badge>
          ),
        },
        {
          header: 'Created',
          render: (wp: WorkPackageTableRow) =>
            new Date(wp.createdAt).toLocaleDateString(),
        },
        {
          header: 'View',
          render: (wp: WorkPackageTableRow) => (
            <Link
              href={`/work-packages/${wp.id}`}
              style={{
                color: tokens.color.accent,
                fontFamily: tokens.font.body,
                fontSize: '13px',
              }}
            >
              Progress →
            </Link>
          ),
        },
        {
          header: 'Actions',
          align: 'right',
          render: (wp: WorkPackageTableRow) => (
            <WorkPackageStatusActions
              id={wp.id}
              status={wp.status}
            />
          ),
        },
      ]}
      rows={rows}
      keyOf={(wp) => wp.id}
      emptyMessage="No work packages logged yet."
    />
  );
}
