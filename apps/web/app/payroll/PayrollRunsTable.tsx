'use client';

import { Badge, DataTable } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { PayrollRunActions } from './PayrollRunActions';

export interface PayrollRunRow {
  id: string;
  entityId: string;
  payPeriodName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED';
  journalEntryId: string | null;
  _count: {
    payslips: number;
  };
}

export function PayrollRunsTable({
  rows,
  accountOptions,
}: {
  rows: PayrollRunRow[];
  accountOptions: SelectOption[];
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Pay Period',
          render: (r: PayrollRunRow) => r.payPeriodName,
        },
        {
          header: 'Start',
          render: (r: PayrollRunRow) =>
            new Date(r.payPeriodStart).toLocaleDateString(),
        },
        {
          header: 'End',
          render: (r: PayrollRunRow) =>
            new Date(r.payPeriodEnd).toLocaleDateString(),
        },
        {
          header: 'Payslips',
          align: 'right',
          render: (r: PayrollRunRow) => String(r._count.payslips),
        },
        {
          header: 'Status',
          render: (r: PayrollRunRow) => {
            const tone =
              r.status === 'POSTED'
                ? 'positive'
                : r.status === 'APPROVED'
                  ? 'positive'
                  : r.status === 'CALCULATED'
                    ? 'warning'
                    : 'neutral';

            return <Badge tone={tone}>{r.status}</Badge>;
          },
        },
        {
          header: 'Journal',
          render: (r: PayrollRunRow) => r.journalEntryId ?? '—',
        },
        {
          header: 'Actions',
          render: (r: PayrollRunRow) => (
            <PayrollRunActions
              id={r.id}
              entityId={r.entityId}
              initialStatus={r.status}
              initialJournalEntryId={r.journalEntryId}
              accountOptions={accountOptions}
            />
          ),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.id}
      emptyMessage="No payroll runs created for this entity."
    />
  );
}
