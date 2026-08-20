'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface MaintenanceRequest {
  id: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  description: string;
  targetResolutionDate: string | null;
  createdAt: string;
}

const PRIORITY_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  LOW: 'neutral',
  MEDIUM: 'neutral',
  HIGH: 'warning',
  URGENT: 'negative',
};

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  OPEN: 'warning',
  ASSIGNED: 'warning',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'negative',
  RESOLVED: 'positive',
  CLOSED: 'positive',
  CANCELLED: 'neutral',
};

export function FacilityMaintenanceRequestsTable({
  rows,
}: {
  rows: MaintenanceRequest[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Description' },
    { header: 'Category' },
    { header: 'Priority' },
    { header: 'Status' },
    { header: 'Target resolution' },
    { header: 'Raised' },
  ];

  const tableRows: DataTableClientRow<MaintenanceRequest>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      searchText: `${row.description} ${row.category} ${row.priority} ${row.status}`,
      cells: [
        row.description,
        row.category,
        (
          <Badge
            key={`${row.id}-priority`}
            tone={PRIORITY_TONE[row.priority] ?? 'neutral'}
          >
            {row.priority}
          </Badge>
        ),
        (
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>
        ),
        row.targetResolutionDate
          ? new Date(row.targetResolutionDate).toLocaleDateString()
          : '—',
        new Date(row.createdAt).toLocaleDateString(),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No maintenance requests for this entity."
      search={{
        placeholder: 'Search description, category, priority or status…',
      }}
    />
  );
}
