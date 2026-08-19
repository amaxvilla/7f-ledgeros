import {
  Badge,
  KpiCard,
  PageContainer,
  PageHeader,
  tokens,
} from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreatePayrollRunForm } from './CreatePayrollRunForm';
import { PayrollRunsTable } from './PayrollRunsTable';

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

async function loadPayroll(entityId: string) {
  const [employees, salaryStructures, payrollRuns, accounts] =
    await Promise.all([
      fetchApi<Employee[]>(`/hr/employees?entityId=${entityId}`),
      fetchApi<SalaryStructure[]>(
        `/hr/salary-structures?entityId=${entityId}`,
      ),
      fetchApi<PayrollRun[]>(
        `/hr/payroll-runs?entityId=${entityId}`,
      ),
      fetchApi<Array<{ id: string; code: string; name: string }>>(
        `/accounts/entity/${entityId}/active`,
      ),
    ]);

  return {
    employees,
    salaryStructures,
    payrollRuns,
    accountOptions: accounts.map<SelectOption>((account) => ({
      value: account.id,
      label: `${account.code} — ${account.name}`,
    })),
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
              title="Create payroll run"
              subtitle="Start a new payroll cycle in DRAFT status."
            />
            <CreatePayrollRunForm entityId={entityId} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader
              title="Employees and Pay Grade"
              subtitle="Grade Level is stored on the Employee master record."
            />

            <div
              style={{
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: tokens.font.body,
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Employee',
                      'Job title',
                      'Grade Level',
                      'Department',
                      'Salary Structure',
                      'Basic Salary',
                      'Status',
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign: header === 'Basic Salary' ? 'right' : 'left',
                          padding: tokens.space(3),
                          borderBottom: `1px solid ${tokens.color.border}`,
                          fontSize: '12px',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((employee) => (
                    <tr key={employee.id}>
                      <td style={{ padding: tokens.space(3) }}>
                        {employee.employeeCode} — {employee.firstName}{' '}
                        {employee.lastName}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {employee.jobTitle ?? '—'}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {employee.gradeLevel ?? 'Not assigned'}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {employee.department?.name ?? '—'}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {employee.salaryStructure
                          ? `${employee.salaryStructure.code} — ${employee.salaryStructure.name}`
                          : 'Not assigned'}
                      </td>
                      <td
                        style={{
                          padding: tokens.space(3),
                          textAlign: 'right',
                        }}
                      >
                        {employee.salaryStructure
                          ? formatCurrency(
                              Number(employee.salaryStructure.basicSalary),
                            )
                          : '—'}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        <Badge
                          tone={
                            employee.isActive ? 'positive' : 'neutral'
                          }
                        >
                          {employee.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Salary Structures" />
            <a
              href={`/payroll/salary-structures?entityId=${encodeURIComponent(entityId)}`}
              style={{
                display: 'inline-block',
                marginBottom: tokens.space(4),
                color: tokens.color.textPrimary,
                textDecoration: 'none',
                fontFamily: tokens.font.body,
                fontSize: '13px',
              }}
            >
              Manage salary structures →
            </a>

            <div
              style={{
                overflowX: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: tokens.font.body,
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Code',
                      'Name',
                      'Basic',
                      'Housing',
                      'Transport',
                      'Other',
                      'Status',
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          textAlign:
                            ['Basic', 'Housing', 'Transport', 'Other'].includes(
                              header,
                            )
                              ? 'right'
                              : 'left',
                          padding: tokens.space(3),
                          borderBottom: `1px solid ${tokens.color.border}`,
                          fontSize: '12px',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.salaryStructures.map((structure) => (
                    <tr key={structure.id}>
                      <td style={{ padding: tokens.space(3) }}>
                        {structure.code}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        {structure.name}
                      </td>
                      <td style={{ padding: tokens.space(3), textAlign: 'right' }}>
                        {formatCurrency(Number(structure.basicSalary))}
                      </td>
                      <td style={{ padding: tokens.space(3), textAlign: 'right' }}>
                        {formatCurrency(Number(structure.housingAllowance))}
                      </td>
                      <td style={{ padding: tokens.space(3), textAlign: 'right' }}>
                        {formatCurrency(Number(structure.transportAllowance))}
                      </td>
                      <td style={{ padding: tokens.space(3), textAlign: 'right' }}>
                        {formatCurrency(Number(structure.otherAllowances))}
                      </td>
                      <td style={{ padding: tokens.space(3) }}>
                        <Badge
                          tone={structure.isActive ? 'positive' : 'neutral'}
                        >
                          {structure.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <PageHeader
              title="Payroll Runs"
              subtitle="Lifecycle: DRAFT → CALCULATED → APPROVED → POSTED."
            />
            <PayrollRunsTable
              rows={data.payrollRuns}
              accountOptions={data.accountOptions}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
