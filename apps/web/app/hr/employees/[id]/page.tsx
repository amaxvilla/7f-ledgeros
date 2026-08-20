import Link from 'next/link';
import { Badge, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { ConfirmEmployeeButton } from './ConfirmEmployeeButton';
import { StartOnboardingButton } from './StartOnboardingButton';
import { CompleteTaskButton } from './CompleteTaskButton';
import { InitiateExitForm } from './InitiateExitForm';
import { EmployeeLifecycleActions } from './EmployeeLifecycleActions';
import { EmployeeDirectReportsTable, EmployeeOnboardingTable, EmployeeEmploymentHistoryTable, EmployeeClearanceTable } from './EmployeeDetailTables';

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
          <EmployeeDirectReportsTable rows={employee.directReports} />
        </section>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Onboarding checklist" />
        <EmployeeOnboardingTable rows={employee.onboardingTasks} employeeId={employee.id} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Employment history" />
        <EmployeeEmploymentHistoryTable rows={history} />
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
          <EmployeeClearanceTable rows={employee.exitRecord.clearanceItems} />
        </section>
      )}
    </PageContainer>
  );
}
