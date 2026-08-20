'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import type { AgentOption } from './AgentSelector';
import { EndAssignmentButton } from './EndAssignmentButton';

interface AgentAssignmentRow {
  id: string;
  agentId: string;
  scope: 'PROJECT' | 'UNIT' | 'SALE';
  role: 'PRIMARY' | 'CO_AGENT' | 'REFERRAL';
  projectId: string | null;
  unitId: string | null;
  allocationId: string | null;
  isActive: boolean;
  assignedAt: string;
  endedAt: string | null;
  endedReason: string | null;
  notes: string | null;
}

const SCOPE_TONE: Record<
  AgentAssignmentRow['scope'],
  'neutral' | 'positive' | 'warning'
> = {
  PROJECT: 'neutral',
  UNIT: 'positive',
  SALE: 'warning',
};

function targetLabel(row: AgentAssignmentRow): string {
  if (row.scope === 'PROJECT') return row.projectId ?? '—';
  if (row.scope === 'UNIT') return row.unitId ?? '—';
  return row.allocationId ?? '—';
}

export function AgentAssignmentsTable({
  rows,
  agents,
  emptyMessage,
}: {
  rows: AgentAssignmentRow[];
  agents: AgentOption[];
  emptyMessage: string;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Agent' },
    { header: 'Scope' },
    { header: 'Role' },
    { header: 'Target' },
    { header: 'Assigned' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const agentMap = new Map(
    agents.map((agent) => [agent.id, agent.displayName]),
  );

  const tableRows: DataTableClientRow<AgentAssignmentRow>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        agentMap.get(row.agentId) ?? row.agentId,
        (
          <Badge
            key={`${row.id}-scope`}
            tone={SCOPE_TONE[row.scope]}
          >
            {row.scope}
          </Badge>
        ),
        row.role.replace('_', ' '),
        targetLabel(row),
        new Date(row.assignedAt).toLocaleDateString(),
        row.isActive ? (
          <Badge key={`${row.id}-status`} tone="positive">
            Active
          </Badge>
        ) : (
          <Badge key={`${row.id}-status`} tone="neutral">
            Ended{row.endedReason ? `: ${row.endedReason}` : ''}
          </Badge>
        ),
        (
          <EndAssignmentButton
            key={`${row.id}-action`}
            id={row.id}
            isActive={row.isActive}
          />
        ),
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage={emptyMessage}
    />
  );
}
