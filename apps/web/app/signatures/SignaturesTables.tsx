'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { DeclineEnvelopeButton } from './DeclineEnvelopeButton';

interface ManualSignatureEnvelope {
  id: string;
  documentName: string;
  subject: string | null;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  SENT: 'neutral',
  DELIVERED: 'warning',
  COMPLETED: 'positive',
  DECLINED: 'negative',
  VOIDED: 'negative',
};

export function SignaturesTable({
  rows,
}: {
  rows: ManualSignatureEnvelope[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Document' },
    { header: 'Subject' },
    { header: 'Status' },
    { header: 'Created' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<ManualSignatureEnvelope>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.documentName} ${row.subject ?? ''} ${row.status} ${row.createdAt}`,
      cells: [
        row.documentName,
        row.subject ?? '—',
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        new Date(row.createdAt).toLocaleDateString(),
        (
          <DeclineEnvelopeButton
            key={`${row.id}-actions`}
            id={row.id}
            status={row.status}
          />
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No signature envelopes yet."
      search={{
        placeholder: 'Search document, subject or status…',
      }}
    />
  );
}
