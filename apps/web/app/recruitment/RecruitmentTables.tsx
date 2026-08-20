'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';

import { RequisitionActions } from './RequisitionActions';
import { VacancyActions } from './VacancyActions';
import { RetrySyncButton } from './RetrySyncButton';

interface JobRequisition {
  id: string;
  jobTitle: string;
  status: string;
  headcount: number;
  workflowInstanceId: string | null;
  vacancies: { id: string }[];
}

interface Vacancy {
  id: string;
  title: string;
  status: string;
  _count: { applications: number };
}

interface PipelineReportRow {
  vacancyId: string;
  title: string;
  status: string;
  totalApplications: number;
  hired: number;
  rejected: number;
  avgTimeToHireDays: number | null;
}

interface InterviewSyncFailure {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  jobApplication: {
    candidate: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
}

interface CandidateSyncFailure {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface OfferSyncFailure {
  id: string;
  jobTitle: string;
  status: string;
  sentAt: string | null;
}

function requisitionTone(status: string) {
  if (status === 'APPROVED') return 'positive' as const;
  if (status === 'REJECTED') return 'negative' as const;
  if (status === 'CLOSED') return 'neutral' as const;
  return 'warning' as const;
}

function vacancyTone(status: string) {
  if (status === 'OPEN') return 'positive' as const;
  if (status === 'CLOSED') return 'neutral' as const;
  return 'warning' as const;
}

export function RecruitmentRequisitionsTable({
  rows,
}: {
  rows: JobRequisition[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Requisition' },
    { header: 'Status' },
    { header: 'Headcount', align: 'right' },
    { header: 'Vacancies', align: 'right' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<JobRequisition>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.jobTitle,
      <Badge key={`${row.id}-status`} tone={requisitionTone(row.status)}>
        {row.status}
      </Badge>,
      String(row.headcount),
      String(row.vacancies.length),
      <RequisitionActions
        key={`${row.id}-actions`}
        id={row.id}
        status={row.status}
        hasWorkflowInstance={row.workflowInstanceId !== null}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No job requisitions for this entity yet."
    />
  );
}

export function RecruitmentVacanciesTable({
  rows,
}: {
  rows: Vacancy[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Vacancy' },
    { header: 'Status' },
    { header: 'Applications', align: 'right' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Vacancy>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.title,
      <Badge key={`${row.id}-status`} tone={vacancyTone(row.status)}>
        {row.status}
      </Badge>,
      String(row._count.applications),
      <VacancyActions
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
      emptyMessage="No vacancies for this entity yet."
    />
  );
}

export function RecruitmentPipelineTable({
  rows,
}: {
  rows: PipelineReportRow[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Vacancy' },
    { header: 'Applications', align: 'right' },
    { header: 'Hired', align: 'right' },
    { header: 'Rejected', align: 'right' },
    { header: 'Avg. time to hire', align: 'right' },
  ];

  const tableRows: DataTableClientRow<PipelineReportRow>[] = rows.map((row) => ({
    id: row.vacancyId,
    data: row,
    cells: [
      row.title,
      String(row.totalApplications),
      String(row.hired),
      String(row.rejected),
      row.avgTimeToHireDays === null
        ? '—'
        : `${row.avgTimeToHireDays}d`,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No vacancies for this entity yet."
    />
  );
}

function interviewLabel(row: InterviewSyncFailure) {
  if (!row.jobApplication?.candidate) {
    return row.title;
  }

  return `${row.title} — ${row.jobApplication.candidate.firstName} ${row.jobApplication.candidate.lastName}`;
}

export function RecruitmentCalendarSyncTable({
  rows,
}: {
  rows: InterviewSyncFailure[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Interview' },
    { header: 'Scheduled' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<InterviewSyncFailure>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      interviewLabel(row),
      new Date(row.scheduledAt).toLocaleString(),
      <Badge key={`${row.id}-status`} tone="warning">
        {row.status}
      </Badge>,
      <RetrySyncButton
        key={`${row.id}-action`}
        id={row.id}
        kind="calendar"
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No calendar sync failures."
    />
  );
}

export function RecruitmentTeamsSyncTable({
  rows,
}: {
  rows: InterviewSyncFailure[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Interview' },
    { header: 'Scheduled' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<InterviewSyncFailure>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      interviewLabel(row),
      new Date(row.scheduledAt).toLocaleString(),
      <Badge key={`${row.id}-status`} tone="warning">
        {row.status}
      </Badge>,
      <RetrySyncButton
        key={`${row.id}-action`}
        id={row.id}
        kind="teams"
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No Teams sync failures."
    />
  );
}

export function RecruitmentContactSyncTable({
  rows,
}: {
  rows: CandidateSyncFailure[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Candidate' },
    { header: 'Email' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<CandidateSyncFailure>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      `${row.firstName} ${row.lastName}`,
      row.email,
      <RetrySyncButton
        key={`${row.id}-action`}
        id={row.id}
        kind="contact"
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No contact sync failures."
    />
  );
}

export function RecruitmentSignatureSyncTable({
  rows,
}: {
  rows: OfferSyncFailure[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Offer' },
    { header: 'Status' },
    { header: 'Sent' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<OfferSyncFailure>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.jobTitle,
      <Badge key={`${row.id}-status`} tone="warning">
        {row.status}
      </Badge>,
      row.sentAt ? new Date(row.sentAt).toLocaleString() : '—',
      <RetrySyncButton
        key={`${row.id}-action`}
        id={row.id}
        kind="signature"
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No signature sync failures."
    />
  );
}
