'use client';

import Link from 'next/link';
import { ActionForm, Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { runHealthCheck } from './actions';

interface IntegrationProvider {
  id: string;
  entityId: string | null;
  category: string;
  providerCode: string;
  name: string;
  status: string;
  isActive: boolean;
  hasCredentials: boolean;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
  lastHealthCheckError: string | null;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
  DEGRADED: 'warning',
  ERROR: 'negative',
};

export function IntegrationsTable({
  rows,
}: {
  rows: IntegrationProvider[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Category' },
    { header: 'Provider' },
    { header: 'Status' },
    { header: 'Credentials' },
    { header: 'Last checked' },
    { header: '', align: 'right' },
    { header: 'Manage', align: 'right' },
  ];

  const tableRows: DataTableClientRow<IntegrationProvider>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.category} ${row.providerCode} ${row.name} ${row.status} ${
        row.hasCredentials ? 'Configured' : 'None'
      }`,
      cells: [
        row.category,
        `${row.providerCode} — ${row.name}`,
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        row.hasCredentials ? (
          <Badge key={`${row.id}-credentials`} tone="positive">
            Configured
          </Badge>
        ) : (
          <Badge key={`${row.id}-credentials`} tone="neutral">
            None
          </Badge>
        ),
        row.lastHealthCheckAt
          ? `${new Date(row.lastHealthCheckAt).toLocaleString()} (${
              row.lastHealthCheckOk
                ? 'OK'
                : row.lastHealthCheckError ?? 'failed'
            })`
          : 'Never checked',
        (
          <ActionForm
            key={`${row.id}-health-check`}
            action={runHealthCheck.bind(null, row.id)}
          >
            <button
              type="submit"
              style={{
                color: tokens.color.accent,
                fontFamily: tokens.font.body,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Run health check
            </button>
          </ActionForm>
        ),
        (
          <Link
            key={`${row.id}-manage`}
            href={`/integrations/${row.id}`}
            style={{
              color: tokens.color.accent,
              fontFamily: tokens.font.body,
              fontSize: '13px',
            }}
          >
            Configure →
          </Link>
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No integrations configured yet."
      search={{
        placeholder: 'Search category, provider, status or credentials…',
      }}
    />
  );
}
