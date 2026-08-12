import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceSource, AttendanceStatus, BiometricEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateShiftDto {
  entityId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
}

interface ClockDto {
  employeeId: string;
  timestamp: string;
}

interface RegisterBiometricDeviceDto {
  entityId: string;
  name: string;
  location?: string;
  deviceIdentifier: string;
}

interface PushBiometricEventDto {
  deviceId: string;
  rawEmployeeCode: string;
  eventType: BiometricEventType;
  eventTime: string;
}

/** Minutes past midnight local-clock, from an "HH:MM" string. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const LATE_GRACE_MINUTES = 15;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // SHIFTS / ROSTER
  // -------------------------------------------------------------------

  async createShift(dto: CreateShiftDto) {
    const existing = await this.prisma.shift.findUnique({
      where: { entityId_code: { entityId: dto.entityId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Shift code "${dto.code}" already exists for this entity`);
    return this.prisma.shift.create({ data: { ...dto, breakMinutes: dto.breakMinutes ?? 0 } });
  }

  findShifts(entityId?: string) {
    return this.prisma.shift.findMany({ where: entityId ? { entityId } : undefined });
  }

  async assignShift(employeeId: string, shiftId: string, date: string) {
    return this.prisma.shiftAssignment.upsert({
      where: { employeeId_date: { employeeId, date: new Date(date) } },
      create: { employeeId, shiftId, date: new Date(date) },
      update: { shiftId },
    });
  }

  findRoster(entityId: string, from: string, to: string) {
    return this.prisma.shiftAssignment.findMany({
      where: {
        employee: { entityId },
        date: { gte: new Date(from), lte: new Date(to) },
      },
      include: { shift: true, employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // ATTENDANCE (manual / mobile clock-in)
  // -------------------------------------------------------------------

  async clockIn(dto: ClockDto) {
    const clockIn = new Date(dto.timestamp);
    const date = this.dateOnly(clockIn);
    const status = await this.computeLateStatus(dto.employeeId, date, clockIn);

    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: { employeeId: dto.employeeId, date, clockIn, source: AttendanceSource.MANUAL, status },
      update: { clockIn, status },
    });
  }

  async clockOut(dto: ClockDto) {
    const clockOut = new Date(dto.timestamp);
    const date = this.dateOnly(clockOut);
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
    });
    if (!record) throw new NotFoundException('No clock-in found for this employee today');
    return this.prisma.attendanceRecord.update({ where: { id: record.id }, data: { clockOut } });
  }

  findAttendance(employeeId: string, from?: string, to?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      orderBy: { date: 'desc' },
    });
  }

  /** Marks anyone with no attendance record for a working day as ABSENT — run as an end-of-day job. */
  async markAbsentees(entityId: string, date: string) {
    const day = this.dateOnly(new Date(date));
    const employees = await this.prisma.employee.findMany({ where: { entityId, isActive: true } });
    const existing = await this.prisma.attendanceRecord.findMany({
      where: { date: day, employee: { entityId } },
      select: { employeeId: true },
    });
    const alreadyMarked = new Set(existing.map((e) => e.employeeId));
    const toMark = employees.filter((e) => !alreadyMarked.has(e.id));

    if (toMark.length === 0) return { marked: 0 };
    await this.prisma.attendanceRecord.createMany({
      data: toMark.map((e) => ({ employeeId: e.id, date: day, status: AttendanceStatus.ABSENT })),
    });
    return { marked: toMark.length };
  }

  // -------------------------------------------------------------------
  // BIOMETRIC ABSTRACTION
  // -------------------------------------------------------------------
  // Any biometric hardware vendor integrates by having its adapter call
  // pushBiometricEvent() with whatever raw employee code the device
  // reports. reconcileBiometricEvents() then does the code -> Employee
  // lookup and folds unprocessed punches into AttendanceRecord. No
  // vendor SDK is wired in here — that lives in a device-specific
  // adapter outside this service.

  async registerDevice(dto: RegisterBiometricDeviceDto) {
    const existing = await this.prisma.biometricDevice.findUnique({
      where: { entityId_deviceIdentifier: { entityId: dto.entityId, deviceIdentifier: dto.deviceIdentifier } },
    });
    if (existing) throw new ConflictException('This device is already registered for this entity');
    return this.prisma.biometricDevice.create({ data: dto });
  }

  findDevices(entityId?: string) {
    return this.prisma.biometricDevice.findMany({ where: entityId ? { entityId } : undefined });
  }

  async pushBiometricEvent(dto: PushBiometricEventDto) {
    const device = await this.prisma.biometricDevice.findUnique({ where: { id: dto.deviceId } });
    if (!device) throw new NotFoundException(`Biometric device ${dto.deviceId} not found`);
    if (!device.isActive) throw new BadRequestException('Device is not active');

    return this.prisma.biometricEventLog.create({
      data: {
        deviceId: dto.deviceId,
        rawEmployeeCode: dto.rawEmployeeCode,
        eventType: dto.eventType,
        eventTime: new Date(dto.eventTime),
      },
    });
  }

  /**
   * Matches unprocessed events to Employee.employeeCode, folds the
   * earliest CLOCK_IN and latest CLOCK_OUT per employee/day into
   * AttendanceRecord, and marks the events processed. Unmatched codes
   * are left unprocessed for manual review rather than silently dropped.
   */
  async reconcileBiometricEvents(entityId: string) {
    const events = await this.prisma.biometricEventLog.findMany({
      where: { processed: false, device: { entityId } },
      orderBy: { eventTime: 'asc' },
    });
    if (events.length === 0) return { reconciled: 0, unmatched: 0 };

    const employees = await this.prisma.employee.findMany({ where: { entityId } });
    const byCode = new Map(employees.map((e) => [e.employeeCode, e]));

    const grouped = new Map<string, { employeeId: string; date: Date; clockIn?: Date; clockOut?: Date; eventIds: string[] }>();
    let unmatched = 0;

    for (const ev of events) {
      const employee = byCode.get(ev.rawEmployeeCode);
      if (!employee) {
        unmatched++;
        continue;
      }
      const date = this.dateOnly(ev.eventTime);
      const key = `${employee.id}:${date.toISOString()}`;
      const bucket = grouped.get(key) ?? { employeeId: employee.id, date, eventIds: [] };
      if (ev.eventType === BiometricEventType.CLOCK_IN) {
        if (!bucket.clockIn || ev.eventTime < bucket.clockIn) bucket.clockIn = ev.eventTime;
      } else if (!bucket.clockOut || ev.eventTime > bucket.clockOut) {
        bucket.clockOut = ev.eventTime;
      }
      bucket.eventIds.push(ev.id);
      grouped.set(key, bucket);
    }

    let reconciled = 0;
    for (const bucket of grouped.values()) {
      const status = bucket.clockIn
        ? await this.computeLateStatus(bucket.employeeId, bucket.date, bucket.clockIn)
        : AttendanceStatus.PRESENT;

      await this.prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: bucket.employeeId, date: bucket.date } },
        create: {
          employeeId: bucket.employeeId,
          date: bucket.date,
          clockIn: bucket.clockIn,
          clockOut: bucket.clockOut,
          source: AttendanceSource.BIOMETRIC,
          status,
        },
        update: { clockIn: bucket.clockIn, clockOut: bucket.clockOut, source: AttendanceSource.BIOMETRIC, status },
      });
      await this.prisma.biometricEventLog.updateMany({
        where: { id: { in: bucket.eventIds } },
        data: { processed: true, processedAt: new Date(), employeeId: bucket.employeeId },
      });
      reconciled++;
    }

    return { reconciled, unmatched };
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private dateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /** LATE if a shift is assigned for the day and clock-in is past start-time + grace period. */
  private async computeLateStatus(employeeId: string, date: Date, clockIn: Date): Promise<AttendanceStatus> {
    const assignment = await this.prisma.shiftAssignment.findUnique({
      where: { employeeId_date: { employeeId, date } },
      include: { shift: true },
    });
    if (!assignment) return AttendanceStatus.PRESENT;

    const clockInMinutes = clockIn.getUTCHours() * 60 + clockIn.getUTCMinutes();
    const shiftStartMinutes = toMinutes(assignment.shift.startTime);
    return clockInMinutes > shiftStartMinutes + LATE_GRACE_MINUTES ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
  }
}
