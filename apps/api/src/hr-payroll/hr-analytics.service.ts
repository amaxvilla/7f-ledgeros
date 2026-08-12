import { Injectable } from '@nestjs/common';
import { ApplicationStage, AttendanceStatus, EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class HrAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // HEADCOUNT / DIVERSITY
  // -------------------------------------------------------------------

  async headcountReport(entityId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { entityId, isActive: true },
      select: { departmentId: true, employmentType: true, employmentStatus: true, gender: true, department: { select: { name: true } } },
    });

    const byDepartment = new Map<string, number>();
    const byEmploymentType = new Map<string, number>();
    const byGender = new Map<string, number>();

    for (const e of employees) {
      const dept = e.department?.name ?? 'Unassigned';
      byDepartment.set(dept, (byDepartment.get(dept) ?? 0) + 1);
      byEmploymentType.set(e.employmentType, (byEmploymentType.get(e.employmentType) ?? 0) + 1);
      const gender = e.gender ?? 'UNSPECIFIED';
      byGender.set(gender, (byGender.get(gender) ?? 0) + 1);
    }

    return {
      totalHeadcount: employees.length,
      byDepartment: Object.fromEntries(byDepartment),
      byEmploymentType: Object.fromEntries(byEmploymentType),
      byGender: Object.fromEntries(byGender),
    };
  }

  // -------------------------------------------------------------------
  // TURNOVER / ATTRITION
  // -------------------------------------------------------------------

  /** Annualized turnover % = exits in range / average headcount in range. */
  async turnoverReport(entityId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [exits, headcountStart, headcountEnd] = await Promise.all([
      this.prisma.employeeExit.count({
        where: { employee: { entityId }, lastWorkingDate: { gte: fromDate, lte: toDate } },
      }),
      this.prisma.employee.count({ where: { entityId, hireDate: { lte: fromDate } } }),
      this.prisma.employee.count({ where: { entityId, hireDate: { lte: toDate } } }),
    ]);

    const avgHeadcount = (headcountStart + headcountEnd) / 2 || 1;
    return {
      periodFrom: fromDate,
      periodTo: toDate,
      exits,
      averageHeadcount: avgHeadcount,
      turnoverRatePercent: round2((exits / avgHeadcount) * 100),
    };
  }

  // -------------------------------------------------------------------
  // LEAVE UTILIZATION
  // -------------------------------------------------------------------

  async leaveUtilizationReport(entityId: string, year: number) {
    const balances = await this.prisma.leaveBalance.findMany({
      where: { year, employee: { entityId } },
      include: { leaveType: true },
    });

    const byType = new Map<string, { entitled: number; used: number }>();
    for (const b of balances) {
      const key = b.leaveType.name;
      const current = byType.get(key) ?? { entitled: 0, used: 0 };
      current.entitled += Number(b.entitledDays) + Number(b.carriedForwardDays);
      current.used += Number(b.usedDays);
      byType.set(key, current);
    }

    return Array.from(byType.entries()).map(([leaveType, v]) => ({
      leaveType,
      entitledDays: round2(v.entitled),
      usedDays: round2(v.used),
      utilizationPercent: v.entitled > 0 ? round2((v.used / v.entitled) * 100) : 0,
    }));
  }

  // -------------------------------------------------------------------
  // ATTENDANCE
  // -------------------------------------------------------------------

  async attendanceSummaryReport(entityId: string, from: string, to: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { employee: { entityId }, date: { gte: new Date(from), lte: new Date(to) } },
    });

    const counts: Record<string, number> = {};
    for (const status of Object.values(AttendanceStatus)) counts[status] = 0;
    for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;

    const total = records.length || 1;
    return {
      totalRecords: records.length,
      counts,
      presentRatePercent: round2(((counts.PRESENT ?? 0) / total) * 100),
      lateRatePercent: round2(((counts.LATE ?? 0) / total) * 100),
      absentRatePercent: round2(((counts.ABSENT ?? 0) / total) * 100),
    };
  }

  // -------------------------------------------------------------------
  // RECRUITMENT / HIRING FUNNEL
  // -------------------------------------------------------------------

  async hiringFunnelReport(entityId: string, from?: string, to?: string) {
    const applications = await this.prisma.jobApplication.findMany({
      where: {
        vacancy: { entityId },
        appliedAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      select: { stage: true },
    });

    const counts: Record<string, number> = {};
    for (const stage of Object.values(ApplicationStage)) counts[stage] = 0;
    for (const a of applications) counts[a.stage] = (counts[a.stage] ?? 0) + 1;

    const applied = applications.length || 1;
    return {
      totalApplications: applications.length,
      byStage: counts,
      hireRatePercent: round2(((counts.HIRED ?? 0) / applied) * 100),
    };
  }

  // -------------------------------------------------------------------
  // PAYROLL COST / SALARY ANALYSIS
  // -------------------------------------------------------------------

  async payrollCostReport(entityId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { entityId, isActive: true, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      include: { salaryStructure: true, department: { select: { name: true } } },
    });

    const byDepartment = new Map<string, number>();
    let total = 0;
    for (const e of employees) {
      const s = e.salaryStructure;
      const monthly = s
        ? Number(s.basicSalary) + Number(s.housingAllowance) + Number(s.transportAllowance) + Number(s.otherAllowances)
        : 0;
      total += monthly;
      const dept = e.department?.name ?? 'Unassigned';
      byDepartment.set(dept, (byDepartment.get(dept) ?? 0) + monthly);
    }

    return {
      headcountCosted: employees.length,
      totalMonthlyPayrollCost: round2(total),
      byDepartment: Object.fromEntries(Array.from(byDepartment.entries()).map(([k, v]) => [k, round2(v)])),
    };
  }

  // -------------------------------------------------------------------
  // TRAINING / SUCCESSION COVERAGE
  // -------------------------------------------------------------------

  async trainingCompletionReport(entityId: string) {
    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: { session: { course: { entityId } } },
      select: { status: true },
    });
    const total = enrollments.length || 1;
    const attended = enrollments.filter((e) => e.status === 'ATTENDED').length;
    return {
      totalEnrollments: enrollments.length,
      attended,
      completionRatePercent: round2((attended / total) * 100),
    };
  }

  // -------------------------------------------------------------------
  // EXECUTIVE HR DASHBOARD (single call summarizing the above)
  // -------------------------------------------------------------------

  async executiveSummary(entityId: string) {
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    const today = now.toISOString();

    const [headcount, turnover, attendance, funnel, payrollCost, training] = await Promise.all([
      this.headcountReport(entityId),
      this.turnoverReport(entityId, yearStart, today),
      this.attendanceSummaryReport(entityId, yearStart, today),
      this.hiringFunnelReport(entityId, yearStart, today),
      this.payrollCostReport(entityId),
      this.trainingCompletionReport(entityId),
    ]);

    return { headcount, turnover, attendance, recruitment: funnel, payrollCost, training };
  }
}
