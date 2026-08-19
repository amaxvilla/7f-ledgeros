import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { ClockInOutForm } from './ClockInOutForm';
import { MarkAbsenteesButton } from './MarkAbsenteesButton';
import { EmployeeAttendanceSelector } from './EmployeeAttendanceSelector';

export const dynamic = 'force-dynamic';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';
  source: string;
  notes: string | null;
}

const STATUS_TONE: Record<AttendanceRecord['status'], 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PRESENT: 'positive',
  ABSENT: 'negative',
  LATE: 'warning',
  HALF_DAY: 'warning',
  ON_LEAVE: 'neutral',
  HOLIDAY: 'neutral',
};

/**
 * `GET /hr/attendance/:employeeId` is per-employee only â€” there is no
 * entity-wide attendance list endpoint. This page defaults the history
 * view to the entity's first employee (deterministic, not arbitrary â€”
 * same employee every load for a given `employeeOptions` order) rather
 * than showing nothing, and lets `EmployeeAttendanceSelector` switch
 * which employee's history is shown via a URL param, consistent with
 * how `EntitySelector` itself drives navigation on every other page.
 */
async function loadAttendance(entityId: string, employeeId?: string) {
  const employees = await fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`);
  const employeeOptions: SelectOption[] = employees.map((e) => ({ value: e.id, label: `${e.employeeCode} â€” ${e.firstName} ${e.lastName}` }));

  const selectedId = employeeId && employees.some((e) => e.id === employeeId) ? employeeId : employees[0]?.id;

  let records: AttendanceRecord[] = [];
  if (selectedId) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    records = await fetchApi<AttendanceRecord[]>(
      `/hr/attendance/${selectedId}?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`,
    );
  }

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;

  return { employeeOptions, selectedId, records, kpis: { present, late, absent } };
}

export default async function AttendancePage({ searchParams }: { searchParams: { entityId?: string; employeeId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Attendance" subtitle="Select an entity to view attendance." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadAttendance>> | null = null;
  let error: string | null = null;
  try {
    data = await loadAttendance(entityId, searchParams.employeeId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load attendance.';
  }

  return (
    <PageContainer>
      <PageHeader title="Attendance" subtitle={`Entity ${entityId} â€” last 30 days`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {data && (
        <>
          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Clock in / out" />
            <ClockInOutForm employeeOptions={data.employeeOptions} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Mark absentees" />
            <MarkAbsenteesButton entityId={entityId} />
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(6),
            }}
          >
            <KpiCard label="Present (30d)" value={String(data.kpis.present)} tone="positive" />
            <KpiCard label="Late (30d)" value={String(data.kpis.late)} tone={data.kpis.late > 0 ? 'warning' : 'neutral'} />
            <KpiCard label="Absent (30d)" value={String(data.kpis.absent)} tone={data.kpis.absent > 0 ? 'negative' : 'neutral'} />
          </section>

          <section>
            <PageHeader title="Attendance history" />
            <EmployeeAttendanceSelector employeeOptions={data.employeeOptions} selectedId={data.selectedId} entityId={entityId} />
            <DataTable
              columns={[
                { header: 'Date', render: (r: AttendanceRecord) => new Date(r.date).toLocaleDateString() },
                { header: 'Clock in', render: (r: AttendanceRecord) => (r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : 'â€”') },
                { header: 'Clock out', render: (r: AttendanceRecord) => (r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : 'â€”') },
                { header: 'Status', render: (r: AttendanceRecord) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
                { header: 'Source', render: (r: AttendanceRecord) => r.source },
              ]}
              rows={data.records}
              keyOf={(r) => r.id}
              emptyMessage="No attendance records in the last 30 days."
            />
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
          title="Attendance management"
          subtitle="Configure shifts, rosters, and biometric devices."
        />
        <a
          href="/hr/attendance/management"
          style={{
            fontFamily: tokens.font.body,
            fontSize: '13px',
            color: tokens.color.textPrimary,
            textDecoration: 'none',
          }}
        >
          Open Attendance Management â†’
        </a>
      </section>
</PageContainer>
  );
}
