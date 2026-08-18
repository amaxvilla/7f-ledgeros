'use client';

import { DataTable } from '@7f/ui';
import { formatCurrency } from '../../lib/format';

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
