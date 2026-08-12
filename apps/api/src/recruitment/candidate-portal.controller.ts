import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VacancyStatus } from '@prisma/client';
import { CandidateService } from './candidate.service';
import { OfferService } from './offer.service';
import { RecruitmentService } from './recruitment.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Candidate-facing backend. Candidates are not internal Users, so these
 * routes are gated behind a dedicated "candidate.portal" permission rather
 * than the internal hr/recruitment.* permission set — grant it to whatever
 * auth mechanism fronts external applicants (e.g. a passwordless portal
 * login). Wiring that login flow itself is outside this module's scope;
 * this only exposes the APIs it will call.
 */
@ApiTags('recruitment-candidate-portal')
@ApiBearerAuth()
@Controller('candidate-portal')
@RequirePermissions('candidate.portal')
export class CandidatePortalController {
  constructor(
    private readonly candidates: CandidateService,
    private readonly offers: OfferService,
    private readonly recruitment: RecruitmentService,
  ) {}

  @Get('vacancies')
  @ApiOperation({
    summary: 'Browse open vacancies',
    description: 'Lists vacancies with status OPEN, optionally filtered to one entityId, each with its own current applicant count.',
  })
  browseVacancies(@Query('entityId') entityId?: string) {
    return this.recruitment.findVacancies(entityId, VacancyStatus.OPEN);
  }

  @Post('profile')
  @ApiOperation({
    summary: 'Create or update a candidate profile',
    description: 'Upserts by email — submitting the same email again updates the existing profile rather than creating a duplicate.',
  })
  upsertProfile(@Body() body: Parameters<CandidateService['upsertCandidate']>[0]) {
    return this.candidates.upsertCandidate(body);
  }

  @Get('profile/:id')
  @ApiOperation({
    summary: "Get a candidate's own profile",
    description: 'Returns the candidate with their documents and every application (each including its own vacancy, interviews, and offer).',
  })
  profile(@Param('id') id: string) {
    return this.candidates.findCandidate(id);
  }

  @Post('profile/documents')
  @ApiOperation({
    summary: 'Attach a document (e.g. resume) to a candidate profile',
    description: 'The candidate must already exist — attaching to an unknown candidateId is rejected rather than silently ignored.',
  })
  uploadResume(@Body() body: Parameters<CandidateService['addDocument']>[0]) {
    return this.candidates.addDocument(body);
  }

  @Post('applications')
  @ApiOperation({
    summary: 'Apply to a vacancy',
    description:
      'The vacancy must currently be OPEN, and a candidate can only apply once per vacancy — either condition failing is rejected rather than silently accepted.',
  })
  apply(@Body() body: Parameters<CandidateService['apply']>[0]) {
    return this.candidates.apply(body);
  }

  @Get('applications/:candidateId')
  @ApiOperation({
    summary: "List a candidate's own applications",
    description: "Every application this candidate has submitted, newest first, each with its own vacancy and offer (if any).",
  })
  myApplications(@Param('candidateId') candidateId: string) {
    return this.candidates.findApplicationsForCandidate(candidateId);
  }

  @Patch('offers/:id/respond')
  @ApiOperation({
    summary: 'Accept or decline an offer',
    description: 'Only a SENT offer can be responded to; a declineReason is stored only when accepted is false.',
  })
  respondToOffer(@Param('id') id: string, @Body() body: { accepted: boolean; declineReason?: string }) {
    return this.offers.respond(id, body.accepted, body.declineReason);
  }
}
