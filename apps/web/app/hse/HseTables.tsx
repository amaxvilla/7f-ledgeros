'use client';

import { Badge, DataTableClient, tokens } from '@7f/ui';
import type { DataTableClientColumn, DataTableClientRow } from '@7f/ui';
import { IncidentStatusActions } from './IncidentStatusActions';
import { NearMissStatusActions } from './NearMissStatusActions';
import { CorrectiveActionActions } from './CorrectiveActionActions';
import { RecordItemResultForm } from './RecordItemResultForm';
import { FinalizeChecklistButton } from './FinalizeChecklistButton';

interface CorrectiveActionRow {
  id: string;
  description: string;
  dueDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
}

interface IncidentReport {
  id: string;
  incidentDate: string;
  location: string | null;
  description: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'FATAL';
  status: 'OPEN' | 'INVESTIGATING' | 'CLOSED';
  correctiveActions: CorrectiveActionRow[];
}

interface NearMiss {
  id: string;
  occurredAt: string;
  location: string | null;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'CLOSED';
  correctiveActions: CorrectiveActionRow[];
}

interface ExpiringPpeIssuance {
  id: string;
  itemName: string;
  quantity: number;
  expiryDate: string | null;
  employee: { firstName: string; lastName: string };
}

interface ToolboxTalk {
  id: string;
  topic: string;
  talkDate: string;
  attendeeCount: number;
}

interface InspectionChecklistItem {
  id: string;
  itemDescription: string;
  isCompliant: boolean | null;
  remarks: string | null;
}

interface InspectionChecklist {
  id: string;
  checklistType: string;
  inspectionDate: string;
  result: 'PASS' | 'PASS_WITH_OBSERVATIONS' | 'FAIL' | null;
  items: InspectionChecklistItem[];
}

const CASE_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  OPEN: 'negative',
  INVESTIGATING: 'warning',
  CLOSED: 'positive',
};

const ACTION_STATUS_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'positive',
  OVERDUE: 'negative',
};

const SEVERITY_TONE: Record<
  string,
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  MINOR: 'neutral',
  MODERATE: 'warning',
  SEVERE: 'negative',
  FATAL: 'negative',
};

export function HseIncidentsTable({
  rows,
}: {
  rows: IncidentReport[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Location' },
    { header: 'Description' },
    { header: 'Severity' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<IncidentReport>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.incidentDate).toLocaleDateString(),
      row.location ?? '—',
      row.description,
      <Badge
        key={`${row.id}-severity`}
        tone={SEVERITY_TONE[row.severity]}
      >
        {row.severity}
      </Badge>,
      <Badge
        key={`${row.id}-status`}
        tone={CASE_STATUS_TONE[row.status]}
      >
        {row.status}
      </Badge>,
      <IncidentStatusActions
        key={`${row.id}-actions`}
        id={row.id}
        status={row.status}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No incidents reported for this entity."
    />
  );
}

export function HseNearMissesTable({
  rows,
}: {
  rows: NearMiss[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Location' },
    { header: 'Description' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<NearMiss>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.occurredAt).toLocaleDateString(),
      row.location ?? '—',
      row.description,
      <Badge
        key={`${row.id}-status`}
        tone={CASE_STATUS_TONE[row.status]}
      >
        {row.status}
      </Badge>,
      <NearMissStatusActions
        key={`${row.id}-actions`}
        id={row.id}
        status={row.status}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No near misses reported for this entity."
    />
  );
}

export function HseCorrectiveActionsTable({
  rows,
}: {
  rows: CorrectiveActionRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Description' },
    { header: 'Due' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<CorrectiveActionRow>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        row.description,
        new Date(row.dueDate).toLocaleDateString(),
        <Badge
          key={`${row.id}-status`}
          tone={ACTION_STATUS_TONE[row.status]}
        >
          {row.status}
        </Badge>,
        <CorrectiveActionActions
          key={`${row.id}-actions`}
          id={row.id}
          status={row.status}
        />,
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No corrective actions linked to this entity's incidents or near misses."
    />
  );
}

export function HseExpiringPpeTable({
  rows,
}: {
  rows: ExpiringPpeIssuance[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Employee' },
    { header: 'Item' },
    { header: 'Quantity', align: 'right' },
    { header: 'Expires' },
  ];

  const tableRows: DataTableClientRow<ExpiringPpeIssuance>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        `${row.employee.firstName} ${row.employee.lastName}`,
        row.itemName,
        String(row.quantity),
        row.expiryDate
          ? new Date(row.expiryDate).toLocaleDateString()
          : '—',
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No PPE items expiring in the next 30 days."
    />
  );
}

export function HseToolboxTalksTable({
  rows,
}: {
  rows: ToolboxTalk[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Topic' },
    { header: 'Attendees', align: 'right' },
  ];

  const tableRows: DataTableClientRow<ToolboxTalk>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      new Date(row.talkDate).toLocaleDateString(),
      row.topic,
      String(row.attendeeCount),
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No toolbox talks logged for this entity."
    />
  );
}

export function HseInspectionChecklistsTable({
  rows,
}: {
  rows: InspectionChecklist[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Date' },
    { header: 'Type' },
    { header: 'Items' },
    { header: 'Result' },
    { header: 'Finalize', align: 'right' },
  ];

  const tableRows: DataTableClientRow<InspectionChecklist>[] = rows.map(
    (row) => ({
      id: row.id,
      data: row,
      cells: [
        new Date(row.inspectionDate).toLocaleDateString(),
        row.checklistType,
        <div
          key={`${row.id}-items`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.space(1),
            minWidth: '360px',
          }}
        >
          {row.items.map((item) => (
            <RecordItemResultForm
              key={item.id}
              itemId={item.id}
              itemDescription={item.itemDescription}
              isCompliant={item.isCompliant}
              remarks={item.remarks}
            />
          ))}
        </div>,
        row.result ? (
          <Badge
            key={`${row.id}-result`}
            tone={
              row.result === 'PASS'
                ? 'positive'
                : row.result === 'FAIL'
                  ? 'negative'
                  : 'warning'
            }
          >
            {row.result}
          </Badge>
        ) : (
          <Badge key={`${row.id}-result`} tone="neutral">
            PENDING
          </Badge>
        ),
        <FinalizeChecklistButton
          key={`${row.id}-finalize`}
          id={row.id}
          result={row.result}
        />,
      ],
    }),
  );

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No inspection checklists logged for this entity."
    />
  );
}
