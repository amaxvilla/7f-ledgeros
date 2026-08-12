import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveRequestStatus } from '@prisma/client';
import { LeaveService } from './leave.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('hr-leave')
@ApiBearerAuth()
@Controller('hr/leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  // ---- Leave types ----

  @Post('types')
  @ApiOperation({ summary: 'Create a leave type', description: 'code is unique per entity (409 if it already exists). isPaid defaults true, carryForwardAllowed defaults false, and maxCarryForwardDays defaults 0 when omitted.' })
  @RequirePermissions('hr.manage')
  createLeaveType(@Body() body: Parameters<LeaveService['createLeaveType']>[0]) {
    return this.leave.createLeaveType(body);
  }

  @Get('types')
  @ApiOperation({ summary: 'List leave types', description: 'entityId is an optional filter; omit it to list every leave type across every entity.' })
  @RequirePermissions('hr.view')
  findLeaveTypes(@Query('entityId') entityId?: string) {
    return this.leave.findLeaveTypes(entityId);
  }

  // ---- Balances ----

  @Post('balances/initialize')
  @ApiOperation({
    summary: 'Initialize (or reset) an employee\'s leave balance for a type/year',
    description: '404s if the leave type does not exist. An upsert: calling this again for the same employee/type/year resets entitledDays back to the leave type\'s current daysPerYear and overwrites carriedForwardDays, but leaves usedDays completely untouched either way — re-initializing does not zero out leave already taken.',
  })
  @RequirePermissions('hr.manage')
  initializeBalance(
    @Body() body: { employeeId: string; leaveTypeId: string; year: number; carriedForwardDays?: number },
  ) {
    return this.leave.initializeBalance(body.employeeId, body.leaveTypeId, body.year, body.carriedForwardDays);
  }

  @Get('balances/:employeeId')
  @ApiOperation({ summary: 'List an employee\'s leave balances', description: 'year is an optional filter; omit it to see balances across every year on record.' })
  @RequirePermissions('hr.view')
  findBalances(@Param('employeeId') employeeId: string, @Query('year') year?: string) {
    return this.leave.findBalances(employeeId, year ? Number(year) : undefined);
  }

  // ---- Requests ----

  @Post('requests')
  @ApiOperation({
    summary: 'Request leave',
    description: 'Rejected (400) if endDate is before startDate, or if the requested day count exceeds the employee\'s available balance (entitledDays + carriedForwardDays - usedDays) for that leave type/year — a missing balance record is treated as 0 available, not unlimited. Starts SUBMITTED. Needs only hr.view — this is a self-service action.',
  })
  @RequirePermissions('hr.view')
  requestLeave(@Body() body: Parameters<LeaveService['requestLeave']>[0]) {
    return this.leave.requestLeave(body);
  }

  @Post('requests/:id/approve')
  @ApiOperation({
    summary: 'Approve a submitted leave request',
    description: 'Only valid from SUBMITTED. Re-checks the balance again at approval time, independently of the check requestLeave already made — a 409 here means the balance was consumed by another approval in the meantime, a real race the service defends against rather than trusting the original request-time check alone. On success, in one transaction: increments usedDays on the balance AND upserts an ON_LEAVE attendance record for every day in the requested range.',
  })
  @RequirePermissions('hr.manage')
  approveLeaveRequest(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leave.approveLeaveRequest(id, user.id);
  }

  @Post('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a submitted leave request', description: 'Only valid from SUBMITTED. No balance or attendance changes — those only happen on approval.' })
  @RequirePermissions('hr.manage')
  rejectLeaveRequest(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.rejectLeaveRequest(id, rejectionReason, user.id);
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel a leave request', description: 'Only valid from DRAFT or SUBMITTED — an already-APPROVED request cannot be cancelled through this route. Needs only hr.view — this is a self-service action.' })
  @RequirePermissions('hr.view')
  cancelLeaveRequest(@Param('id') id: string) {
    return this.leave.cancelLeaveRequest(id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List leave requests', description: 'employeeId and status are both optional filters.' })
  @RequirePermissions('hr.view')
  findLeaveRequests(@Query('employeeId') employeeId?: string, @Query('status') status?: LeaveRequestStatus) {
    return this.leave.findLeaveRequests(employeeId, status);
  }

  // ---- Public holidays / calendar ----

  @Post('holidays')
  @ApiOperation({ summary: 'Add a public holiday', description: 'No uniqueness check — adding the same date and entity twice creates two rows, not a 409.' })
  @RequirePermissions('hr.manage')
  addPublicHoliday(@Body() body: { entityId: string; name: string; date: string }) {
    return this.leave.addPublicHoliday(body.entityId, body.name, body.date);
  }

  @Get('holidays')
  @ApiOperation({ summary: 'List public holidays for an entity', description: 'entityId is required; year is an optional filter narrowing to that calendar year (Jan 1 to Dec 31 UTC).' })
  @RequirePermissions('hr.view')
  findPublicHolidays(@Query('entityId') entityId: string, @Query('year') year?: string) {
    return this.leave.findPublicHolidays(entityId, year ? Number(year) : undefined);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get approved leave for an entity within a date range', description: 'entityId, from, and to are all required. Only APPROVED requests are included — SUBMITTED/REJECTED/CANCELLED ones never appear here regardless of date. Matches any request whose own date range overlaps [from, to] at all, not just requests that start within it.' })
  @RequirePermissions('hr.view')
  leaveCalendar(@Query('entityId') entityId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.leave.leaveCalendar(entityId, from, to);
  }
}
