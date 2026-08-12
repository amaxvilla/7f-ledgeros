import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationStage } from '@prisma/client';
import { CandidateService } from './candidate.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@ApiTags('recruitment-candidates')
@ApiBearerAuth()
@Controller('recruitment')
export class CandidateController {
  constructor(private readonly candidates: CandidateService) {}

  // ---- Candidates ----

  @Post('candidates')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Create or update a candidate profile',
    description:
      'Upsert keyed by email, not id. A brand-new candidate gets a best-effort Outlook contact created; an existing candidate whose contact already synced gets that contact updated instead — both failures set contactSyncFailedAt rather than blocking the profile write.',
  })
  upsertCandidate(@Body() body: Parameters<CandidateService['upsertCandidate']>[0]) {
    return this.candidates.upsertCandidate(body);
  }

  @Get('candidates/contact-sync/failures')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'List candidates with a failed Outlook contact sync',
    description:
      'Every candidate whose contactSyncFailedAt is set, newest failure first — the source list behind the recruitment "needs attention" widget\'s contact-sync half. A candidate with no applications yet can still appear here.',
  })
  contactSyncFailures(@Query('entityId') entityId?: string) {
    return this.candidates.findWithFailedContactSync(entityId);
  }

  @Get('candidates')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: 'List candidates', description: 'Optionally filtered by a partial, case-sensitive email match.' })
  findCandidates(@Query('email') email?: string) {
    return this.candidates.findCandidates(email);
  }

  @Get('candidates/:id')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'Get a candidate profile',
    description: 'Includes documents and every application (each with its own vacancy, interviews, and offer).',
  })
  findCandidate(@Param('id') id: string) {
    return this.candidates.findCandidate(id);
  }

  @Post('candidates/:id/retry-contact-sync')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Retry a failed Outlook contact sync',
    description:
      'Rejected if there is no failed sync to retry. If the original create never succeeded, retries the create; if a later edit failed to sync against an existing contact, retries the update against that same contact instead of creating a duplicate.',
  })
  retryContactSync(@Param('id') id: string) {
    return this.candidates.retryContactSync(id);
  }

  @Post('employees/:id/retry-directory-sync')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Retry a failed Google Workspace directory-account sync for a hired employee',
    description:
      'Rejected if there is no failed sync to retry, or if a directory user already exists (no update/suspend retry path exists yet — only the original create can be retried).',
  })
  retryDirectorySync(@Param('id') id: string) {
    return this.candidates.retryDirectorySync(id);
  }

  @Post('candidates/documents')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({ summary: 'Attach a document to a candidate', description: 'E.g. a resume/CV. The candidate must already exist.' })
  addDocument(@Body() body: Parameters<CandidateService['addDocument']>[0]) {
    return this.candidates.addDocument(body);
  }

  @Get('candidates/:id/documents')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: "List a candidate's documents" })
  findDocuments(@Param('id') id: string) {
    return this.candidates.findDocuments(id);
  }

  // ---- Applications / Hiring Pipeline ----

  @Post('applications')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Apply a candidate to a vacancy',
    description: 'Rejected if the vacancy is not OPEN, or if this candidate has already applied to it. Starts at the APPLIED stage.',
  })
  apply(@Body() body: Parameters<CandidateService['apply']>[0]) {
    return this.candidates.apply(body);
  }

  @Get('applications/:id')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'Get an application',
    description: 'Includes candidate, vacancy, every interview (with its own feedback), offer, and background check.',
  })
  findApplication(@Param('id') id: string) {
    return this.candidates.findApplication(id);
  }

  @Get('vacancies/:vacancyId/applications')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: 'List applications for a vacancy', description: 'Optionally filtered by pipeline stage.' })
  findApplicationsForVacancy(@Param('vacancyId') vacancyId: string, @Query('stage') stage?: ApplicationStage) {
    return this.candidates.findApplicationsForVacancy(vacancyId, stage);
  }

  @Patch('applications/:id/stage')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Move an application to a different pipeline stage',
    description:
      'The pipeline is forward-only (APPLIED -> SCREENING -> SHORTLISTED -> INTERVIEW -> OFFER -> HIRED); moving backward, or moving an application that is already in a terminal stage, is rejected. REJECTED/WITHDRAWN are reachable from any non-terminal stage. HIRED cannot be set here at all — use the hire endpoint, which also provisions the employee record.',
  })
  advanceStage(@Param('id') id: string, @Body() body: { stage: ApplicationStage; rejectionReason?: string }) {
    return this.candidates.advanceStage(id, body.stage, body.rejectionReason);
  }

  @Patch('applications/:id/score')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({ summary: 'Set an application\'s score', description: 'Must be between 0 and 100. Independent of pipeline stage.' })
  setScore(@Param('id') id: string, @Body() body: { score: number }) {
    return this.candidates.setScore(id, body.score);
  }

  @Post('applications/:id/hire')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Hire a candidate, provisioning an Employee record',
    description:
      'Requires the application to be at the OFFER stage with an ACCEPTED offer, and — if a background check exists for it — that check must be CLEARED. Creates the Employee row and moves the application to HIRED in one transaction, then best-effort creates a Google Workspace directory account (failure sets directorySyncFailedAt rather than losing the new Employee record).',
  })
  hire(@Param('id') id: string, @Body() body: Parameters<CandidateService['hire']>[1]) {
    return this.candidates.hire(id, body);
  }
}
