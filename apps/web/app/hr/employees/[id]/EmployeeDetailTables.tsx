'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { CompleteTaskButton } from './CompleteTaskButton';

interface DirectReport {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

interface OnboardingTask {
  id: string;
  taskName: string;
  status: string;
  dueDate: string | null;
}

interface EmploymentEvent {
  id: string;
  eventType: string;
  effectiveDate: string;
}

interface ClearanceItem {
  id: string;
  department: string;
  item: string;
  status: string;
}

const columns = {
  directReports: [
    { header: 'Name' },
    { header: 'Job title' },
  ] satisfies DataTableClientColumn[],

  onboarding: [
    { header: 'Task' },
    { header: 'Due' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ] satisfies DataTableClientColumn[],

  history: [
    { header: 'Event' },
    { header: 'Effective date' },
  ] satisfies DataTableClientColumn[],

  clearance: [
    { header: 'Department' },
    { header: 'Item' },
    { header: 'Status' },
  ] satisfies DataTableClientColumn[],
};

export function EmployeeDirectReportsTable({
  rows,
}: {
  rows: DirectReport[];
}) {
  const tableRows: DataTableClientRow<DirectReport>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      <Link
        key={row.id + '-name'}
        href={'/hr/employees/' + row.id}
        style={{ color: tokens.color.accent }}
      >
        {row.firstName} {row.lastName}
      </Link>,
      row.jobTitle ?? '?',
    ],
  }));

  return (
    <DataTableClient
      columns={columns.directReports}
      rows={tableRows}
      emptyMessage="No direct reports."
    />
  );
}

export function EmployeeOnboardingTable({
  rows,
  employeeId,
}: {
  rows: OnboardingTask[];
  employeeId: string;
}) {
  const tableRows: DataTableClientRow<OnboardingTask>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.taskName,
      row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '?',
      <Badge
        key={row.id + '-status'}
        tone={row.status === 'COMPLETED' ? 'positive' : 'neutral'}
      >
        {row.status}
      </Badge>,
      <CompleteTaskButton
        key={row.id + '-action'}
        taskId={row.id}
        employeeId={employeeId}
        status={row.status}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns.onboarding}
      rows={tableRows}
      emptyMessage="Onboarding hasn't been started for this employee."
    />
  );
}

export function EmployeeEmploymentHistoryTable({
  rows,
}: {
  rows: EmploymentEvent[];
}) {
  const tableRows: DataTableClientRow<EmploymentEvent>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.eventType,
      new Date(row.effectiveDate).toLocaleDateString(),
    ],
  }));

  return (
    <DataTableClient
      columns={columns.history}
      rows={tableRows}
      emptyMessage="No employment events logged yet."
    />
  );
}

export function EmployeeClearanceTable({
  rows,
}: {
  rows: ClearanceItem[];
}) {
  const tableRows: DataTableClientRow<ClearanceItem>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.department,
      row.item,
      <Badge
        key={row.id + '-status'}
        tone={row.status === 'CLEARED' ? 'positive' : 'neutral'}
      >
        {row.status}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns.clearance}
      rows={tableRows}
      emptyMessage="No clearance items."
    />
  );
}
