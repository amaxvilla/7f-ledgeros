import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, LeaveRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateLeaveTypeDto {
  entityId: string;
  code: string;
  name: string;
  daysPerYear: number;
  isPaid?: boolean;
  carryForwardAllowed?: boolean;
  maxCarryForwardDays?: number;
}

interface RequestLeaveDto {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(diff, 0);
}

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // LEAVE TYPES
  // -------------------------------------------------------------------

  async createLeaveType(dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findUnique({
      where: { entityId_code: { entityId: dto.entityId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Leave type code "${dto.code}" already exists for this entity`);
    return this.prisma.leaveType.create({
      data: {
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        daysPerYear: dto.daysPerYear,
        isPaid: dto.isPaid ?? true,
        carryForwardAllowed: dto.carryForwardAllowed ?? false,
        maxCarryForwardDays: dto.maxCarryForwardDays ?? 0,
      },
    });
  }

  findLeaveTypes(entityId?: string) {
    return this.prisma.leaveType.findMany({ where: entityId ? { entityId } : undefined });
  }

  // -------------------------------------------------------------------
  // LEAVE BALANCES
  // -------------------------------------------------------------------

  /** Initializes (or resets) an employee's balance for a leave type/year at its full entitlement. */
  async initializeBalance(employeeId: string, leaveTypeId: string, year: number, carriedForwardDays = 0) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) throw new NotFoundException(`Leave type ${leaveTypeId} not found`);

    return this.prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
      create: { employeeId, leaveTypeId, year, entitledDays: leaveType.daysPerYear, carriedForwardDays },
      update: { entitledDays: leaveType.daysPerYear, carriedForwardDays },
    });
  }

  findBalances(employeeId: string, year?: number) {
    return this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true },
    });
  }

  // -------------------------------------------------------------------
  // LEAVE REQUESTS
  // -------------------------------------------------------------------

  async requestLeave(dto: RequestLeaveDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('endDate cannot be before startDate');
    const daysRequested = daysBetweenInclusive(startDate, endDate);

    const year = startDate.getUTCFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year } },
    });
    const available = balance
      ? Number(balance.entitledDays) + Number(balance.carriedForwardDays) - Number(balance.usedDays)
      : 0;
    if (daysRequested > available) {
      throw new BadRequestException(
        `Requested ${daysRequested} day(s) exceeds available balance of ${available} day(s) for ${year}`,
      );
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        daysRequested,
        reason: dto.reason,
        status: LeaveRequestStatus.SUBMITTED,
      },
    });
  }

  /** Approving deducts the balance and creates an ON_LEAVE attendance record for each day. */
  async approveLeaveRequest(id: string, approvedById: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Leave request ${id} not found`);
    if (request.status !== LeaveRequestStatus.SUBMITTED) {
      throw new ConflictException(`Leave request must be SUBMITTED to approve (currently ${request.status})`);
    }

    const year = request.startDate.getUTCFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year } },
    });
    if (!balance) throw new ConflictException('No leave balance record exists for this employee/type/year');
    const available = Number(balance.entitledDays) + Number(balance.carriedForwardDays) - Number(balance.usedDays);
    if (Number(request.daysRequested) > available) {
      throw new ConflictException('Insufficient balance remains — it may have been consumed by another approval since this request was submitted');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: { increment: request.daysRequested } },
      });

      const dayCount = daysBetweenInclusive(request.startDate, request.endDate);
      const attendanceRows = Array.from({ length: dayCount }, (_, i) => {
        const date = new Date(request.startDate);
        date.setUTCDate(date.getUTCDate() + i);
        return { employeeId: request.employeeId, date, status: AttendanceStatus.ON_LEAVE };
      });
      for (const row of attendanceRows) {
        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: row.employeeId, date: row.date } },
          create: row,
          update: { status: AttendanceStatus.ON_LEAVE },
        });
      }

      return tx.leaveRequest.update({
        where: { id },
        data: { status: LeaveRequestStatus.APPROVED, approvedById, approvedAt: new Date() },
      });
    });
  }

  async rejectLeaveRequest(id: string, rejectionReason: string, approvedById: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Leave request ${id} not found`);
    if (request.status !== LeaveRequestStatus.SUBMITTED) {
      throw new ConflictException(`Leave request must be SUBMITTED to reject (currently ${request.status})`);
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveRequestStatus.REJECTED, rejectionReason, approvedById, approvedAt: new Date() },
    });
  }

  async cancelLeaveRequest(id: string) {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Leave request ${id} not found`);
    if (!([LeaveRequestStatus.DRAFT, LeaveRequestStatus.SUBMITTED] as LeaveRequestStatus[]).includes(request.status)) {
      throw new ConflictException(`Cannot cancel a leave request that is already ${request.status}`);
    }
    return this.prisma.leaveRequest.update({ where: { id }, data: { status: LeaveRequestStatus.CANCELLED } });
  }

  findLeaveRequests(employeeId?: string, status?: LeaveRequestStatus) {
    return this.prisma.leaveRequest.findMany({
      where: { employeeId, status },
      include: { leaveType: true },
      orderBy: { startDate: 'desc' },
    });
  }

  // -------------------------------------------------------------------
  // PUBLIC HOLIDAYS / LEAVE CALENDAR
  // -------------------------------------------------------------------

  addPublicHoliday(entityId: string, name: string, date: string) {
    return this.prisma.publicHoliday.create({ data: { entityId, name, date: new Date(date) } });
  }

  findPublicHolidays(entityId: string, year?: number) {
    return this.prisma.publicHoliday.findMany({
      where: {
        entityId,
        date: year ? { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } : undefined,
      },
      orderBy: { date: 'asc' },
    });
  }

  /** Approved leave for an entity within a date range — the "leave calendar" view. */
  async leaveCalendar(entityId: string, from: string, to: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveRequestStatus.APPROVED,
        employee: { entityId },
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } }, leaveType: true },
      orderBy: { startDate: 'asc' },
    });
  }
}
