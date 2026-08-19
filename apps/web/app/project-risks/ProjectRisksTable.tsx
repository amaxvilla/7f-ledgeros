'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { CloseRiskButton } from './CloseRiskButton';
import { RiskRowActions } from './RiskRowActions';
import { RiskWorkflowActions } from './RiskWorkflowActions';

export interface ProjectRisk {
  id: string;
  projectId: string;
  title: string;
  category: string | null;
  probability: string;
  impact: string;
  riskScore: number;
  status: string;
  identifiedAt: string;
}

interface ProjectRisksTableProps {
  risks: ProjectRisk[];
  projectNames: Record<string, string>;
}

const STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  IDENTIFIED: 'neutral',
  ASSESSED: 'neutral',
  MITIGATING: 'warning',
  MONITORING: 'warning',
  OCCURRED: 'negative',
  CLOSED: 'positive',
};

export function ProjectRisksTable({
  risks,
  projectNames,
}: ProjectRisksTableProps) {
  const columns: DataTableClientColumn[] = [
    { header: 'Title' },
    { header: 'Project' },
    { header: 'Probability' },
    { header: 'Impact' },
    { header: 'Score', align: 'right' },
    { header: 'Status' },
    { header: 'Identified' },
    { header: 'Actions', align: 'right' },
  ];

  const rows: DataTableClientRow<ProjectRisk>[] = risks.map((risk) => ({
    id: risk.id,
    data: risk,
    cells: [
      risk.title,
      projectNames[risk.projectId] ?? risk.projectId,
      risk.probability,
      risk.impact,
      String(risk.riskScore),
      <Badge
        key={`${risk.id}-status`}
        tone={STATUS_TONE[risk.status] ?? 'neutral'}
      >
        {risk.status}
      </Badge>,
      new Date(risk.identifiedAt).toLocaleDateString(),
      <div
        key={`${risk.id}-actions`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space(2),
          alignItems: 'flex-end',
        }}
      >
        <CloseRiskButton
          id={risk.id}
          status={risk.status}
        />
        <RiskRowActions
          id={risk.id}
          status={risk.status}
        />
        <RiskWorkflowActions
          id={risk.id}
          status={risk.status}
        />
      </div>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={rows}
      emptyMessage="No risks logged yet."
    />
  );
}
