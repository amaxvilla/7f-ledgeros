'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { SnagActions } from './SnagActions';

interface Snag {
  id: string;
  category: string | null;
  description: string;
  severity: string;
  status: string;
  dueDate: string | null;
  resolvedNotes: string | null;
  createdAt: string;
}

const SNAG_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  OPEN: 'warning',
  IN_PROGRESS: 'neutral',
  RESOLVED: 'positive',
  VERIFIED: 'positive',
  REJECTED: 'negative',
};

const SNAG_SEVERITY_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  MINOR: 'neutral',
  MAJOR: 'warning',
  CRITICAL: 'negative',
};

export function HandoverSnagsTable({
  rows,
  handoverRecordId,
}: {
  rows: Snag[];
  handoverRecordId: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Description' },
    { header: 'Category' },
    { header: 'Severity' },
    { header: 'Status' },
    { header: 'Due' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Snag>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.description} ${row.category ?? ''} ${row.severity} ${row.status}`,
    cells: [
      row.description,
      row.category ?? '—',
      (
        <Badge
          key={`${row.id}-severity`}
          tone={SNAG_SEVERITY_TONE[row.severity] ?? 'neutral'}
        >
          {row.severity}
        </Badge>
      ),
      (
        <Badge
          key={`${row.id}-status`}
          tone={SNAG_STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      row.dueDate
        ? new Date(row.dueDate).toLocaleDateString()
        : '—',
      (
        <SnagActions
          key={`${row.id}-actions`}
          id={row.id}
          status={row.status}
          handoverRecordId={handoverRecordId}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No snags logged for this handover yet."
      search={{
        placeholder: 'Search description, category, severity or status…',
      }}
    />
  );
}
