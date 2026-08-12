import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SelfServiceService } from './self-service.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Employee Self-Service — every route here resolves the authenticated
 * caller's own `userId` to their own `Employee` record server-side
 * (`SelfServiceService.resolveEmployeeId`, confirmed directly); there is
 * no employeeId param anywhere on this controller for a caller to pass
 * someone else's id into. A caller with no linked Employee record gets a
 * 403 on every route, not a 404 — confirmed directly against
 * `resolveEmployeeId`'s own exception, which fires before any of these
 * handlers' own logic runs.
 *
 * Deliberately no `@RequirePermissions` anywhere on this controller —
 * confirmed directly, not an oversight: every route's own scope is
 * inherently "the caller's own record," so there is nothing an RBAC
 * permission would narrow beyond what `resolveEmployeeId` already
 * enforces. Authentication alone (the global guard) is the only gate.
 */
@ApiTags('hr-self-service')
@ApiBearerAuth()
@Controller('hr/me')
export class SelfServiceController {
  constructor(private readonly ess: SelfServiceService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get my own employee profile' })
  myProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myProfile(user.id);
  }

  @Post('profile')
  @ApiOperation({
    summary: 'Update my own profile',
    description: 'Deliberately narrow: only phone, personalEmail, and residentialAddress can be self-edited here. jobTitle, gradeLevel, salary, department, and employmentStatus all stay HR/manager-only, via the employee-lifecycle and employment-event routes instead.',
  })
  updateMyProfile(@Body() body: Parameters<SelfServiceService['updateMyProfile']>[1], @CurrentUser() user: AuthenticatedUser) {
    return this.ess.updateMyProfile(user.id, body);
  }

  @Get('payslips')
  @ApiOperation({ summary: 'List my own payslips', description: 'Newest first.' })
  myPayslips(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myPayslips(user.id);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'List my own attendance records', description: 'Optional from/to date filter.' })
  myAttendance(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ess.myAttendance(user.id, from, to);
  }

  @Get('leave/balances')
  @ApiOperation({ summary: 'Get my own leave balances', description: 'Defaults to the current year if year is omitted.' })
  myLeaveBalances(@CurrentUser() user: AuthenticatedUser, @Query('year') year?: string) {
    return this.ess.myLeaveBalances(user.id, year ? Number(year) : undefined);
  }

  @Post('leave/apply')
  @ApiOperation({ summary: 'Apply for leave', description: 'Delegates to the same LeaveService.requestLeave every other leave-application path uses, with employeeId resolved server-side rather than accepted from the caller.' })
  applyMyLeave(@Body() body: Parameters<SelfServiceService['applyMyLeave']>[1], @CurrentUser() user: AuthenticatedUser) {
    return this.ess.applyMyLeave(user.id, body);
  }

  @Get('leave/requests')
  @ApiOperation({ summary: 'List my own leave requests' })
  myLeaveRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myLeaveRequests(user.id);
  }

  @Get('performance/history')
  @ApiOperation({ summary: 'List my own performance review history', description: 'Includes each review\'s own cycle. Newest first.' })
  myPerformanceHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myPerformanceHistory(user.id);
  }

  @Get('performance/goals')
  @ApiOperation({ summary: 'List my own goals' })
  myGoals(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myGoals(user.id);
  }

  @Get('training/enrollments')
  @ApiOperation({ summary: 'List my own training enrollments' })
  myTrainingEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myTrainingEnrollments(user.id);
  }

  @Post('training/enrol')
  @ApiOperation({
    summary: 'Enrol myself in a training session',
    description: 'Delegates to the same TrainingService.enrol every other enrolment path uses — rejected if the session is CANCELLED, or if I am already enrolled in it.',
  })
  enrolMyselfInTraining(@Body('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ess.enrolMyselfInTraining(user.id, sessionId);
  }

  @Get('training/certifications')
  @ApiOperation({ summary: 'List my own certifications' })
  myCertifications(@CurrentUser() user: AuthenticatedUser) {
    return this.ess.myCertifications(user.id);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Upload a document to my own employee record' })
  uploadMyDocument(
    @Body('documentType') documentType: string,
    @Body('fileUrl') fileUrl: string,
    @Body('description') description: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ess.uploadMyDocument(user.id, documentType, fileUrl, description);
  }
}
