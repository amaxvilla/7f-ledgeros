import { KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../../lib/api';
import { EntitySelector } from '../../EntitySelector';
import {
  AttendanceTable,
  BreakdownTable,
  DepartmentTable,
  LeaveUtilizationTable,
  PayrollCostTable,
} from './HrAnalyticsTables';

export const dynamic = 'force-dynamic';

interface HeadcountReport {
  totalHeadcount: number;
  byDepartment: Record<string, number>;
  byEmploymentType: Record<string, number>;
  byGender: Record<string, number>;
}

interface TurnoverReport {
  periodFrom: string;
  periodTo: string;
  exits: number;
  averageHeadcount: number;
  turnoverRatePercent: number;
}

interface AttendanceReport {
  totalRecords: number;
  counts: Record<string, number>;
  presentRatePercent: number;
  lateRatePercent: number;
  absentRatePercent: number;
}

interface HiringReport {
  totalApplications: number;
  byStage: Record<string, number>;
  hireRatePercent: number;
}

interface PayrollCostReport {
  headcountCosted: number;
  totalMonthlyPayrollCost: number;
  byDepartment: Record<string, number>;
}

interface TrainingReport {
  totalEnrollments: number;
  attended: number;
  completionRatePercent: number;
}

interface LeaveUtilizationRow {
  leaveType: string;
  entitledDays: number;
  usedDays: number;
  utilizationPercent: number;
}

interface AnalyticsData {
  headcount: HeadcountReport;
  turnover: TurnoverReport;
  attendance: AttendanceReport;
  hiring: HiringReport;
  payrollCost: PayrollCostReport;
  training: TrainingReport;
  leaveUtilization: LeaveUtilizationRow[];
  periodFrom: string;
  periodTo: string;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function loadAnalytics(entityId: string, year: number): Promise<AnalyticsData> {
  const currentYear = getCurrentYear();
  const from = new Date(Date.UTC(year, 0, 1));
  const to =
    year === currentYear
      ? new Date()
      : new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const fromText = toDateString(from);
  const toText = toDateString(to);

  const [
    headcount,
    turnover,
    attendance,
    hiring,
    payrollCost,
    training,
    leaveUtilization,
  ] = await Promise.all([
    fetchApi<HeadcountReport>(
      `/hr/analytics/headcount?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<TurnoverReport>(
      `/hr/analytics/turnover?entityId=${encodeURIComponent(entityId)}&from=${fromText}&to=${toText}`,
    ),
    fetchApi<AttendanceReport>(
      `/hr/analytics/attendance-summary?entityId=${encodeURIComponent(entityId)}&from=${fromText}&to=${toText}`,
    ),
    fetchApi<HiringReport>(
      `/hr/analytics/hiring-funnel?entityId=${encodeURIComponent(entityId)}&from=${fromText}&to=${toText}`,
    ),
    fetchApi<PayrollCostReport>(
      `/hr/analytics/payroll-cost?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<TrainingReport>(
      `/hr/analytics/training-completion?entityId=${encodeURIComponent(entityId)}`,
    ),
    fetchApi<LeaveUtilizationRow[]>(
      `/hr/analytics/leave-utilization?entityId=${encodeURIComponent(entityId)}&year=${year}`,
    ),
  ]);

  return {
    headcount,
    turnover,
    attendance,
    hiring,
    payrollCost,
    training,
    leaveUtilization,
    periodFrom: fromText,
    periodTo: toText,
  };
}

export default async function HrAnalyticsPage({
  searchParams,
}: {
  searchParams: { entityId?: string; year?: string };
}) {
  const entityId = searchParams.entityId;
  const requestedYear = Number(searchParams.year);
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : getCurrentYear();

  if (!entityId) {
    return (
      <PageContainer>
        <PageHeader
          title="HR Analytics"
          subtitle="Select an entity to view workforce analytics."
        />
        <EntitySelector />
      </PageContainer>
    );
  }

  let data: AnalyticsData | null = null;
  let error: string | null = null;

  try {
    data = await loadAnalytics(entityId, year);
  } catch (e) {
    error =
      e instanceof ApiError
        ? e.message
        : 'Failed to load HR analytics.';
  }

  const years = Array.from(
    { length: 5 },
    (_, index) => getCurrentYear() - index,
  );

  return (
    <PageContainer>
      <PageHeader
        title="HR Analytics"
        subtitle={`Entity ${entityId} - reporting year ${year}`}
      />

      <EntitySelector initialValue={entityId} />

      <form
        method="get"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: tokens.space(3),
          flexWrap: 'wrap',
          marginBottom: tokens.space(6),
        }}
      >
        <input type="hidden" name="entityId" value={entityId} />

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.space(1),
            fontFamily: tokens.font.body,
            fontSize: '13px',
          }}
        >
          Reporting year
          <select
            name="year"
            defaultValue={String(year)}
            style={{
              minWidth: '150px',
              minHeight: '40px',
              padding: `0 ${tokens.space(3)}`,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.sm,
              background: tokens.color.surface,
              color: tokens.color.textPrimary,
              fontFamily: tokens.font.body,
            }}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          style={{
            minHeight: '40px',
            padding: `0 ${tokens.space(4)}`,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            background: tokens.color.surfaceRaised,
            color: tokens.color.textPrimary,
            fontFamily: tokens.font.body,
            cursor: 'pointer',
          }}
        >
          Refresh analytics
        </button>
      </form>

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
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard
              label="Headcount"
              value={String(data.headcount.totalHeadcount)}
            />
            <KpiCard
              label="Turnover"
              value={`${data.turnover.turnoverRatePercent}%`}
              caption={`${data.turnover.exits} exits`}
              tone={
                data.turnover.turnoverRatePercent > 15
                  ? 'negative'
                  : 'neutral'
              }
            />
            <KpiCard
              label="Present rate"
              value={`${data.attendance.presentRatePercent}%`}
              caption={`${data.attendance.totalRecords} records`}
              tone={
                data.attendance.presentRatePercent >= 90
                  ? 'positive'
                  : 'warning'
              }
            />
            <KpiCard
              label="Hire rate"
              value={`${data.hiring.hireRatePercent}%`}
              caption={`${data.hiring.totalApplications} applications`}
            />
            <KpiCard
              label="Monthly payroll cost"
              value={formatCurrency(
                data.payrollCost.totalMonthlyPayrollCost,
              )}
              caption={`${data.payrollCost.headcountCosted} employees costed`}
            />
            <KpiCard
              label="Training completion"
              value={`${data.training.completionRatePercent}%`}
              caption={`${data.training.attended} / ${data.training.totalEnrollments} attended`}
              tone={
                data.training.completionRatePercent >= 70
                  ? 'positive'
                  : 'warning'
              }
            />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Headcount by department" />
            <DepartmentTable
              rows={Object.entries(data.headcount.byDepartment).map(
                ([department, count]) => ({
                  department,
                  count,
                }),
              )}
            />
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(320px, 1fr))',
              gap: tokens.space(6),
              marginBottom: tokens.space(8),
            }}
          >
            <div>
              <PageHeader title="Employment type mix" />
              <BreakdownTable
                rows={Object.entries(data.headcount.byEmploymentType).map(
                  ([label, count]) => ({
                    label,
                    count,
                  }),
                )}
              />
            </div>

            <div>
              <PageHeader title="Gender mix" />
              <BreakdownTable
                rows={Object.entries(data.headcount.byGender).map(
                  ([label, count]) => ({
                    label,
                    count,
                  }),
                )}
              />
            </div>
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title={`Leave utilization - ${year}`} />
            <LeaveUtilizationTable rows={data.leaveUtilization} />
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(320px, 1fr))',
              gap: tokens.space(6),
              marginBottom: tokens.space(8),
            }}
          >
            <div>
              <PageHeader
                title={`Attendance - ${data.periodFrom} to ${data.periodTo}`}
              />
              <AttendanceTable
                rows={Object.entries(data.attendance.counts).map(
                  ([status, count]) => ({
                    status,
                    count,
                  }),
                )}
              />
            </div>

            <div>
              <PageHeader title={`Hiring funnel - ${year}`} />
              <BreakdownTable
                rows={Object.entries(data.hiring.byStage).map(
                  ([label, count]) => ({
                    label,
                    count,
                  }),
                )}
              />
            </div>
          </section>

          <section>
            <PageHeader title="Payroll cost by department" />
            <PayrollCostTable
              rows={Object.entries(data.payrollCost.byDepartment).map(
                ([department, amount]) => ({
                  department,
                  amount,
                }),
              )}
            />
          </section>
        </>
      )}
    </PageContainer>
  );
}
