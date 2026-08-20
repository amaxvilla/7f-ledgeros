'use client';

import { Badge, DataTableClient } from '@7f/ui';
import type {
  DataTableClientColumn,
  DataTableClientRow,
} from '@7f/ui';
import { EnrollmentActions } from './EnrollmentActions';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface Course {
  id: string;
  code: string;
  name: string;
  durationHours: number | null;
  provider: string | null;
}

interface Session {
  id: string;
  courseId: string;
  startDate: string;
  endDate: string;
  location: string | null;
  status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  course: Course;
}

interface Enrollment {
  id: string;
  sessionId: string;
  employeeId: string;
  status: 'ENROLLED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
  evaluationRating: number | null;
  session: Session;
}

const sessionTone: Record<
  Session['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  SCHEDULED: 'neutral',
  ONGOING: 'warning',
  COMPLETED: 'positive',
  CANCELLED: 'negative',
};

const enrollmentTone: Record<
  Enrollment['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  ENROLLED: 'neutral',
  ATTENDED: 'positive',
  NO_SHOW: 'negative',
  CANCELLED: 'negative',
};

export function TrainingCoursesTable({
  rows,
}: {
  rows: Course[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Code' },
    { header: 'Name' },
    { header: 'Duration (hrs)', align: 'right' },
    { header: 'Provider' },
  ];

  const tableRows: DataTableClientRow<Course>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.code,
      row.name,
      row.durationHours != null ? String(row.durationHours) : '?',
      row.provider ?? '?',
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No training courses yet."
    />
  );
}

export function TrainingSessionsTable({
  rows,
}: {
  rows: Session[];
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Course' },
    { header: 'Start' },
    { header: 'End' },
    { header: 'Location' },
    { header: 'Status' },
  ];

  const tableRows: DataTableClientRow<Session>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      row.course.name,
      new Date(row.startDate).toLocaleDateString(),
      new Date(row.endDate).toLocaleDateString(),
      row.location ?? '?',
      <Badge key={row.id + '-status'} tone={sessionTone[row.status]}>
        {row.status}
      </Badge>,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No sessions scheduled yet."
    />
  );
}

export function TrainingEnrollmentsTable({
  rows,
  employeeNames,
}: {
  rows: Enrollment[];
  employeeNames: Record<string, string>;
}) {
  const columns: DataTableClientColumn[] = [
    { header: 'Employee' },
    { header: 'Course' },
    { header: 'Session date' },
    { header: 'Rating', align: 'right' },
    { header: 'Status' },
    { header: 'Actions', align: 'right' },
  ];

  const tableRows: DataTableClientRow<Enrollment>[] = rows.map((row) => ({
    id: row.id,
    data: row,
    cells: [
      employeeNames[row.employeeId] ?? row.employeeId,
      row.session.course.name,
      new Date(row.session.startDate).toLocaleDateString(),
      row.evaluationRating != null ? String(row.evaluationRating) : '?',
      <Badge key={row.id + '-status'} tone={enrollmentTone[row.status]}>
        {row.status}
      </Badge>,
      <EnrollmentActions
        key={row.id + '-action'}
        id={row.id}
        status={row.status}
        evaluationRating={row.evaluationRating}
      />,
    ],
  }));

  return (
    <DataTableClient
      columns={columns}
      rows={tableRows}
      emptyMessage="No enrollments yet."
    />
  );
}
