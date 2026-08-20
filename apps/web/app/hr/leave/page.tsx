import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { CreateLeaveRequestForm } from './CreateLeaveRequestForm';
import { LeaveRequestActions } from './LeaveRequestActions';
import { LeaveRequestsTable } from '../HrTables';

export const dynamic = 'force-dynamic';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface LeaveType {
  id: string;
  code: string;
  name: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason: string | null;
}

const STATUS_TONE: Record<LeaveRequest['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'neutral',
};

async function loadLeave(entityId: string) {
  const [employees, leaveTypes, requests] = await Promise.all([
    fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
    fetchApi<LeaveType[]>(`/hr/leave/types?entityId=${entityId}`),
    fetchApi<LeaveRequest[]>('/hr/leave/requests'),
  ]);

  const employeeOptions: SelectOption[] = employees.map((e) => ({ value: e.id, label: `${e.employeeCode} — ${e.firstName} ${e.lastName}` }));
  const leaveTypeOptions: SelectOption[] = leaveTypes.map((t) => ({ value: t.id, label: t.name }));
  const employeeIds = new Set(employees.map((e) => e.id));
  const employeeNames = new Map(employees.map((e) => [e.id, `${e.employeeCode} — ${e.firstName} ${e.lastName}`]));
  const leaveTypeNames = new Map(leaveTypes.map((t) => [t.id, t.name]));

  // Requests aren't entity-filterable server-side; scope to this entity's own employees.
  const scopedRequests = requests.filter((r) => employeeIds.has(r.employeeId));

  const submitted = scopedRequests.filter((r) => r.status === 'SUBMITTED').length;
  const approved = scopedRequests.filter((r) => r.status === 'APPROVED').length;

  return {
    requests: scopedRequests,
    employeeOptions,
    leaveTypeOptions,
    employeeNames,
    leaveTypeNames,
    kpis: { total: scopedRequests.length, pending: submitted, approved },
  };
}

export default async function LeavePage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Leave" subtitle="Select an entity to manage leave requests." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadLeave>> | null = null;
  let error: string | null = null;
  try {
    data = await loadLeave(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load leave data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Leave" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Total requests" value={String(data.kpis.total)} />
            <KpiCard label="Pending approval" value={String(data.kpis.pending)} tone={data.kpis.pending > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Approved" value={String(data.kpis.approved)} tone="positive" />
          </section>

          <section>
            <PageHeader title="Leave requests" />
            <CreateLeaveRequestForm employeeOptions={data.employeeOptions} leaveTypeOptions={data.leaveTypeOptions} />
            <LeaveRequestsTable
  rows={data.requests}
  employeeNames={Object.fromEntries(data.employeeNames)}
  leaveTypeNames={Object.fromEntries(data.leaveTypeNames)}
/>
          </section>
        </>
      )}
</PageContainer>
  );
}
