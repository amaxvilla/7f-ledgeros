'use client';

import { ActionForm, Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { revokeApiKey } from './actions';

interface ApiKey {
  id: string;
  entityId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  rateLimitPerMinute: number | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ACTIVE: 'positive',
  REVOKED: 'negative',
};

export function ApiGatewayKeysTable({
  rows,
}: {
  rows: ApiKey[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Name' },
    { header: 'Key' },
    { header: 'Scopes' },
    { header: 'Status' },
    { header: 'Rate limit' },
    { header: 'Expires' },
    { header: 'Last used' },
    { header: '', align: 'right' },
  ];

  const tableRows: DataTableClientRow<ApiKey>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    searchText: `${row.name} ${row.keyPrefix} ${row.scopes.join(' ')} ${row.status}`,
    cells: [
      row.name,
      (
        <code
          key={`${row.id}-key`}
          style={{
            fontFamily: tokens.font.mono,
            fontSize: '12px',
          }}
        >
          {row.keyPrefix}…
        </code>
      ),
      row.scopes.length === 0 ? (
        <span
          key={`${row.id}-scopes-all`}
          style={{
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: tokens.color.textMuted,
          }}
        >
          All
        </span>
      ) : (
        <div
          key={`${row.id}-scopes`}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: tokens.space(1),
          }}
        >
          {row.scopes.map((scope) => (
            <Badge key={`${row.id}-${scope}`} tone="neutral">
              {scope}
            </Badge>
          ))}
        </div>
      ),
      (
        <Badge
          key={`${row.id}-status`}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>
      ),
      row.rateLimitPerMinute
        ? `${row.rateLimitPerMinute}/min`
        : 'Unlimited',
      row.expiresAt
        ? new Date(row.expiresAt).toLocaleDateString()
        : '—',
      row.lastUsedAt
        ? new Date(row.lastUsedAt).toLocaleString()
        : '—',
      row.status === 'REVOKED' ? null : (
        <ActionForm action={revokeApiKey.bind(null, row.id)}>
          <button
            type="submit"
            style={{
              color: tokens.color.negative,
              fontFamily: tokens.font.body,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Revoke
          </button>
        </ActionForm>
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No API keys for this entity yet."
    />
  );
}
