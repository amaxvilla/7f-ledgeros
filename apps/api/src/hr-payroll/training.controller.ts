import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrainingSessionStatus } from '@prisma/client';
import { TrainingService } from './training.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Course catalogue, scheduled sessions/calendar, enrolment, post-training
 * evaluation, certification, and a derived skills matrix. Confirmed
 * directly against `TrainingService`: despite `evaluateTraining`'s own
 * service-level doc comment saying it issues a certificate "in one
 * call" when certifying, the method body only ever updates the
 * enrollment's own rating/comments/score — certification is always a
 * separate `POST certifications` call, not a side effect of evaluation.
 */
@ApiTags('hr-training')
@ApiBearerAuth()
@Controller('hr/training')
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  // ---- Courses ----

  @Post('courses')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Create a training course', description: 'Rejected if the code is already used by another course in the same entity (entityId+code is unique).' })
  createCourse(@Body() body: Parameters<TrainingService['createCourse']>[0]) {
    return this.training.createCourse(body);
  }

  @Get('courses')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List training courses', description: 'Active courses only, optionally filtered by entityId.' })
  findCourses(@Query('entityId') entityId?: string) {
    return this.training.findCourses(entityId);
  }

  // ---- Sessions / calendar ----

  @Post('sessions')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Schedule a training session', description: 'The course must already exist. Rejected if endDate is before startDate.' })
  createSession(@Body() body: Parameters<TrainingService['createSession']>[0]) {
    return this.training.createSession(body);
  }

  @Get('sessions')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List training sessions', description: 'Optionally filtered by courseId/status, ordered by start date ascending.' })
  findSessions(@Query('courseId') courseId?: string, @Query('status') status?: TrainingSessionStatus) {
    return this.training.findSessions(courseId, status);
  }

  @Get('calendar')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Training calendar for a date range',
    description: 'Sessions whose own date range overlaps [from, to] at all (not sessions starting within the window only) — a session that starts before `from` but ends after it is still included.',
  })
  findCalendar(@Query('entityId') entityId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.training.findCalendar(entityId, from, to);
  }

  // ---- Enrolment ----

  @Post('enrol')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Enrol an employee in a training session',
    description: 'Rejected if the session is CANCELLED, or if this employee is already enrolled in it (sessionId+employeeId is unique).',
  })
  enrol(@Body('sessionId') sessionId: string, @Body('employeeId') employeeId: string) {
    return this.training.enrol(sessionId, employeeId);
  }

  @Post('enrollments/:id/attended')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Mark an enrollment as attended' })
  markAttended(@Param('id') id: string) {
    return this.training.markAttended(id);
  }

  @Post('enrollments/:id/cancel')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Cancel an enrollment' })
  cancelEnrollment(@Param('id') id: string) {
    return this.training.cancelEnrollment(id);
  }

  @Post('enrollments/:id/evaluate')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Record a post-training evaluation for an enrollment',
    description:
      'Only callable once the enrollment is marked ATTENDED. evaluationRating must be between 1 and 5. Does NOT issue a certificate as a side effect — certification is always its own separate call.',
  })
  evaluateTraining(@Param('id') id: string, @Body() body: Parameters<TrainingService['evaluateTraining']>[1]) {
    return this.training.evaluateTraining(id, body);
  }

  @Get('enrollments')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List training enrollments', description: 'Optionally filtered by employeeId/sessionId. Includes each session\'s own course and any linked certification.' })
  findEnrollments(@Query('employeeId') employeeId?: string, @Query('sessionId') sessionId?: string) {
    return this.training.findEnrollments(employeeId, sessionId);
  }

  // ---- Certification ----

  @Post('certifications')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Issue a certification',
    description: 'If linked to a trainingEnrollmentId, rejected when that enrollment already has a certification (one certification per enrollment). Can also be issued standalone, with no linked enrollment at all.',
  })
  issueCertification(@Body() body: Parameters<TrainingService['issueCertification']>[0]) {
    return this.training.issueCertification(body);
  }

  @Get('certifications/:employeeId')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List an employee\'s certifications', description: 'Newest issue date first.' })
  findCertifications(@Param('employeeId') employeeId: string) {
    return this.training.findCertifications(employeeId);
  }

  @Get('certifications-expiring')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'List certifications expiring soon',
    description: 'Certifications whose expiryDate falls between now and daysAhead days from now (default 30) — feeds renewal reminders. Already-expired certifications are not included.',
  })
  findExpiringCertifications(@Query('daysAhead') daysAhead?: string) {
    return this.training.findExpiringCertifications(daysAhead ? Number(daysAhead) : 30);
  }

  // ---- Skills matrix ----

  @Get('skills-matrix')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Skills matrix: active employees vs their held certifications',
    description: 'Derived on the fly from Certification records, not a separately-stored skills matrix — every active employee in the entity, each with a list of their own certification names and expiry dates.',
  })
  skillsMatrix(@Query('entityId') entityId: string) {
    return this.training.skillsMatrix(entityId);
  }
}
