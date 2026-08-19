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
import { ProgressValuationStatusActions } from './ProgressValuationStatusActions';
import { VariationOrderStatusActions } from './VariationOrderStatusActions';

export interface ProgressValuationTableRow {
  id: string;
  valuationNumber: number;
  valuationDate: string;
  percentComplete: number;
  valuationAmount: number;
  status: string;
  certificate: {
    id: string;
    certificateNumber: string;
    status: string;
    netPayableAmount: number;
  } | null;
}

export interface RetentionReleaseTableRow {
  id: string;
  amount: number;
  releaseDate: string;
}

export interface VariationOrderTableRow {
  id: string;
  voNumber: string;
  description: string;
  amount: number;
  status: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  REVIEWED: 'warning',
  APPROVED: 'positive',
  CERTIFIED: 'positive',
  REJECTED: 'negative',
};

export function ProgressValuationsTable({
  workPackageId,
  rows,
}: {
  workPackageId: string;
  rows: ProgressValuationTableRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: '#',
          render: (v: ProgressValuationTableRow) =>
            String(v.valuationNumber),
        },
        {
          header: 'Date',
          render: (v: ProgressValuationTableRow) =>
            new Date(v.valuationDate).toLocaleDateString(),
        },
        {
          header: '% complete',
          align: 'right',
          render: (v: ProgressValuationTableRow) =>
            `${v.percentComplete}%`,
        },
        {
          header: 'Valuation amount',
          align: 'right',
          render: (v: ProgressValuationTableRow) =>
            formatCurrency(Number(v.valuationAmount)),
        },
        {
          header: 'Certificate',
          render: (v: ProgressValuationTableRow) => {
            if (v.certificate) {
              return (
                <span>
                  {v.certificate.certificateNumber} ·{' '}
                  {v.certificate.status} ·{' '}
                  {formatCurrency(Number(v.certificate.netPayableAmount))}
                </span>
              );
            }

            if (v.status === 'APPROVED') {
              return <span>Generate certificate</span>;
            }

            return <span>—</span>;
          },
        },
        {
          header: 'Status',
          render: (v: ProgressValuationTableRow) => (
            <Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>
              {v.status}
            </Badge>
          ),
        },
        {
          header: 'Actions',
          align: 'right',
          render: (v: ProgressValuationTableRow) => (
            <ProgressValuationStatusActions
              id={v.id}
              status={v.status}
              workPackageId={workPackageId}
            />
          ),
        },
      ]}
      rows={rows}
      keyOf={(v) => v.id}
      emptyMessage="No progress valuations logged yet."
    />
  );
}

export function RetentionReleasesTable({
  rows,
}: {
  rows: RetentionReleaseTableRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Release date',
          render: (r: RetentionReleaseTableRow) =>
            new Date(r.releaseDate).toLocaleDateString(),
        },
        {
          header: 'Amount',
          align: 'right',
          render: (r: RetentionReleaseTableRow) =>
            formatCurrency(Number(r.amount)),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.id}
      emptyMessage="No retention releases logged yet."
    />
  );
}

export function VariationOrdersTable({
  workPackageId,
  rows,
}: {
  workPackageId: string;
  rows: VariationOrderTableRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'VO #',
          render: (v: VariationOrderTableRow) => v.voNumber,
        },
        {
          header: 'Description',
          render: (v: VariationOrderTableRow) => v.description,
        },
        {
          header: 'Amount',
          align: 'right',
          render: (v: VariationOrderTableRow) =>
            formatCurrency(Number(v.amount)),
        },
        {
          header: 'Status',
          render: (v: VariationOrderTableRow) => (
            <Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>
              {v.status}
            </Badge>
          ),
        },
        {
          header: 'Actions',
          align: 'right',
          render: (v: VariationOrderTableRow) => (
            <VariationOrderStatusActions
              id={v.id}
              status={v.status}
              workPackageId={workPackageId}
            />
          ),
        },
      ]}
      rows={rows}
      keyOf={(v) => v.id}
      emptyMessage="No variation orders logged yet."
    />
  );
}
