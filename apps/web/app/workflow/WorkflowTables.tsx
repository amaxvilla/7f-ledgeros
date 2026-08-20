'use client';

import Link from 'next/link';
import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

interface WorkflowStageSummary {
  id: string;
  sequence: number;
  name: string;
  stageType: string;
}

interface WorkflowDefinitionSummary {
  id: string;
  code: string;
  name: string;
  entityType: string;
  isActive: boolean;
  stages: WorkflowStageSummary[];
}

interface WorkflowStage {
  id: string;
  sequence: number;
  name: string;
  stageType: string;
  requiredRoleCode: string | null;
  minApprovals: number;
  rules: WorkflowRule[];
}

interface WorkflowRule {
  id: string;
  field: string;
  operator: string;
  value: string;
  requiredRoleCode: string | null;
  description: string | null;
}

interface WorkflowInstanceSummary {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stageInstances: WorkflowStageInstanceSummary[];
}

interface WorkflowStageInstanceSummary {
  id: string;
  sequence: number;
  status: string;
}

interface WorkflowStageDefinitionSummary {
  id: string;
  name: string;
  stageType: string;
}

interface WorkflowActionRecord {
  id: string;
  stageInstanceId: string;
  actorId: string;
  action: string;
  comments: string | null;
  actedAt: string;
}

interface WorkflowStageInstanceDetail {
  id: string;
  sequence: number;
  status: string;
  requiredRoleCode: string | null;
  requiredApprovals: number;
  approvalsReceived: number;
  activatedAt: string | null;
  completedAt: string | null;
  stageDefinition: WorkflowStageDefinitionSummary;
  actions: WorkflowActionRecord[];
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  IN_PROGRESS: 'warning',
  APPROVED: 'positive',
  POSTED: 'positive',
  ARCHIVED: 'neutral',
  REJECTED: 'negative',
  RETURNED: 'negative',
  CANCELLED: 'neutral',
};

const STAGE_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  PENDING: 'neutral',
  ACTIVE: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  RETURNED: 'negative',
};

const OPERATOR_LABEL: Record<string, string> = {
  GT: '>',
  GTE: '≥',
  LT: '<',
  LTE: '≤',
  EQ: '=',
  NEQ: '≠',
  IN: 'in',
};

export function WorkflowDefinitionsTable({
  rows,
}: {
  rows: WorkflowDefinitionSummary[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Entity type' },
    { header: 'Stages', align: 'right' },
    { header: 'Status' },
    { header: '', align: 'right' },
  ];

  const tableRows: DataTableClientRow<WorkflowDefinitionSummary>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        row.code,
        row.name,
        row.entityType,
        String(row.stages.length),
        <Badge
          key={`${row.id}-status`}
          tone={row.isActive ? 'positive' : 'neutral'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>,
        <Link
          key={`${row.id}-view`}
          href={`/workflow/${row.code}`}
          style={{
            color: tokens.color.accent,
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          View →
        </Link>,
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No active workflow definitions found."
    />
  );
}

export function WorkflowStagesTable({
  rows,
}: {
  rows: WorkflowStage[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: '#', align: 'right' },
    { header: 'Name' },
    { header: 'Type' },
    { header: 'Required role' },
    { header: 'Min approvals', align: 'right' },
    { header: 'Stage rules', align: 'right' },
  ];

  const tableRows: DataTableClientRow<WorkflowStage>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      String(row.sequence),
      row.name,
      row.stageType,
      row.requiredRoleCode ?? '—',
      String(row.minApprovals),
      String(row.rules.length),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="This workflow has no stages."
    />
  );
}

export function WorkflowStageRulesTable({
  rows,
}: {
  rows: Array<WorkflowRule & { stageName: string }>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Stage' },
    { header: 'Field' },
    { header: 'Operator' },
    { header: 'Value' },
    { header: 'Required role' },
    { header: 'Description' },
  ];

  const tableRows: DataTableClientRow<
    WorkflowRule & { stageName: string }
  >[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.stageName,
      row.field,
      OPERATOR_LABEL[row.operator] ?? row.operator,
      row.value,
      row.requiredRoleCode ?? '—',
      row.description ?? '—',
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No stage-level rules."
    />
  );
}

export function WorkflowRulesTable({
  rows,
}: {
  rows: WorkflowRule[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Field' },
    { header: 'Operator' },
    { header: 'Value' },
    { header: 'Required role' },
    { header: 'Description' },
  ];

  const tableRows: DataTableClientRow<WorkflowRule>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.field,
      OPERATOR_LABEL[row.operator] ?? row.operator,
      row.value,
      row.requiredRoleCode ?? '—',
      row.description ?? '—',
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No workflow-level rules."
    />
  );
}

export function WorkflowInstancesTable({
  rows,
}: {
  rows: WorkflowInstanceSummary[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Started' },
    { header: 'Status' },
    { header: 'Active stage' },
    { header: 'Completed' },
    { header: '', align: 'right' },
  ];

  const tableRows: DataTableClientRow<WorkflowInstanceSummary>[] =
    rows.map((row) => {
      const active = row.stageInstances.find(
        (stage) => stage.status === 'ACTIVE',
      );

      return {
        id: row.id,
        data: row,
        cells: [
          new Date(row.startedAt).toLocaleString(),
          <Badge
            key={`${row.id}-status`}
            tone={STATUS_TONE[row.status] ?? 'neutral'}
          >
            {row.status}
          </Badge>,
          active ? `#${active.sequence}` : '—',
          row.completedAt
            ? new Date(row.completedAt).toLocaleString()
            : '—',
          <Link
            key={`${row.id}-view`}
            href={`/workflow/instances/${row.id}`}
            style={{
              color: tokens.color.accent,
              fontFamily: tokens.font.body,
              fontSize: '13px',
            }}
          >
            View →
          </Link>,
        ],
      };
    });

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No workflow instances found for that entity."
    />
  );
}

export function WorkflowInstanceStagesTable({
  rows,
}: {
  rows: WorkflowStageInstanceDetail[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: '#', align: 'right' },
    { header: 'Name' },
    { header: 'Status' },
    { header: 'Required role' },
    { header: 'Approvals', align: 'right' },
  ];

  const tableRows: DataTableClientRow<WorkflowStageInstanceDetail>[] =
    rows.map((row) => ({
      id: row.id,
      data: row,
      cells: [
        String(row.sequence),
        row.stageDefinition.name,
        <Badge
          key={`${row.id}-status`}
          tone={STAGE_STATUS_TONE[row.status] ?? 'neutral'}
        >
          {row.status}
        </Badge>,
        row.requiredRoleCode ?? '—',
        `${row.approvalsReceived}/${row.requiredApprovals}`,
      ],
    }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="This instance has no stages."
    />
  );
}

export function WorkflowActionHistoryTable({
  rows,
}: {
  rows: Array<WorkflowActionRecord & { stageSequence: number }>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'When' },
    { header: 'Stage', align: 'right' },
    { header: 'Action' },
    { header: 'Comments' },
  ];

  const tableRows: DataTableClientRow<
    WorkflowActionRecord & { stageSequence: number }
  >[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.actedAt).toLocaleString(),
      `#${row.stageSequence}`,
      row.action,
      row.comments ?? '—',
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No actions recorded yet."
    />
  );
}
