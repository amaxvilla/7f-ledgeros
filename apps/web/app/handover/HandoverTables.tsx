'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface HandoverRecord {
  id: string;
  status: string;
  scheduledDate: string;
  inspectedAt: string | null;
  completedAt: string | null;
  unit: {
    id: string;
    code: string;
  };
  customer: {
    id: string;
    name: string;
  };
  snags: {
    id: string;
    status: string;
  }[];
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  SCHEDULED: 'neutral',
  INSPECTION_DONE: 'warning',
  SNAGS_PENDING: 'warning',
  COMPLETED: 'positive',
  CANCELLED: 'negative',
};

export function HandoverRecordsTable({
  rows,
}: {
  rows: HandoverRecord[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Unit' },
    { header: 'Customer' },
    { header: 'Scheduled' },
    { header: 'Status' },
    { header: 'Open snags', align: 'right' },
  ];

  const tableRows: DataTableClientRow<HandoverRecord>[] = rows.map((row) => {
    const openSnags = row.snags.filter(
      (snag) => snag.status === 'OPEN' || snag.status === 'IN_PROGRESS',
    ).length;

    return {
      id: row.id,
      data: row,
      searchText: `${row.unit.code} ${row.customer.name} ${row.status} ${openSnags}`,
      cells: [
        (
          <Link
            key={`${row.id}-unit`}
            href={`/handover/${row.id}`}
            style={{
              color: tokens.color.accent,
              fontFamily: tokens.font.body,
              fontSize: '13px',
            }}
          >
            {row.unit.code}
          </Link>
        ),
        row.customer.name,
        new Date(row.scheduledDate).toLocaleDateString(),
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        String(openSnags),
      ],
    };
  });

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No handover records for this entity yet."
      search={{
        placeholder: 'Search unit, customer or status…',
      }}
    />
  );
}
