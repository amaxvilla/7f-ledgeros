import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { HrDepartmentTable, HrHiringTable } from './HrTables';

export const dynamic = 'force-dynamic';

interface HrExecutiveSummary {
  headcount: {
    totalHeadcount: number;
    byDepartment: Record<string, number>;
    byEmploymentType: Record<string, number>;
    byGender: Record<string, number>;
  };
  turnover: {
    exits: number;
    averageHeadcount: number;
    turnoverRatePercent: number;
  };
  attendance: {
    totalRecords: number;
    presentRatePercent: number;
    lateRatePercent: number;
    absentRatePercent: number;
  };
  recruitment: {
    totalApplications: number;
    byStage: Record<string, number>;
    hireRatePercent: number;
  };
  payrollCost: {
    headcountCosted: number;
    totalMonthlyPayrollCost: number;
    byDepartment: Record<string, number>;
  };
  training: {
    totalEnrollments: number;
    attended: number;
    completionRatePercent: number;
  };
}

interface DepartmentRow {
  department: string;
  headcount: number;
  monthlyPayrollCost: number;
}

interface StageRow {
  stage: string;
  count: number;
}

/**
 * Frontend Completion, FE-2.1 â€” opens Stage FE-2 (Dashboard) and picks
 * HR as its first slice for the same reason FE-1.3's own release report
 * recommended it: `HrAnalyticsController` (`hr/analytics`, `hr.view`)
 * already ships a full `executiveSummary(entityId)` aggregate â€”
 * headcount, turnover, attendance, hiring funnel, payroll cost, and
 * training all in one call, the exact "one dashboard-shaped endpoint,
 * zero new backend work" shape `crm-analytics`/`real-estate-analytics`
 * already established for CRM/Real Estate's own pages â€” while
 * `apps/web/app/hr` didn't exist at all. Search and Theme (this
 * checkpoint's other two candidates, named in FE-1.3's own release
 * report) both still lack that: Search has no backend index/query
 * surface, and Theme needs a `tokens` architecture change, not a page.
 *
 * Entity-scoped (`GET /hr/analytics/executive-summary?entityId=`, same
 * `entityId` query-param + `EntitySelector` pattern every other
 * multi-entity page here already uses â€” CRM, Payments, Recruitment,
 * Fixed Assets, etc.), unlike `my-security` (user-scoped) or `security`
 * (system-wide).
 *
 * `byDepartment` on both `headcount` and `payrollCost` are separate
 * `Record<string, number>` maps keyed by department name â€” merged
 * client-side into one `DepartmentRow[]` below (department names line
 * up because both come from the same `Employee.department` relation on
 * the same `entityId`) rather than adding a new combined backend
 * endpoint for what's a one-line `Object.keys` join. `byGender`/
 * `byEmploymentType` are NOT rendered as their own table â€” the KPI-row
 * + two-table shape below already covers what a Checkpoint-sized page
 * needs; a future checkpoint can add a demographics breakdown if asked
 * for, rather than this one guessing at a layout for data nobody's
 * requested yet (same "don't build a section for data with no
 * confirmed need" discipline `api-gateway/page.tsx`'s own doc comment
 * already applied to a KPI section it deliberately left out).
 */
async function loadHrDashboard(entityId: string) {
  return fetchApi<HrExecutiveSummary>(`/hr/analytics/executive-summary?entityId=${entityId}`);
}

export default async function HrDashboardPage({
  searchParams,
}: {
  searchParams: { entityId?: string };
}) {
  const entityId = searchParams.entityId;

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader title="HR" subtitle="Enter an entity ID to view its HR dashboard." />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: HrExecutiveSummary | null = null;
  let error: string | null = null;
  try {
    data = await loadHrDashboard(entityId);
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load HR dashboard data.';
  }

  const departmentRows: DepartmentRow[] = data
    ? Array.from(new Set([...Object.keys(data.headcount.byDepartment), ...Object.keys(data.payrollCost.byDepartment)])).map(
        (department) => ({
          department,
          headcount: data!.headcount.byDepartment[department] ?? 0,
          monthlyPayrollCost: data!.payrollCost.byDepartment[department] ?? 0,
        }),
      )
    : [];

  const stageRows: StageRow[] = data
    ? Object.entries(data.recruitment.byStage).map(([stage, count]) => ({ stage, count }))
    : [];

  return (
    <PageContainer>
      <PageHeader title="HR" subtitle={`Entity ${entityId}`} />
      <EntitySelector initialValue={entityId} />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
            <KpiCard label="Headcount" value={String(data.headcount.totalHeadcount)} />
            <KpiCard
              label="Turnover (YTD)"
              value={`${data.turnover.turnoverRatePercent}%`}
              tone={data.turnover.turnoverRatePercent > 15 ? 'negative' : 'neutral'}
              caption={`${data.turnover.exits} exits`}
            />
            <KpiCard
              label="Attendance â€” present"
              value={`${data.attendance.presentRatePercent}%`}
              tone={data.attendance.presentRatePercent >= 90 ? 'positive' : 'warning'}
              caption={`${data.attendance.totalRecords} records (YTD)`}
            />
            <KpiCard
              label="Hire rate"
              value={`${data.recruitment.hireRatePercent}%`}
              caption={`${data.recruitment.totalApplications} applications (YTD)`}
            />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4), marginBottom: tokens.space(8) }}>
            <KpiCard label="Monthly payroll cost" value={formatCurrency(data.payrollCost.totalMonthlyPayrollCost)} caption={`${data.payrollCost.headcountCosted} employees costed`} />
            <KpiCard
              label="Training completion"
              value={`${data.training.completionRatePercent}%`}
              tone={data.training.completionRatePercent >= 70 ? 'positive' : 'warning'}
              caption={`${data.training.attended} / ${data.training.totalEnrollments} attended`}
            />
            <KpiCard label="Late rate" value={`${data.attendance.lateRatePercent}%`} tone={data.attendance.lateRatePercent > 10 ? 'warning' : 'neutral'} />
            <KpiCard label="Absent rate" value={`${data.attendance.absentRatePercent}%`} tone={data.attendance.absentRatePercent > 5 ? 'negative' : 'neutral'} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Headcount and payroll cost by department" />
            <HrDepartmentTable rows={departmentRows} />
          </section>

          <section>
            <PageHeader title="Hiring funnel (YTD)" />
            <HrHiringTable rows={stageRows} />
          </section>
        </>
      )}
    </PageContainer>
  );
}

