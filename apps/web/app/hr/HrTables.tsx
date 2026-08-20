'use client';

import Link from 'next/link';
import { Badge, DataTable, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { LeaveRequestActions } from './leave/LeaveRequestActions';
import { formatCurrency } from '../../lib/format';

export interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';
  source: string;
  notes: string | null;
}

export interface Employee {
  id: string;
  entityId: string;
  departmentId: string | null;
  salaryStructureId: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  jobTitle?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  department?: { name: string } | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason: string | null;
}

const ATTENDANCE_STATUS_TONE: Record<
  AttendanceRecord['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PRESENT: 'positive',
  ABSENT: 'negative',
  LATE: 'warning',
  HALF_DAY: 'warning',
  ON_LEAVE: 'neutral',
  HOLIDAY: 'neutral',
};

const EMPLOYEE_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PROBATION: 'warning',
  CONFIRMED: 'positive',
  TERMINATED: 'negative',
  RESIGNED: 'negative',
  ON_LEAVE: 'warning',
};

const LEAVE_STATUS_TONE: Record<
  LeaveRequest['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'neutral',
};

function attendanceRows(
  rows: AttendanceRecord[],
): DataTableClientRow<AttendanceRecord>[] {
  return rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.date).toLocaleDateString(),
      row.clockIn ? new Date(row.clockIn).toLocaleTimeString() : '?',
      row.clockOut ? new Date(row.clockOut).toLocaleTimeString() : '?',
      <Badge key={`${row.id}-status`} tone={ATTENDANCE_STATUS_TONE[row.status]}>
        {row.status}
      </Badge>,
      row.source,
    ],
  }));
}

export function AttendanceTable({
  rows,
}: {
  rows: AttendanceRecord[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Clock in' },
    { header: 'Clock out' },
    { header: 'Status' },
    { header: 'Source' },
  ];

  return (
    <DataTableClient
      columns={columns}
      rows={attendanceRows(rows)}
      emptyMessage="No attendance records for this employee."
    />
  );
}

export function EmployeesTable({
  rows,
}: {
  rows: Employee[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Department' },
    { header: 'Job title' },
    { header: 'Type' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Employee>[] = rows.map((employee) => ({
    id: employee.id,
    data: employee,
    cells: [
      employee.employeeCode,
      <Link
        key={`${employee.id}-name`}
        href={`/hr/employees/${employee.id}`}
        style={{ color: tokens.color.accent }}
      >
        {employee.firstName} {employee.lastName}
      </Link>,
      employee.department?.name ?? '?',
      employee.jobTitle ?? '?',
      employee.employmentType ?? '?',
      <Badge
        key={`${employee.id}-status`}
        tone={EMPLOYEE_STATUS_TONE[employee.employmentStatus ?? ''] ?? 'neutral'}
      >
        {employee.employmentStatus ?? 'ACTIVE'}
      </Badge>,
      <Link
        key={`${employee.id}-action`}
        href={`/hr/employees/${employee.id}`}
        style={{
          color: tokens.color.accent,
          fontFamily: tokens.font.body,
          fontSize: '13px',
        }}
      >
        View ?
      </Link>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No employees yet."
    />
  );
}

export function LeaveRequestsTable({
  rows,
  employeeNames,
  leaveTypeNames,
}: {
  rows: LeaveRequest[];
  employeeNames: Record<string, string>;
  leaveTypeNames: Record<string, string>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Employee' },
    { header: 'Type' },
    { header: 'From' },
    { header: 'To' },
    { header: 'Days', align: 'right' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<LeaveRequest>[] = rows.map((request) => ({
    id: request.id,
    data: request,
    cells: [
      employeeNames[request.employeeId] ?? request.employeeId,
      leaveTypeNames[request.leaveTypeId] ?? request.leaveTypeId,
      new Date(request.startDate).toLocaleDateString(),
      new Date(request.endDate).toLocaleDateString(),
      String(request.daysRequested),
      <Badge
        key={`${request.id}-status`}
        tone={LEAVE_STATUS_TONE[request.status]}
      >
        {request.status}
      </Badge>,
      <LeaveRequestActions
        key={`${request.id}-actions`}
        id={request.id}
        status={request.status}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No leave requests for this entity's employees."
    />
  );
}

export interface DepartmentRow {
  department: string;
  headcount: number;
  monthlyPayrollCost: number;
}

export interface StageRow {
  stage: string;
  count: number;
}

export function HrDepartmentTable({ rows }: { rows: DepartmentRow[] }) {
  return (
    <DataTable
      columns={[
        {
          header: 'Department',
          render: (r: DepartmentRow) => r.department,
        },
        {
          header: 'Headcount',
          align: 'right',
          render: (r: DepartmentRow) => String(r.headcount),
        },
        {
          header: 'Monthly payroll cost',
          align: 'right',
          render: (r: DepartmentRow) => formatCurrency(r.monthlyPayrollCost),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.department}
      emptyMessage="No active employees for this entity yet."
    />
  );
}

export function HrHiringTable({ rows }: { rows: StageRow[] }) {
  return (
    <DataTable
      columns={[
        {
          header: 'Stage',
          render: (r: StageRow) => r.stage,
        },
        {
          header: 'Applications',
          align: 'right',
          render: (r: StageRow) => String(r.count),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.stage}
      emptyMessage="No job applications for this entity yet."
    />
  );
}
