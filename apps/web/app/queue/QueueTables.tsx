'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface JobRun {
  id: string;
  queueName: string;
  jobName: string;
  jobId: string;
  status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
  attemptsMade: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  result: { url?: string } | null;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  QUEUED: 'neutral',
  ACTIVE: 'warning',
  COMPLETED: 'positive',
  FAILED: 'negative',
};

function resolveResultUrl(url: string): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  return `${new URL(apiUrl).origin}${url}`;
}

export function QueueRunsTable({
  rows,
}: {
  rows: JobRun[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Queue' },
    { header: 'Job' },
    { header: 'Status' },
    { header: 'Attempts', align: 'right' },
    { header: 'Error' },
    { header: 'Result' },
    { header: 'Created' },
  ];

  const tableRows: DataTableClientRow<JobRun>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: [
      row.queueName,
      row.jobName,
      row.status,
      String(row.attemptsMade),
      row.errorMessage ?? '',
      row.result?.url ?? '',
      row.createdAt,
    ].join(' '),
    cells: [
      row.queueName,
      row.jobName,
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      String(row.attemptsMade),
      row.errorMessage ?? '—',
      row.result?.url ? (
        <a
          key={`${row.id}-result`}
          href={resolveResultUrl(row.result.url)}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
          target="_blank"
          rel="noreferrer"
        >
          Download
        </a>
      ) : (
        '—'
      ),
      new Date(row.createdAt).toLocaleString(),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No job runs recorded yet."
      search={{
        placeholder: 'Search queue, job, status or error…',
      }}
    />
  );
}
