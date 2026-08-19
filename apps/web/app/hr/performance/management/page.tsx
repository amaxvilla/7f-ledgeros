import {
  PageContainer,
  PageHeader,
} from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../../../lib/api';
import { EntitySelector } from '../../../EntitySelector';
import { PerformanceManagementPanel } from './PerformanceManagementPanel';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  weight?: number | string | null;
  progressPercent: number | string;
  status: string;
  targetDate?: string | null;
}

interface Kpi {
  id: string;
  name: string;
  targetValue: number | string;
  actualValue?: number | string | null;
  unit?: string | null;
  weight?: number | string | null;
}

interface Competency {
  id: string;
  name: string;
  description?: string | null;
}

interface Assessment {
  id: string;
  rating: number | string;
  comments?: string | null;
  competency: {
    id: string;
    name: string;
  };
}

async function loadData(entityId: string, employeeId?: string) {
  const [employees, competencies] = await Promise.all([
    fetchApi<Employee[]>(
      `/hr/employees?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<Competency[]>('/hr/performance/competencies'),
  ]);

  const employeeOptions: SelectOption[] = employees.map((employee) => ({
    value: employee.id,
    label: `${employee.firstName} ${employee.lastName}`,
  }));

  const competencyOptions: SelectOption[] = competencies.map((competency) => ({
    value: competency.id,
    label: competency.name,
  }));

  const selectedEmployeeId =
    employeeId && employees.some((employee) => employee.id === employeeId)
      ? employeeId
      : employees[0]?.id;

  if (!selectedEmployeeId) {
    return {
      employeeOptions,
      competencyOptions,
      selectedEmployeeId: '',
      goals: [] as Goal[],
      kpis: [] as Kpi[],
      assessments: [] as Assessment[],
    };
  }

  const [goals, kpis, assessments] = await Promise.all([
    fetchApi<Goal[]>(
      `/hr/performance/goals/${encodeURIComponent(selectedEmployeeId)}`,
    ),
    fetchApi<Kpi[]>(
      `/hr/performance/kpis/${encodeURIComponent(selectedEmployeeId)}`,
    ),
    fetchApi<Assessment[]>(
      `/hr/performance/competency-assessments/${encodeURIComponent(selectedEmployeeId)}`,
    ),
  ]);

  return {
    employeeOptions,
    competencyOptions,
    selectedEmployeeId,
    goals,
    kpis,
    assessments,
  };
}

export default async function PerformanceManagementPage({
  searchParams,
}: {
  searchParams: {
    entityId?: string;
    employeeId?: string;
  };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="Performance management"
          subtitle="Goals, KPIs, competencies and employee assessments."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  try {
    const data = await loadData(entityId, searchParams.employeeId);

    return (
      <PageContainer>
        <PageHeader
          title="Performance management"
          subtitle="Manage OKRs, KPI actuals, competency catalog and employee assessments."
        />

        <PerformanceManagementPanel
          employeeOptions={data.employeeOptions}
          competencyOptions={data.competencyOptions}
          goals={data.goals}
          kpis={data.kpis}
          assessments={data.assessments}
        />
      </PageContainer>
    );
  } catch (error) {
    return (
      <PageContainer>
        <PageHeader
          title="Performance management"
          subtitle={
            error instanceof ApiError
              ? error.message
              : 'Failed to load performance management data.'
          }
        />
        <EntitySelector />
      </PageContainer>
    );
  }
}
