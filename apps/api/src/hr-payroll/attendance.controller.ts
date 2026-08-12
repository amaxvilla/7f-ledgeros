import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('hr-attendance')
@ApiBearerAuth()
@Controller('hr/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // ---- Shifts / roster ----

  @Post('shifts')
  @ApiOperation({ summary: 'Create a shift', description: 'code is unique per entity (409 if it already exists). breakMinutes defaults to 0 when omitted.' })
  @RequirePermissions('hr.manage')
  createShift(@Body() body: Parameters<AttendanceService['createShift']>[0]) {
    return this.attendance.createShift(body);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'List shifts', description: 'entityId is an optional filter; omit it to list every shift across every entity.' })
  @RequirePermissions('hr.view')
  findShifts(@Query('entityId') entityId?: string) {
    return this.attendance.findShifts(entityId);
  }

  @Post('roster')
  @ApiOperation({ summary: 'Assign an employee to a shift for one date', description: 'An upsert on (employeeId, date) — re-assigning the same employee on a date they already have an assignment for silently overwrites the shift, it does not 409.' })
  @RequirePermissions('hr.manage')
  assignShift(@Body() body: { employeeId: string; shiftId: string; date: string }) {
    return this.attendance.assignShift(body.employeeId, body.shiftId, body.date);
  }

  @Get('roster')
  @ApiOperation({ summary: 'List shift assignments for a date range', description: 'entityId, from, and to are all required — unlike most list routes in this controller, none of the three is optional here.' })
  @RequirePermissions('hr.view')
  findRoster(@Query('entityId') entityId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.attendance.findRoster(entityId, from, to);
  }

  // ---- Attendance ----

  @Post('clock-in')
  @ApiOperation({
    summary: 'Clock in',
    description: 'An upsert on (employeeId, date) — a second clock-in the same day overwrites the first rather than 409ing. Status is computed automatically: LATE if a shift is assigned for the day and the clock-in is more than 15 minutes past the shift start time, PRESENT otherwise. Needs only hr.view, not hr.manage — this is a self-service action, not an admin one.',
  })
  @RequirePermissions('hr.view')
  clockIn(@Body() body: Parameters<AttendanceService['clockIn']>[0]) {
    return this.attendance.clockIn(body);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out', description: '404s if there is no clock-in record for this employee already today — clock-out cannot create a record on its own. Same hr.view self-service level as clock-in.' })
  @RequirePermissions('hr.view')
  clockOut(@Body() body: Parameters<AttendanceService['clockOut']>[0]) {
    return this.attendance.clockOut(body);
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'List one employee\'s attendance records', description: 'from and to are both optional — omitting either leaves that end of the date range unbounded.' })
  @RequirePermissions('hr.view')
  findAttendance(@Param('employeeId') employeeId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.attendance.findAttendance(employeeId, from, to);
  }

  @Post('mark-absentees')
  @ApiOperation({ summary: 'Mark every active employee with no attendance record for a day as ABSENT', description: 'Meant to run as an end-of-day batch job. Only creates records for employees with no record at all that day — never touches or overwrites an existing record, including one already marked ABSENT.' })
  @RequirePermissions('hr.manage')
  markAbsentees(@Body() body: { entityId: string; date: string }) {
    return this.attendance.markAbsentees(body.entityId, body.date);
  }

  // ---- Biometric abstraction ----

  @Post('biometric/devices')
  @ApiOperation({ summary: 'Register a biometric device', description: 'deviceIdentifier is unique per entity (409 if already registered). No vendor SDK is wired in here — any hardware vendor integrates by having its own adapter call pushBiometricEvent with whatever raw employee code the device reports.' })
  @RequirePermissions('hr.manage')
  registerDevice(@Body() body: Parameters<AttendanceService['registerDevice']>[0]) {
    return this.attendance.registerDevice(body);
  }

  @Get('biometric/devices')
  @ApiOperation({ summary: 'List biometric devices', description: 'entityId is an optional filter; omit it to list every device across every entity.' })
  @RequirePermissions('hr.view')
  findDevices(@Query('entityId') entityId?: string) {
    return this.attendance.findDevices(entityId);
  }

  @Post('biometric/events')
  @ApiOperation({ summary: 'Ingest a raw punch event from a biometric device', description: '404s if the device is unknown, 400s if it is registered but inactive. Stores the event unprocessed — matching it to an actual employee and folding it into an AttendanceRecord happens separately, via reconcile.' })
  @RequirePermissions('hr.manage')
  pushBiometricEvent(@Body() body: Parameters<AttendanceService['pushBiometricEvent']>[0]) {
    return this.attendance.pushBiometricEvent(body);
  }

  @Post('biometric/reconcile')
  @ApiOperation({
    summary: 'Fold unprocessed biometric punches into attendance records',
    description: 'Matches events to Employee.employeeCode; a code that matches no employee is left unprocessed for manual review rather than silently dropped. For each matched employee/day, takes the earliest CLOCK_IN and latest CLOCK_OUT among that day\'s events (not every individual punch) and upserts one AttendanceRecord, computing LATE/PRESENT the same way clock-in does.',
  })
  @RequirePermissions('hr.manage')
  reconcile(@Body('entityId') entityId: string) {
    return this.attendance.reconcileBiometricEvents(entityId);
  }
}
