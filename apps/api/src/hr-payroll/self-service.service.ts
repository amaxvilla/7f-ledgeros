import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveService } from './leave.service';
import { TrainingService } from './training.service';
import { EmployeeLifecycleService } from './employee-lifecycle.service';

interface UpdateMyProfileDto {
  phone?: string;
  personalEmail?: string;
  residentialAddress?: string;
}

interface ApplyMyLeaveDto {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

/**
 * Every method here takes the authenticated userId and resolves it to the
 * caller's own Employee record — a self-service caller can never pass an
 * arbitrary employeeId. Employee.userId must be set (via updateProfile
 * from the HR side) for a user to have ESS access at all.
 */
@Injectable()
export class SelfServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leave: LeaveService,
    private readonly training: TrainingService,
    private readonly lifecycle: EmployeeLifecycleService,
  ) {}

  async myProfile(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.lifecycle.findOneEmployee(employeeId);
  }

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    const employeeId = await this.resolveEmployeeId(userId);
    // Deliberately narrow: ESS cannot self-edit jobTitle, gradeLevel, salary,
    // department, or employmentStatus — those stay HR/manager-only via the
    // employee-lifecycle and employment-event endpoints.
    return this.prisma.employee.update({ where: { id: employeeId }, data: dto });
  }

  async myPayslips(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.prisma.payslip.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
  }

  async myAttendance(userId: string, from?: string, to?: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } },
      orderBy: { date: 'desc' },
    });
  }

  async myLeaveBalances(userId: string, year?: number) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.leave.findBalances(employeeId, year ?? new Date().getUTCFullYear());
  }

  async applyMyLeave(userId: string, dto: ApplyMyLeaveDto) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.leave.requestLeave({ employeeId, ...dto });
  }

  async myLeaveRequests(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.leave.findLeaveRequests(employeeId);
  }

  async myPerformanceHistory(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.prisma.performanceReview.findMany({ where: { employeeId }, include: { cycle: true }, orderBy: { createdAt: 'desc' } });
  }

  async myGoals(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.prisma.goal.findMany({ where: { employeeId } });
  }

  async myTrainingEnrollments(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.training.findEnrollments(employeeId);
  }

  async enrolMyselfInTraining(userId: string, sessionId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.training.enrol(sessionId, employeeId);
  }

  async myCertifications(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.training.findCertifications(employeeId);
  }

  async uploadMyDocument(userId: string, documentType: string, fileUrl: string, description?: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    return this.lifecycle.addDocument({ employeeId, documentType, fileUrl, description }, userId);
  }

  // -------------------------------------------------------------------
  // INTERNAL
  // -------------------------------------------------------------------

  private async resolveEmployeeId(userId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      throw new ForbiddenException('No employee record is linked to this account — Employee Self-Service is not available');
    }
    return employee.id;
  }
}
