'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { FeatureFlagRow } from './FeatureFlagRow';

interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPercent: number | null;
}

export function FeatureFlagsTable({
  rows,
}: {
  rows: FeatureFlag[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Key' },
    { header: 'Status' },
    { header: 'Rollout', align: 'right' },
    { header: 'Edit', align: 'right' },
  ];

  const tableRows: DataTableClientRow<FeatureFlag>[] = rows.map((row) => ({
    id: row.key,
    data: row,
    searchText: `${row.key} ${row.description ?? ''} ${row.enabled ? 'Enabled' : 'Disabled'} ${row.rolloutPercent ?? ''}`,
    cells: [
      row.key,
      (
        <Badge
          key={`${row.key}-status`}
          tone={row.enabled ? 'positive' : 'neutral'}
        >
          {row.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
      row.rolloutPercent === null ? '—' : `${row.rolloutPercent}%`,
      (
        <FeatureFlagRow
          key={`${row.key}-edit`}
          flagKey={row.key}
          initialEnabled={row.enabled}
          initialDescription={row.description}
          initialRolloutPercent={row.rolloutPercent}
        />
      ),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No feature flags configured yet."
      search={{
        placeholder: 'Search feature flags…',
      }}
    />
  );
}
