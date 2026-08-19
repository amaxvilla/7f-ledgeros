import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { ConfirmEmployeeButton } from './ConfirmEmployeeButton';
import { StartOnboardingButton } from './StartOnboardingButton';
import { CompleteTaskButton } from './CompleteTaskButton';
import { InitiateExitForm } from './InitiateExitForm';
import { EmployeeLifecycleActions } from './EmployeeLifecycleActions';

export const dynamic = 'force-dynamic';

interface OnboardingTask {
  id: string;
  taskName: string;
  status: string;
  dueDate: string | null;
}

interface EmploymentEvent {
  id: string;
  eventType: string;
  effectiveDate: string;
}

interface ClearanceItem {
  id: string;
  department: string;
  item: string;
  status: string;
}

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  gradeLevel?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  isActive: boolean;
  department?: { name: string } | null;
  salaryStructure?: { code: string; name: string } | null;
  reportsTo?: { id: string; firstName: string; lastName: string; jobTitle: string | null } | null;
  directReports: { id: string; firstName: string; lastName: string; jobTitle: string | null }[];
  onboardingTasks: OnboardingTask[];
  exitRecord?: {
    id: string;
    exitType: string;
    noticeDate: string;
    lastWorkingDate: string;
    clearanceStatus: string;
    clearanceItems: ClearanceItem[];
  } | null;
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PROBATION: 'warning',
  CONFIRMED: 'positive',
  TERMINATED: 'negative',
  RESIGNED: 'negative',
  ON_LEAVE: 'warning',
  PENDING: 'neutral',
  COMPLETED: 'positive',
  CLEARED: 'positive',
};

async function loadEmployee(id: string) {
  const [employee, history] = await Promise.all([
    fetchApi<EmployeeDetail>(`/hr/employees/${id}`),
    fetchApi<EmploymentEvent[]>(`/hr/employees/${id}/employment-history`),
  ]);
  return { employee, history };
}

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  let data: Awaited<ReturnType<typeof loadEmployee>> | null = null;
  let error: string | null = null;

  try {
    data = await loadEmployee(params.id);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load employee.';
  }

  if (error || !data) {
    return (
      <PageContainer>
        <PageHeader title="Employee" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'Employee not found.'}</div>
        <Link href="/hr/employees" style={{ color: tokens.color.accent, fontFamily: tokens.font.body }}>
          ← Back to employees
        </Link>
      </PageContainer>
    );
  }

  const { employee, history } = data;

  return (
    <PageContainer>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        subtitle={`${employee.employeeCode}${employee.jobTitle ? ` · ${employee.jobTitle}` : ''}`}
      />
      <Link href="/hr/employees" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
        ← Back to employees
      </Link>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.space(4),
          margin: `${tokens.space(6)} 0 ${tokens.space(8)}`,
        }}
      >
        <KpiCard label="Status" value={employee.employmentStatus ?? 'ACTIVE'} tone={STATUS_TONE[employee.employmentStatus ?? ''] ?? 'neutral'} />
        <KpiCard label="Department" value={employee.department?.name ?? '—'} />
        <KpiCard label="Salary structure" value={employee.salaryStructure?.code ?? '—'} />
        <KpiCard label="Reports to" value={employee.reportsTo ? `${employee.reportsTo.firstName} ${employee.reportsTo.lastName}` : '—'} />
      </section>

      <section style={{ display: 'flex', gap: tokens.space(3), marginBottom: tokens.space(8), flexWrap: 'wrap' }}>
        <ConfirmEmployeeButton id={employee.id} status={employee.employmentStatus} />
        <StartOnboardingButton id={employee.id} hasTasks={employee.onboardingTasks.length > 0} />
        {!employee.exitRecord && <InitiateExitForm employeeId={employee.id} />}
      </section>

      {employee.directReports.length > 0 && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="Direct reports" />
          <DataTable
            columns={[
              {
                header: 'Name',
                render: (r: EmployeeDetail['directReports'][number]) => (
                  <Link href={`/hr/employees/${r.id}`} style={{ color: tokens.color.accent }}>
                    {r.firstName} {r.lastName}
                  </Link>
                ),
              },
              { header: 'Job title', render: (r: EmployeeDetail['directReports'][number]) => r.jobTitle ?? '—' },
            ]}
            rows={employee.directReports}
            keyOf={(r) => r.id}
            emptyMessage="No direct reports."
          />
        </section>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Onboarding checklist" />
        <DataTable
          columns={[
            { header: 'Task', render: (t: OnboardingTask) => t.taskName },
            { header: 'Due', render: (t: OnboardingTask) => (t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—') },
            { header: 'Status', render: (t: OnboardingTask) => <Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>{t.status}</Badge> },
            {
              header: 'Actions',
              align: 'right',
              render: (t: OnboardingTask) => <CompleteTaskButton taskId={t.id} employeeId={employee.id} status={t.status} />,
            },
          ]}
          rows={employee.onboardingTasks}
          keyOf={(t) => t.id}
          emptyMessage="Onboarding hasn't been started for this employee."
        />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Employment history" />
        <DataTable
          columns={[
            { header: 'Event', render: (h: EmploymentEvent) => h.eventType },
            { header: 'Effective date', render: (h: EmploymentEvent) => new Date(h.effectiveDate).toLocaleDateString() },
          ]}
          rows={history}
          keyOf={(h) => h.id}
          emptyMessage="No employment events logged yet."
        />
      </section>

      <EmployeeLifecycleActions employeeId={employee.id} />
      {employee.exitRecord && (
        <section>
          <PageHeader title={`Exit — ${employee.exitRecord.exitType}`} />
          <div style={{ marginBottom: tokens.space(4), display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
            <Badge tone={STATUS_TONE[employee.exitRecord.clearanceStatus] ?? 'neutral'}>{employee.exitRecord.clearanceStatus}</Badge>
            <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
              Last working day {new Date(employee.exitRecord.lastWorkingDate).toLocaleDateString()}
            </span>
          </div>
          <DataTable
            columns={[
              { header: 'Department', render: (c: ClearanceItem) => c.department },
              { header: 'Item', render: (c: ClearanceItem) => c.item },
              { header: 'Status', render: (c: ClearanceItem) => <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge> },
            ]}
            rows={employee.exitRecord.clearanceItems}
            keyOf={(c) => c.id}
            emptyMessage="No clearance items."
          />
        </section>
      )}
    </PageContainer>
  );
}
