import Link from 'next/link';
import {
  Badge,
  DataTable,
  KpiCard,
  PageContainer,
  PageHeader,
  Select,
  tokens,
} from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { EntitySelector } from '../../../EntitySelector';
import { IssueCertificationForm } from './IssueCertificationForm';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Certification {
  id: string;
  employeeId: string;
  name: string;
  issuedBy?: string | null;
  issueDate: string;
  expiryDate?: string | null;
  certificateUrl?: string | null;
}

interface ExpiringCertification extends Certification {
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface SkillMatrixRow {
  employeeId: string;
  name: string;
  skills: {
    name: string;
    expiryDate?: string | null;
  }[];
}

async function loadData(entityId: string, employeeId?: string) {
  const employees = await fetchApi<Employee[]>(
    `/hr/employees?entityId=${encodeURIComponent(entityId)}`,
  );

  const employeeOptions: SelectOption[] = employees.map((employee) => ({
    value: employee.id,
    label: `${employee.firstName} ${employee.lastName}`,
  }));

  const selectedEmployeeId = employeeId && employees.some((e) => e.id === employeeId)
    ? employeeId
    : employees[0]?.id;

  const [matrix, expiring] = await Promise.all([
    fetchApi<SkillMatrixRow[]>(
      `/hr/training/skills-matrix?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<ExpiringCertification[]>(
      '/hr/training/certifications-expiring?daysAhead=30',
    ),
  ]);

  let certifications: Certification[] = [];

  if (selectedEmployeeId) {
    certifications = await fetchApi<Certification[]>(
      `/hr/training/certifications/${encodeURIComponent(selectedEmployeeId)}`,
    );
  }

  return {
    employeeOptions,
    selectedEmployeeId,
    certifications,
    matrix,
    expiring,
  };
}

function expiryTone(expiryDate?: string | null) {
  if (!expiryDate) return 'neutral' as const;

  const remaining = new Date(expiryDate).getTime() - Date.now();

  if (remaining < 0) return 'negative' as const;
  if (remaining <= 30 * 86_400_000) return 'warning' as const;
  return 'positive' as const;
}

export default async function TrainingCertificationsPage({
  searchParams,
}: {
  searchParams: { entityId?: string; employeeId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Training certifications"
          subtitle="Select an entity to manage certifications and review the skills matrix."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: Awaited<ReturnType<typeof loadData>>;

  try {
    data = await loadData(entityId, searchParams.employeeId);
  } catch (error) {
    return (
      <PageContainer>
        <PageHeader
          title="Training certifications"
          subtitle={
            error instanceof ApiError
              ? error.message
              : 'Failed to load training certifications.'
          }
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  const selectedEmployee =
    data.employeeOptions.find((option) => option.value === data.selectedEmployeeId);

  return (
    <PageContainer>
      <PageHeader
        title="Training certifications"
        subtitle="Issue certifications, monitor upcoming expiries, and review the entity skills matrix."
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: tokens.space(4),
          marginBottom: tokens.space(8),
        }}
      >
        <KpiCard label="Active employees" value={String(data.matrix.length)} />
        <KpiCard
          label="Expiring in 30 days"
          value={String(data.expiring.length)}
          tone={data.expiring.length > 0 ? 'warning' : 'positive'}
        />
        <KpiCard
          label="Selected employee certifications"
          value={String(data.certifications.length)}
        />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader
          title="Issue certification"
          subtitle="Create a certification directly against an employee record."
        />
        <IssueCertificationForm employeeOptions={data.employeeOptions} />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Employee certifications" />

        <form
          method="get"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 420px) auto',
            gap: tokens.space(3),
            alignItems: 'end',
            marginBottom: tokens.space(4),
          }}
        >
          <input type="hidden" name="entityId" value={entityId} />
          <Select
            label="Employee"
            name="employeeId"
            value={data.selectedEmployeeId ?? ''}
            options={data.employeeOptions}
            placeholder="Select employee"
          />
          <button
            type="submit"
            style={{
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: `${tokens.space(2)} ${tokens.space(3)}`,
              background: tokens.color.surface,
              color: tokens.color.textPrimary,
              cursor: 'pointer',
              fontFamily: tokens.font.body,
              fontSize: '13px',
            }}
          >
            View certifications
          </button>
        </form>

        <PageHeader
          title={selectedEmployee ? String(selectedEmployee.label) : 'No employee selected'}
        />

        <DataTable
          columns={[
            {
              header: 'Certification',
              render: (row: Certification) => row.name,
            },
            {
              header: 'Issued by',
              render: (row: Certification) => row.issuedBy ?? '—',
            },
            {
              header: 'Issue date',
              render: (row: Certification) =>
                new Date(row.issueDate).toLocaleDateString(),
            },
            {
              header: 'Expiry',
              render: (row: Certification) =>
                row.expiryDate
                  ? new Date(row.expiryDate).toLocaleDateString()
                  : 'No expiry',
            },
            {
              header: 'Status',
              render: (row: Certification) => (
                <Badge tone={expiryTone(row.expiryDate)}>
                  {row.expiryDate
                    ? new Date(row.expiryDate) < new Date()
                      ? 'Expired'
                      : 'Valid'
                    : 'No expiry'}
                </Badge>
              ),
            },
            {
              header: 'Certificate',
              render: (row: Certification) =>
                row.certificateUrl ? (
                  <Link
                    href={row.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: tokens.color.textPrimary,
                      textDecoration: 'none',
                    }}
                  >
                    Open
                  </Link>
                ) : (
                  '—'
                ),
            },
          ]}
          rows={data.certifications}
          keyOf={(row) => row.id}
          emptyMessage="No certifications recorded for this employee."
        />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Certifications expiring soon" />

        <DataTable
          columns={[
            {
              header: 'Employee',
              render: (row: ExpiringCertification) =>
                row.employee
                  ? `${row.employee.firstName} ${row.employee.lastName}`
                  : row.employeeId,
            },
            {
              header: 'Certification',
              render: (row: ExpiringCertification) => row.name,
            },
            {
              header: 'Expiry',
              render: (row: ExpiringCertification) =>
                row.expiryDate
                  ? new Date(row.expiryDate).toLocaleDateString()
                  : '—',
            },
            {
              header: 'Status',
              render: (row: ExpiringCertification) => (
                <Badge tone={expiryTone(row.expiryDate)}>
                  {row.expiryDate
                    ? `${Math.max(
                        0,
                        Math.ceil(
                          (new Date(row.expiryDate).getTime() - Date.now()) /
                            86_400_000,
                        ),
                      )} day(s)`
                    : '—'}
                </Badge>
              ),
            },
          ]}
          rows={data.expiring}
          keyOf={(row) => row.id}
          emptyMessage="No certifications are expiring within the next 30 days."
        />
      </section>

      <section>
        <PageHeader title="Employee skills matrix" />

        <DataTable
          columns={[
            {
              header: 'Employee',
              render: (row: SkillMatrixRow) => row.name,
            },
            {
              header: 'Certifications / skills',
              render: (row: SkillMatrixRow) =>
                row.skills.length === 0
                  ? 'None recorded'
                  : row.skills
                      .map(
                        (skill) =>
                          `${skill.name}${
                            skill.expiryDate
                              ? ` (expires ${new Date(
                                  skill.expiryDate,
                                ).toLocaleDateString()})`
                              : ''
                          }`,
                      )
                      .join(', '),
            },
          ]}
          rows={data.matrix}
          keyOf={(row) => row.employeeId}
          emptyMessage="No active employees were returned for this entity."
        />
      </section>
    </PageContainer>
  );
}
