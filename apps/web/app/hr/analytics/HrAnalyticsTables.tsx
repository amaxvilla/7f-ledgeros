'use client';

import { Badge, DataTable } from '@7f/ui';
import { formatCurrency } from '../../../lib/format';

interface DepartmentRow {
  department: string;
  count: number;
}

interface BreakdownRow {
  label: string;
  count: number;
}

interface LeaveUtilizationRow {
  leaveType: string;
  entitledDays: number;
  usedDays: number;
  utilizationPercent: number;
}

interface AttendanceRow {
  status: string;
  count: number;
}

interface PayrollCostRow {
  department: string;
  amount: number;
}

function attendanceTone(
  status: string,
): 'positive' | 'negative' | 'warning' | 'neutral' {
  switch (status) {
    case 'PRESENT':
      return 'positive';
    case 'LATE':
      return 'warning';
    case 'ABSENT':
      return 'negative';
    default:
      return 'neutral';
  }
}

export function DepartmentTable({
  rows,
}: {
  rows: DepartmentRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Department',
          render: (row: DepartmentRow) => row.department,
        },
        {
          header: 'Headcount',
          align: 'right',
          render: (row: DepartmentRow) => String(row.count),
        },
      ]}
      rows={rows}
      keyOf={(row) => row.department}
      emptyMessage="No active employees found."
    />
  );
}

export function BreakdownTable({
  rows,
}: {
  rows: BreakdownRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Category',
          render: (row: BreakdownRow) => row.label,
        },
        {
          header: 'Count',
          align: 'right',
          render: (row: BreakdownRow) => String(row.count),
        },
      ]}
      rows={rows}
      keyOf={(row) => row.label}
      emptyMessage="No data available."
    />
  );
}

export function LeaveUtilizationTable({
  rows,
}: {
  rows: LeaveUtilizationRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Leave type',
          render: (row: LeaveUtilizationRow) => row.leaveType,
        },
        {
          header: 'Entitled days',
          align: 'right',
          render: (row: LeaveUtilizationRow) =>
            row.entitledDays.toFixed(2),
        },
        {
          header: 'Used days',
          align: 'right',
          render: (row: LeaveUtilizationRow) =>
            row.usedDays.toFixed(2),
        },
        {
          header: 'Utilization',
          align: 'right',
          render: (row: LeaveUtilizationRow) =>
            `${row.utilizationPercent.toFixed(1)}%`,
        },
      ]}
      rows={rows}
      keyOf={(row) => row.leaveType}
      emptyMessage="No leave balances found for this year."
    />
  );
}

export function AttendanceTable({
  rows,
}: {
  rows: AttendanceRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Status',
          render: (row: AttendanceRow) => (
            <Badge tone={attendanceTone(row.status)}>
              {row.status}
            </Badge>
          ),
        },
        {
          header: 'Records',
          align: 'right',
          render: (row: AttendanceRow) => String(row.count),
        },
      ]}
      rows={rows}
      keyOf={(row) => row.status}
      emptyMessage="No attendance records in the selected period."
    />
  );
}

export function PayrollCostTable({
  rows,
}: {
  rows: PayrollCostRow[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Department',
          render: (row: PayrollCostRow) => row.department,
        },
        {
          header: 'Monthly cost',
          align: 'right',
          render: (row: PayrollCostRow) =>
            formatCurrency(row.amount),
        },
      ]}
      rows={rows}
      keyOf={(row) => row.department}
      emptyMessage="No payroll cost data available."
    />
  );
}
