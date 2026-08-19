'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { ResolveIssueButton } from './ResolveIssueButton';
import { IssueRowActions } from './IssueRowActions';

export interface ProjectIssue {
  id: string;
  projectId: string;
  title: string;
  priority: string;
  status: string;
  assignedToId: string | null;
  dueDate: string | null;
  raisedAt: string;
}

interface ProjectIssuesTableProps {
  issues: ProjectIssue[];
  projectNames: Record<string, string>;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'warning',
  ESCALATED: 'negative',
  RESOLVED: 'positive',
  CLOSED: 'neutral',
};

export function ProjectIssuesTable({
  issues,
  projectNames,
}: ProjectIssuesTableProps) {
  const columns: DataTableClientColumn[] = [
    { header: 'Title' },
    { header: 'Project' },
    { header: 'Priority' },
    { header: 'Status' },
    { header: 'Assigned to' },
    { header: 'Due' },
    { header: 'Raised' },
    { header: 'Actions', align: 'right' },
  ];

  const rows: DataTableClientRow<ProjectIssue>[] = issues.map((issue) => ({
    id: issue.id,
    data: issue,
    cells: [
      issue.title,
      projectNames[issue.projectId] ?? issue.projectId,
      issue.priority,
      <Badge
        key={`${issue.id}-status`}
        tone={STATUS_TONE[issue.status] ?? 'neutral'}
      >
        {issue.status}
      </Badge>,
      issue.assignedToId ?? '—',
      issue.dueDate
        ? new Date(issue.dueDate).toLocaleDateString()
        : '—',
      new Date(issue.raisedAt).toLocaleDateString(),
      <div
        key={`${issue.id}-actions`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space(2),
          alignItems: 'flex-end',
        }}
      >
        <ResolveIssueButton
          id={issue.id}
          status={issue.status}
        />
        <IssueRowActions
          id={issue.id}
          status={issue.status}
        />
      </div>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={rows}
      emptyMessage="No issues logged yet."
    />
  );
}
