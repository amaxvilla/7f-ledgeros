import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InterviewService } from './interview.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('recruitment-interviews')
@ApiBearerAuth()
@Controller('recruitment/interviews')
export class InterviewController {
  constructor(private readonly interviews: InterviewService) {}

  @Get('calendar-sync/failures')
  @ApiOperation({
    summary: 'List interviews with a failed calendar sync',
    description: 'Backs the "needs attention" widget — a plain filter on calendarSyncFailedAt, not a separate aggregation table. entityId is optional; omitted gives the cross-entity total.',
  })
  @RequirePermissions('recruitment.view')
  calendarSyncFailures(@Query('entityId') entityId?: string) {
    return this.interviews.findWithFailedCalendarSync(entityId);
  }

  @Get('teams-sync/failures')
  @ApiOperation({ summary: 'List interviews with a failed Teams meeting sync', description: 'Same shape as the calendar-sync failures list above, for the separate teamsSyncFailedAt flag.' })
  @RequirePermissions('recruitment.view')
  teamsSyncFailures(@Query('entityId') entityId?: string) {
    return this.interviews.findWithFailedTeamsSync(entityId);
  }

  @Post()
  @ApiOperation({
    summary: 'Schedule an interview',
    description: 'Moves the application into the INTERVIEW stage if it was APPLIED/SCREENING/SHORTLISTED. Then, best-effort and never blocking the create: syncs a Microsoft Graph calendar event, and — only when location is exactly "video-call" — creates a Teams meeting. Either sync failing just leaves the interview without that link; it does not fail this call.',
  })
  @RequirePermissions('recruitment.manage')
  schedule(@Body() body: Parameters<InterviewService['schedule']>[0]) {
    return this.interviews.schedule(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an interview', description: 'Includes its interviewers (with employee), its own feedback, and the job application (with candidate).' })
  @RequirePermissions('recruitment.view')
  findOne(@Param('id') id: string) {
    return this.interviews.findOne(id);
  }

  @Get('application/:jobApplicationId')
  @ApiOperation({ summary: 'List every interview for a job application', description: 'Ordered by scheduled time, earliest first.' })
  @RequirePermissions('recruitment.view')
  findForApplication(@Param('jobApplicationId') jobApplicationId: string) {
    return this.interviews.findForApplication(jobApplicationId);
  }

  @Get('interviewer/:employeeId/upcoming')
  @ApiOperation({ summary: 'List an interviewer\'s upcoming interviews', description: 'SCHEDULED interviews only — rescheduled, cancelled, or completed ones are excluded.' })
  @RequirePermissions('recruitment.view')
  findUpcoming(@Param('employeeId') employeeId: string) {
    return this.interviews.findUpcomingForInterviewer(employeeId);
  }

  @Patch(':id/reschedule')
  @ApiOperation({
    summary: 'Reschedule an interview',
    description: 'Sets status to RESCHEDULED. If a calendar event already exists, best-effort updates it too — a failure here does not fail the reschedule itself, it just marks the sync as failed for later retry.',
  })
  @RequirePermissions('recruitment.manage')
  reschedule(@Param('id') id: string, @Body() body: Parameters<InterviewService['reschedule']>[1]) {
    return this.interviews.reschedule(id, body);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel an interview',
    description: 'Sets status to CANCELLED. If a calendar event and/or a Teams meeting exist, best-effort cancels each independently — either failing does not fail the cancel itself, it just marks that particular sync as failed for later retry.',
  })
  @RequirePermissions('recruitment.manage')
  cancel(@Param('id') id: string) {
    return this.interviews.cancel(id);
  }

  @Post(':id/retry-calendar-sync')
  @ApiOperation({
    summary: 'Manually retry a failed calendar sync',
    description: 'Two shapes depending on how it failed: no calendarEventId yet re-runs the original create; one already existing retries whichever call last failed (a cancel if the interview is now CANCELLED, otherwise an update). Unlike the best-effort sync during schedule/reschedule/cancel, a repeat failure here IS surfaced as a 409 — there is no primary write left to protect.',
  })
  @RequirePermissions('recruitment.manage')
  retryCalendarSync(@Param('id') id: string) {
    return this.interviews.retryCalendarSync(id);
  }

  @Post(':id/retry-teams-sync')
  @ApiOperation({
    summary: 'Manually retry a failed Teams meeting sync',
    description: 'Same two-shape retry as the calendar-sync retry above, but narrower: no updateMeeting exists for Teams, so there is no "retry an update" case — only "the create never happened" or "a later cancel failed". A repeat failure is surfaced as a 409, same reasoning as the calendar retry.',
  })
  @RequirePermissions('recruitment.manage')
  retryTeamsSync(@Param('id') id: string) {
    return this.interviews.retryTeamsSync(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark an interview complete', description: 'A manual alternative to the automatic completion submitFeedback triggers once every panelist has submitted their feedback.' })
  @RequirePermissions('recruitment.manage')
  complete(@Param('id') id: string) {
    return this.interviews.complete(id);
  }

  @Patch(':id/no-show')
  @ApiOperation({ summary: 'Mark a candidate as a no-show for this interview' })
  @RequirePermissions('recruitment.manage')
  noShow(@Param('id') id: string) {
    return this.interviews.markNoShow(id);
  }

  @Post(':id/feedback')
  @ApiOperation({
    summary: 'Submit interviewer feedback for an interview',
    description: 'Only an assigned panelist can submit, and only once per panelist (409 on a second attempt). Rating must be 1-5. Once every panelist assigned has submitted, the interview is automatically marked COMPLETED as a side effect of this call.',
  })
  @RequirePermissions('recruitment.interview')
  submitFeedback(@Param('id') id: string, @Body() body: Omit<Parameters<InterviewService['submitFeedback']>[0], 'interviewId'>) {
    return this.interviews.submitFeedback({ ...body, interviewId: id });
  }

  @Get(':id/feedback')
  @ApiOperation({ summary: 'List every feedback submitted for an interview', description: 'One row per panelist who has submitted so far, each including its own employee record.' })
  @RequirePermissions('recruitment.view')
  findFeedback(@Param('id') id: string) {
    return this.interviews.findFeedback(id);
  }

  @Get('application/:jobApplicationId/average-rating')
  @ApiOperation({
    summary: 'Get the average interview rating for a job application',
    description: 'Averaged across every feedback row submitted for any of the application\'s interviews (rounded to 2 decimal places); null if no feedback has been submitted yet. Used for candidate scoring.',
  })
  @RequirePermissions('recruitment.view')
  averageRating(@Param('jobApplicationId') jobApplicationId: string) {
    return this.interviews.averageRatingForApplication(jobApplicationId);
  }

  @Get(':id/interviewer-presence')
  @ApiOperation({
    summary: 'Get each panelist\'s current Microsoft Graph presence',
    description: 'Lets a recruiter see who is currently online before deciding whether to reschedule around a likely-unavailable interviewer. Resolved by each panelist\'s own workEmail. Best-effort per panelist — one panelist\'s lookup failing (missing grant, no workEmail on file, throttling) never fails the whole call; that panelist is returned with presence: null and a presenceError instead of being dropped from the list.',
  })
  @RequirePermissions('recruitment.view')
  interviewerPresence(@Param('id') id: string) {
    return this.interviews.interviewerPresence(id);
  }
}
