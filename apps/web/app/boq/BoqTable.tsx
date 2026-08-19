'use client';

import { Badge, DataTable } from '@7f/ui';
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
import { BoqStatusActions } from './BoqStatusActions';

export interface BoqTableRow {
  id: string;
  projectId: string;
  title: string;
  status: string;
  createdAt: string;
  lineTotal: number;
  projectLabel: string;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'positive',
  CERTIFIED: 'positive',
  REJECTED: 'negative',
};

export function BoqTable({ rows }: { rows: BoqTableRow[] }) {
  return (
    <DataTable
      columns={[
        { header: 'Title', render: (b: BoqTableRow) => b.title },
        { header: 'Project', render: (b: BoqTableRow) => b.projectLabel || b.projectId },
        {
          header: 'Lines total',
          align: 'right',
          render: (b: BoqTableRow) => formatCurrency(b.lineTotal),
        },
        {
          header: 'Status',
          render: (b: BoqTableRow) => (
            <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status}</Badge>
          ),
        },
        {
          header: 'Created',
          render: (b: BoqTableRow) => new Date(b.createdAt).toLocaleDateString(),
        },
        {
          header: 'Actions',
          align: 'right',
          render: (b: BoqTableRow) => (
            <BoqStatusActions id={b.id} status={b.status} />
          ),
        },
      ]}
      rows={rows}
      keyOf={(b) => b.id}
      emptyMessage="No BOQs logged yet."
    />
  );
}
