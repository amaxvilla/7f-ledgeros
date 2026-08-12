import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrAnalyticsService } from './hr-analytics.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Read-only HR reporting — every route here computes its own figures on
 * the fly from the underlying operational tables (Employee, LeaveBalance,
 * AttendanceRecord, JobApplication, SalaryStructure, TrainingEnrollment)
 * at request time; none of them read from a separately-maintained
 * reporting table. executiveSummary is a single call bundling six of the
 * seven other routes' own results (everything except leaveUtilization,
 * which needs a year the summary doesn't ask for) — calling it is not a
 * shortcut around the individual routes' own permission or RLS behavior,
 * since it simply calls the same service methods internally.
 */
@ApiTags('hr-analytics')
@ApiBearerAuth()
@Controller('hr/analytics')
export class HrAnalyticsController {
  constructor(private readonly analytics: HrAnalyticsService) {}

  @Get('headcount')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'Get headcount broken down by department, employment type, and gender', description: 'Active employees only.' })
  headcount(@Query('entityId') entityId: string) {
    return this.analytics.headcountReport(entityId);
  }

  @Get('turnover')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Get the annualized turnover rate for a date range',
    description: 'turnoverRatePercent = exits in range / average of headcount at the start and end of the range, as a percentage. Exits are counted by lastWorkingDate falling within [from, to].',
  })
  turnover(@Query('entityId') entityId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.analytics.turnoverReport(entityId, from, to);
  }

  @Get('leave-utilization')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'Get leave entitlement vs. usage by leave type for a given year' })
  leaveUtilization(@Query('entityId') entityId: string, @Query('year') year: string) {
    return this.analytics.leaveUtilizationReport(entityId, Number(year));
  }

  @Get('attendance-summary')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'Get present/late/absent rates for a date range' })
  attendanceSummary(@Query('entityId') entityId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.analytics.attendanceSummaryReport(entityId, from, to);
  }

  @Get('hiring-funnel')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'Get job application counts by stage, and the overall hire rate', description: 'from and to are both optional — omitting either includes every application regardless of date.' })
  hiringFunnel(@Query('entityId') entityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.hiringFunnelReport(entityId, from, to);
  }

  @Get('payroll-cost')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Get current monthly payroll cost by department',
    description: 'Active, non-terminated employees only, using each employee\'s own currently-assigned salary structure — not a historical payslip total from any specific payroll run.',
  })
  payrollCost(@Query('entityId') entityId: string) {
    return this.analytics.payrollCostReport(entityId);
  }

  @Get('training-completion')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'Get the overall training completion rate', description: 'completionRatePercent = enrollments with status=ATTENDED / all enrollments, across every course and session.' })
  trainingCompletion(@Query('entityId') entityId: string) {
    return this.analytics.trainingCompletionReport(entityId);
  }

  @Get('executive-summary')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Get a single bundled HR executive dashboard',
    description: 'Combines headcount, turnover, attendance, hiring funnel, payroll cost, and training completion in one call — turnover/attendance/hiring-funnel are computed for the current calendar year to date. leaveUtilization is not included (it needs an explicit year the summary does not ask for) — call GET leave-utilization separately for that figure.',
  })
  executiveSummary(@Query('entityId') entityId: string) {
    return this.analytics.executiveSummary(entityId);
  }
}
