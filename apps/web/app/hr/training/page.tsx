import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { CreateCourseForm } from './CreateCourseForm';
import { CreateSessionForm } from './CreateSessionForm';
import { EnrolForm } from './EnrolForm';
import { EnrollmentActions } from './EnrollmentActions';
import { TrainingCoursesTable, TrainingSessionsTable, TrainingEnrollmentsTable } from './TrainingTables';

export const dynamic = 'force-dynamic';

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

const SESSION_TONE: Record<Session['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  SCHEDULED: 'neutral',
  ONGOING: 'warning',
  COMPLETED: 'positive',
  CANCELLED: 'negative',
};

const ENROLLMENT_TONE: Record<Enrollment['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ENROLLED: 'neutral',
  ATTENDED: 'positive',
  NO_SHOW: 'negative',
  CANCELLED: 'negative',
};

async function loadTraining(entityId: string) {
  const [employees, courses, sessions, enrollments] = await Promise.all([
    fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
    fetchApi<Course[]>(`/hr/training/courses?entityId=${entityId}`),
    fetchApi<Session[]>('/hr/training/sessions'),
    fetchApi<Enrollment[]>('/hr/training/enrollments'),
  ]);

  const courseIds = new Set(courses.map((c) => c.id));
  const entitySessions = sessions.filter((s) => courseIds.has(s.courseId));
  const sessionIds = new Set(entitySessions.map((s) => s.id));
  const entityEnrollments = enrollments.filter((e) => sessionIds.has(e.sessionId));

  const employeeOptions: SelectOption[] = employees.map((e) => ({ value: e.id, label: `${e.employeeCode} — ${e.firstName} ${e.lastName}` }));
  const courseOptions: SelectOption[] = courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }));
  const sessionOptions: SelectOption[] = entitySessions.map((s) => ({
    value: s.id,
    label: `${s.course.name} — ${new Date(s.startDate).toLocaleDateString()}`,
  }));
  const employeeNames = new Map(employees.map((e) => [e.id, `${e.employeeCode} — ${e.firstName} ${e.lastName}`]));

  return {
    courses,
    sessions: entitySessions,
    enrollments: entityEnrollments,
    employeeOptions,
    courseOptions,
    sessionOptions,
    employeeNames,
    kpis: {
      courses: courses.length,
      scheduledSessions: entitySessions.filter((s) => s.status === 'SCHEDULED').length,
      enrolled: entityEnrollments.filter((e) => e.status === 'ENROLLED').length,
    },
  };
}

export default async function TrainingPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Training" subtitle="Select an entity to manage courses and training sessions." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadTraining>> | null = null;
  let error: string | null = null;
  try {
    data = await loadTraining(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load training data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Training" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Courses" value={String(data.kpis.courses)} />
            <KpiCard label="Scheduled sessions" value={String(data.kpis.scheduledSessions)} />
            <KpiCard label="Currently enrolled" value={String(data.kpis.enrolled)} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Courses" />
            <CreateCourseForm entityId={entityId} />
            <TrainingCoursesTable rows={data.courses} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Sessions" />
            <CreateSessionForm courseOptions={data.courseOptions} />
            <TrainingSessionsTable rows={data.sessions} />
          </section>

          <section>
            <PageHeader title="Enrollments" />
            <EnrolForm employeeOptions={data.employeeOptions} sessionOptions={data.sessionOptions} />
            <TrainingEnrollmentsTable rows={data.enrollments} employeeNames={Object.fromEntries(data.employeeNames)} />
          </section>
        </>
      )}
          <section
        style={{
          marginTop: tokens.space(8),
          paddingTop: tokens.space(6),
          borderTop: `1px solid ${tokens.color.border}`,
        }}
      >
        <PageHeader
          title="Certifications and skills"
          subtitle="Issue certifications, monitor expiries, and review the skills matrix."
        />
        <a
          href="/hr/training/certifications"
          style={{
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: tokens.color.textPrimary,
            textDecoration: 'none',
          }}
        >
          Open Certifications →
        </a>
      </section>
</PageContainer>
  );
}
