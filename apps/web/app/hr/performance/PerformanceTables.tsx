'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { CycleStatusActions } from './CycleStatusActions';

interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CALIBRATION' | 'CLOSED';
}

interface Review {
  id: string;
  employeeId: string;
  cycleId: string;
  status:
    | 'DRAFT'
    | 'SELF_ASSESSMENT'
    | 'MANAGER_REVIEW'
    | 'PEER_REVIEW'
    | 'CALIBRATED'
    | 'COMPLETED';
  selfRating: number | null;
  managerRating: number | null;
  calibratedRating: number | null;
}

const cycleTone: Record<
  Cycle['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  OPEN: 'positive',
  CALIBRATION: 'warning',
  CLOSED: 'neutral',
};

const reviewTone: Record<
  Review['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  SELF_ASSESSMENT: 'warning',
  MANAGER_REVIEW: 'warning',
  PEER_REVIEW: 'warning',
  CALIBRATED: 'positive',
  COMPLETED: 'positive',
};

export function PerformanceCyclesTable({
  rows,
}: {
  rows: Cycle[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Name' },
    { header: 'Start' },
    { header: 'End' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Cycle>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.name,
      new Date(row.startDate).toLocaleDateString(),
      new Date(row.endDate).toLocaleDateString(),
      <Badge key={row.id + '-status'} tone={cycleTone[row.status]}>
        {row.status}
      </Badge>,
      <CycleStatusActions
        key={row.id + '-action'}
        id={row.id}
        status={row.status}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No performance cycles yet."
    />
  );
}

export function PerformanceReviewsTable({
  rows,
  employeeNames,
  cycleNames,
}: {
  rows: Review[];
  employeeNames: Record<string, string>;
  cycleNames: Record<string, string>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Employee' },
    { header: 'Cycle' },
    { header: 'Self', align: 'right' },
    { header: 'Manager', align: 'right' },
    { header: 'Calibrated', align: 'right' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Review>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      <Link
        key={row.id + '-employee'}
        href={'/hr/performance/' + row.id}
        style={{ color: tokens.color.accent }}
      >
        {employeeNames[row.employeeId] ?? row.employeeId}
      </Link>,
      cycleNames[row.cycleId] ?? row.cycleId,
      row.selfRating != null ? String(row.selfRating) : '?',
      row.managerRating != null ? String(row.managerRating) : '?',
      row.calibratedRating != null ? String(row.calibratedRating) : '?',
      <Badge key={row.id + '-status'} tone={reviewTone[row.status]}>
        {row.status}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No reviews started for this entity's cycles yet."
    />
  );
}
