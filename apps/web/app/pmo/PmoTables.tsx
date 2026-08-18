'use client';

import { Badge, DataTable } from '@7f/ui';

export interface GanttTask {
  id: string;
  parentTaskId: string | null;
  name: string;
  start: string;
  end: string;
  percentComplete: number;
  isMilestone: boolean;
  isCritical: boolean;
  status: string;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface TopOpenRisk {
  id: string;
  title: string;
  riskScore: number;
  status: string;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

const TASK_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'positive',
  ON_HOLD: 'warning',
  CANCELLED: 'negative',
};

export function PmoTaskTable({ rows }: { rows: GanttTask[] }) {
  return (
    <DataTable
      columns={[
        {
          header: 'Task',
          render: (t: GanttTask) => (t.isMilestone ? `◆ ${t.name}` : t.name),
        },
        {
          header: 'Start',
          render: (t: GanttTask) => new Date(t.start).toLocaleDateString(),
        },
        {
          header: 'End',
          render: (t: GanttTask) => new Date(t.end).toLocaleDateString(),
        },
        {
          header: '% complete',
          align: 'right',
          render: (t: GanttTask) => `${t.percentComplete}%`,
        },
        {
          header: 'Status',
          render: (t: GanttTask) => (
            <Badge tone={TASK_STATUS_TONE[t.status] ?? 'neutral'}>
              {t.status}
            </Badge>
          ),
        },
        {
          header: 'Critical',
          render: (t: GanttTask) =>
            t.isCritical ? <Badge tone="negative">Critical path</Badge> : '—',
        },
      ]}
      rows={rows}
      keyOf={(t) => t.id}
      emptyMessage="No tasks scheduled for this project yet."
    />
  );
}

export function PmoStatusTable({
  rows,
  emptyMessage,
}: {
  rows: StatusCount[];
  emptyMessage: string;
}) {
  return (
    <DataTable
      columns={[
        {
          header: 'Status',
          render: (r: StatusCount) => r.status,
        },
        {
          header: 'Count',
          align: 'right',
          render: (r: StatusCount) => String(r.count),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.status}
      emptyMessage={emptyMessage}
    />
  );
}

export function PmoTopRiskTable({ rows }: { rows: TopOpenRisk[] }) {
  return (
    <DataTable
      columns={[
        {
          header: 'Title',
          render: (r: TopOpenRisk) => r.title,
        },
        {
          header: 'Risk score',
          align: 'right',
          render: (r: TopOpenRisk) => String(r.riskScore),
        },
        {
          header: 'Status',
          render: (r: TopOpenRisk) => (
            <Badge tone="warning">{r.status}</Badge>
          ),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.id}
      emptyMessage="No open risks for this project."
    />
  );
}

export function PmoPriorityTable({ rows }: { rows: PriorityCount[] }) {
  return (
    <DataTable
      columns={[
        {
          header: 'Priority',
          render: (r: PriorityCount) => r.priority,
        },
        {
          header: 'Count',
          align: 'right',
          render: (r: PriorityCount) => String(r.count),
        },
      ]}
      rows={rows}
      keyOf={(r) => r.priority}
      emptyMessage="No open issues for this project."
    />
  );
}
