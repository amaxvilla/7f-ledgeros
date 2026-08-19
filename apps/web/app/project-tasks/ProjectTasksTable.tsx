'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { TaskActions } from './TaskActions';

export interface ProjectTask {
  id: string;
  code: string | null;
  name: string;
  parentTaskId: string | null;
  plannedStart: string;
  plannedEnd: string;
  percentComplete: number;
  status: string;
  isCritical: boolean;
}

export interface CriticalPathTask {
  id: string;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  floatDays: number;
  isCritical: boolean;
}

interface ProjectTasksTableProps {
  tasks: ProjectTask[];
}

interface CriticalPathTableProps {
  tasks: CriticalPathTask[];
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'positive',
  ON_HOLD: 'warning',
  CANCELLED: 'negative',
};

export function ProjectTasksTable({
  tasks,
}: ProjectTasksTableProps) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Planned start' },
    { header: 'Planned end' },
    { header: '% complete', align: 'right' },
    { header: 'Critical' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const rows: DataTableClientRow<ProjectTask>[] = tasks.map((task) => ({
    id: task.id,
    data: task,
    cells: [
      task.code ?? '—',
      task.name,
      new Date(task.plannedStart).toLocaleDateString(),
      new Date(task.plannedEnd).toLocaleDateString(),
      `${task.percentComplete}%`,
      task.isCritical ? (
        <Badge
          key={`${task.id}-critical`}
          tone="negative"
        >
          Critical
        </Badge>
      ) : (
        '—'
      ),
      <Badge
        key={`${task.id}-status`}
        tone={STATUS_TONE[task.status] ?? 'neutral'}
      >
        {task.status}
      </Badge>,
      <div
        key={`${task.id}-actions`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space(2),
          alignItems: 'flex-end',
        }}
      >
        <TaskActions
          id={task.id}
          status={task.status}
        />
      </div>,
    ],
    searchText: [
      task.code ?? '',
      task.name,
      task.status,
      task.isCritical ? 'critical' : '',
    ].join(' '),
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={rows}
      search={{
        placeholder: 'Search tasks...',
      }}
      emptyMessage="No tasks for this project yet."
    />
  );
}

export function CriticalPathTable({
  tasks,
}: CriticalPathTableProps) {
  const columns: DataTableClientColumn[] = [
    { header: 'Task' },
    { header: 'Planned start' },
    { header: 'Planned end' },
    { header: 'Float (days)', align: 'right' },
    { header: 'Critical' },
  ];

  const rows: DataTableClientRow<CriticalPathTask>[] = tasks.map(
    (task) => ({
      id: task.id,
      data: task,
      cells: [
        task.name,
        new Date(task.plannedStart).toLocaleDateString(),
        new Date(task.plannedEnd).toLocaleDateString(),
        String(task.floatDays),
        task.isCritical ? (
          <Badge
            key={`${task.id}-critical`}
            tone="negative"
          >
            Critical
          </Badge>
        ) : (
          '—'
        ),
      ],
      searchText: [
        task.name,
        task.isCritical ? 'critical' : '',
        String(task.floatDays),
      ].join(' '),
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={rows}
      search={{
        placeholder: 'Search critical path...',
      }}
      emptyMessage="No tasks to schedule yet."
    />
  );
}
