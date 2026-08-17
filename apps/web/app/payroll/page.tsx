import {
  Badge,
  DataTable,
  KpiCard,
  PageContainer,
  PageHeader,
  tokens,
} from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';

export const dynamic = 'force-dynamic';

interface SalaryStructure {
  id: string;
  entityId: string;
  code: string;
  name: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  isActive: boolean;
}

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
  gradeLevel?: string | null;
  employmentType?: string;
  employmentStatus?: string;
  salaryStructure?: SalaryStructure | null;
  department?: {
    name: string;
  } | null;
}

interface PayrollRun {
  id: string;
  entityId: string;
  payPeriodName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED';
  journalEntryId: string | null;
  _count: {
    payslips: number;
  };
}

const STATUS_TONE: Record<
  PayrollRun['status'],
  'positive' | 'negative' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  CALCULATED: 'warning',
  APPROVED: 'positive',
  POSTED: 'positive',
};

async function loadPayroll(entityId: string) {
  const [employees, salaryStructures, payrollRuns] = await Promise.all([
    fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
    fetchApi<SalaryStructure[]>(
      `/hr/salary-structures?entityId=${entityId}`,
    ),
    fetchApi<PayrollRun[]>(
      `/hr/payroll-runs?entityId=${entityId}`,
    ),
  ]);

  return {
    employees,
    salaryStructures,
    payrollRuns,
  };
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Payroll"
          subtitle="Select an entity to manage payroll."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadPayroll>> | null = null;
  let error: string | null = null;

  try {
    data = await loadPayroll(entityId);
  } catch (e) {
    error =
      e instanceof ApiError
        ? e.message
        : 'Failed to load payroll data.';
  }

  const employeesWithGrade =
    data?.employees.filter((employee) => employee.gradeLevel) ?? [];

  const employeesWithoutSalary =
    data?.employees.filter((employee) => !employee.salaryStructureId)
      .length ?? 0;

  const activeRuns =
    data?.payrollRuns.filter((run) => run.status !== 'POSTED').length ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Payroll"
        subtitle={`Entity ${entityId}`}
      />

      <EntitySelector initialValue={entityId} />

      {error && (
        <div
          style={{
            color: tokens.color.negative,
            fontFamily: tokens.font.body,
            marginBottom: tokens.space(6),
          }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard
              label="Active employees"
              value={String(data.employees.length)}
            />
            <KpiCard
              label="Employees with grade level"
              value={String(employeesWithGrade.length)}
            />
            <KpiCard
              label="Salary structures"
              value={String(data.salaryStructures.length)}
            />
            <KpiCard
              label="Employees without salary"
              value={String(employeesWithoutSalary)}
              tone={
                employeesWithoutSalary > 0
                  ? 'warning'
                  : 'positive'
              }
            />
            <KpiCard
              label="Open payroll runs"
              value={String(activeRuns)}
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader
              title="Employees and Pay Grade"
              subtitle="Grade Level is stored on the Employee master record."
            />

            <DataTable
              columns={[
                {
                  header: 'Employee',
                  render: (r: Employee) =>
                    `${r.employeeCode} — ${r.firstName} ${r.lastName}`,
                },
                {
                  header: 'Job title',
                  render: (r: Employee) => r.jobTitle ?? '—',
                },
                {
                  header: 'Grade Level',
                  render: (r: Employee) =>
                    r.gradeLevel ?? 'Not assigned',
                },
                {
                  header: 'Department',
                  render: (r: Employee) =>
                    r.department?.name ?? '—',
                },
                {
                  header: 'Salary Structure',
                  render: (r: Employee) =>
                    r.salaryStructure
                      ? `${r.salaryStructure.code} — ${r.salaryStructure.name}`
                      : 'Not assigned',
                },
                {
                  header: 'Basic Salary',
                  align: 'right',
                  render: (r: Employee) =>
                    r.salaryStructure
                      ? formatCurrency(
                          Number(r.salaryStructure.basicSalary),
                        )
                      : '—',
                },
                {
                  header: 'Status',
                  render: (r: Employee) => (
                    <Badge
                      tone={
                        r.isActive ? 'positive' : 'neutral'
                      }
                    >
                      {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  ),
                },
              ]}
              rows={data.employees}
              keyOf={(r) => r.id}
              emptyMessage="No active employees for this entity."
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Salary Structures" />

            <DataTable
              columns={[
                {
                  header: 'Code',
                  render: (r: SalaryStructure) => r.code,
                },
                {
                  header: 'Name',
                  render: (r: SalaryStructure) => r.name,
                },
                {
                  header: 'Basic',
                  align: 'right',
                  render: (r: SalaryStructure) =>
                    formatCurrency(Number(r.basicSalary)),
                },
                {
                  header: 'Housing',
                  align: 'right',
                  render: (r: SalaryStructure) =>
                    formatCurrency(
                      Number(r.housingAllowance),
                    ),
                },
                {
                  header: 'Transport',
                  align: 'right',
                  render: (r: SalaryStructure) =>
                    formatCurrency(
                      Number(r.transportAllowance),
                    ),
                },
                {
                  header: 'Other',
                  align: 'right',
                  render: (r: SalaryStructure) =>
                    formatCurrency(
                      Number(r.otherAllowances),
                    ),
                },
                {
                  header: 'Status',
                  render: (r: SalaryStructure) => (
                    <Badge
                      tone={
                        r.isActive ? 'positive' : 'neutral'
                      }
                    >
                      {r.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  ),
                },
              ]}
              rows={data.salaryStructures}
              keyOf={(r) => r.id}
              emptyMessage="No salary structures configured."
            />
          </section>

          <section>
            <PageHeader title="Payroll Runs" />

            <DataTable
              columns={[
                {
                  header: 'Pay Period',
                  render: (r: PayrollRun) => r.payPeriodName,
                },
                {
                  header: 'Start',
                  render: (r: PayrollRun) =>
                    new Date(
                      r.payPeriodStart,
                    ).toLocaleDateString(),
                },
                {
                  header: 'End',
                  render: (r: PayrollRun) =>
                    new Date(
                      r.payPeriodEnd,
                    ).toLocaleDateString(),
                },
                {
                  header: 'Payslips',
                  align: 'right',
                  render: (r: PayrollRun) =>
                    String(r._count.payslips),
                },
                {
                  header: 'Status',
                  render: (r: PayrollRun) => (
                    <Badge tone={STATUS_TONE[r.status]}>
                      {r.status}
                    </Badge>
                  ),
                },
                {
                  header: 'Journal',
                  render: (r: PayrollRun) =>
                    r.journalEntryId ? 'POSTED' : '—',
                },
              ]}
              rows={data.payrollRuns}
              keyOf={(r) => r.id}
              emptyMessage="No payroll runs created for this entity."
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
