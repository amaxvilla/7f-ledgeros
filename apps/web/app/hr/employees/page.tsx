import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import { CreateEmployeeForm } from './CreateEmployeeForm';

export const dynamic = 'force-dynamic';

interface Employee {
  id: string;
  entityId: string;
  departmentId: string | null;
  salaryStructureId: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  jobTitle?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  department?: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

interface SalaryStructure {
  id: string;
  code: string;
  name: string;
}

/**
 * Employee list and creation surface. Employee detail at `[id]` contains
 * the lifecycle management actions and operational employee records.
 */
const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  PROBATION: 'warning',
  CONFIRMED: 'positive',
  TERMINATED: 'negative',
  RESIGNED: 'negative',
  ON_LEAVE: 'warning',
};

async function loadEmployees(entityId: string) {
  const [employees, departments, salaryStructures] = await Promise.all([
    fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
    fetchApi<Department[]>(`/dimensions/departments?entityId=${entityId}`),
    fetchApi<SalaryStructure[]>(`/hr/salary-structures?entityId=${entityId}`),
  ]);

  const departmentOptions: SelectOption[] = departments.map((d) => ({ value: d.id, label: d.name }));
  const salaryStructureOptions: SelectOption[] = salaryStructures.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));

  const probation = employees.filter((e) => e.employmentStatus === 'PROBATION').length;
  const active = employees.filter((e) => e.isActive).length;

  return {
    employees,
    departmentOptions,
    salaryStructureOptions,
    kpis: { total: employees.length, active, probation },
  };
}

export default async function EmployeesPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="Employees" subtitle="Select an entity to view its workforce." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadEmployees>> | null = null;
  let error: string | null = null;
  try {
    data = await loadEmployees(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load employees.';
  }

  return (
    <PageContainer>
      <PageHeader title="Employees" subtitle={`Entity ${entityId}`} />
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
            <KpiCard label="Total employees" value={String(data.kpis.total)} />
            <KpiCard label="Active" value={String(data.kpis.active)} tone="positive" />
            <KpiCard label="On probation" value={String(data.kpis.probation)} tone={data.kpis.probation > 0 ? 'warning' : 'neutral'} />
          </section>

          <section>
            <PageHeader title="Workforce" />
            <CreateEmployeeForm
              entityId={entityId}
              departmentOptions={data.departmentOptions}
              salaryStructureOptions={data.salaryStructureOptions}
            />
            <DataTable
              columns={[
                { header: 'Code', render: (e: Employee) => e.employeeCode },
                {
                  header: 'Name',
                  render: (e: Employee) => (
                    <Link href={`/hr/employees/${e.id}`} style={{ color: tokens.color.accent }}>
                      {e.firstName} {e.lastName}
                    </Link>
                  ),
                },
                { header: 'Department', render: (e: Employee) => e.department?.name ?? '—' },
                { header: 'Job title', render: (e: Employee) => e.jobTitle ?? '—' },
                { header: 'Type', render: (e: Employee) => e.employmentType ?? '—' },
                {
                  header: 'Status',
                  render: (e: Employee) => (
                    <Badge tone={STATUS_TONE[e.employmentStatus ?? ''] ?? 'neutral'}>{e.employmentStatus ?? 'ACTIVE'}</Badge>
                  ),
                },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (e: Employee) => (
                    <Link href={`/hr/employees/${e.id}`} style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
                      View →
                    </Link>
                  ),
                },
              ]}
              rows={data.employees}
              keyOf={(e) => e.id}
              emptyMessage="No employees yet."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
