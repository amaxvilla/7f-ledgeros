import {
  PageContainer,
  PageHeader,
} from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { EntitySelector } from '../../../EntitySelector';
import { AttendanceManagementPanel } from './AttendanceManagementPanel';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface Shift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface Device {
  id: string;
  name: string;
  location?: string | null;
  deviceIdentifier: string;
  isActive: boolean;
}

interface RosterRow {
  id: string;
  date: string;
  shift: Shift;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function loadData(entityId: string) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);

  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 30);

  const from = dateString(fromDate);
  const to = dateString(toDate);

  const [employees, shifts, devices, roster] = await Promise.all([
    fetchApi<Employee[]>(
      `/hr/employees?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<Shift[]>(
      `/hr/attendance/shifts?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<Device[]>(
      `/hr/attendance/biometric/devices?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<RosterRow[]>(
      `/hr/attendance/roster?entityId=${encodeURIComponent(entityId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  ]);

  return {
    employees,
    shifts,
    devices,
    roster,
    from,
    to,
  };
}

export default async function AttendanceManagementPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Attendance management"
          subtitle="Configure shifts, build rosters, and manage biometric attendance devices."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadData>>;

  try {
    data = await loadData(entityId);
  } catch (error) {
    return (
      <PageContainer>
        <PageHeader
          title="Attendance management"
          subtitle={
            error instanceof ApiError
              ? error.message
              : 'Failed to load attendance management data.'
          }
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Attendance management"
        subtitle="Shifts, rosters, biometric devices and event reconciliation."
      />

      <AttendanceManagementPanel
        entityId={entityId}
        employees={data.employees}
        shifts={data.shifts}
        devices={data.devices}
        roster={data.roster}
        from={data.from}
        to={data.to}
      />
    </PageContainer>
  );
}
