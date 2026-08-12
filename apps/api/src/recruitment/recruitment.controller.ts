import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequisitionStatus, VacancyStatus } from '@prisma/client';
import { RecruitmentService } from './recruitment.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('recruitment')
@ApiBearerAuth()
@Controller('recruitment')
export class RecruitmentController {
  constructor(
    private readonly recruitment: RecruitmentService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Job Requisitions ----

  @Post('requisitions')
  @RequirePermissions('recruitment.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a job requisition', description: 'Starts as DRAFT. entityId must be within the caller\'s own postable RLS scope.' })
  createRequisition(
    @Body() body: Parameters<RecruitmentService['createRequisition']>[0],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recruitment.createRequisition(body, user.id);
  }

  @Get('requisitions')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: 'List job requisitions', description: 'Scoped to the caller\'s own RLS-viewable entities/departments/cost centers/projects/business units; optionally filtered by entityId/status.' })
  async findRequisitions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: RequisitionStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.recruitment.findRequisitions(scope, entityId, status);
  }

  @Get('requisitions/:id')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: 'Get a job requisition', description: 'Returns 404, not 403, if the requisition exists but is outside the caller\'s own RLS scope.' })
  async findOneRequisition(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.recruitment.findOneRequisition(id, scope);
  }

  @Post('requisitions/:id/submit')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Submit a DRAFT requisition for approval',
    description: 'Only callable while the requisition is DRAFT. Starts a RECRUITMENT_REQUISITION workflow instance and moves the requisition to PENDING_APPROVAL.',
  })
  submitRequisition(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.recruitment.submitRequisitionForApproval(id, user.id);
  }

  @Post('requisitions/:id/refresh-approval')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Reconcile a requisition\'s status with its approval workflow instance',
    description: 'Call after acting on the underlying workflow instance. Moves the requisition to APPROVED or REJECTED once the workflow instance itself resolves; otherwise returns it unchanged.',
  })
  refreshRequisitionApproval(@Param('id') id: string) {
    return this.recruitment.refreshRequisitionApproval(id);
  }

  @Post('requisitions/:id/close')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Close a job requisition',
    description: 'Callable at any status except CLOSED, including abandoning a requisition that was never submitted — unlike closing a vacancy, there is no status restriction here.',
  })
  closeRequisition(@Param('id') id: string) {
    return this.recruitment.closeRequisition(id);
  }

  // ---- Vacancies ----

  @Post('vacancies')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Open a vacancy against an approved requisition',
    description: 'The referenced requisition must be APPROVED. Starts as DRAFT; employmentType/departmentId default to the requisition\'s own values when not supplied.',
  })
  createVacancy(@Body() body: Parameters<RecruitmentService['createVacancy']>[0]) {
    return this.recruitment.createVacancy(body);
  }

  @Get('vacancies')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: 'List vacancies', description: 'Includes each vacancy\'s own application count. Optionally filtered by entityId/status.' })
  findVacancies(@Query('entityId') entityId?: string, @Query('status') status?: VacancyStatus) {
    return this.recruitment.findVacancies(entityId, status);
  }

  @Get('vacancies/:id')
  @RequirePermissions('recruitment.view')
  @ApiOperation({ summary: 'Get a vacancy', description: 'Includes every application against it, each with its own candidate.' })
  findOneVacancy(@Param('id') id: string) {
    return this.recruitment.findOneVacancy(id);
  }

  @Patch('vacancies/:id/publish')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({ summary: 'Publish a vacancy', description: 'Only callable from DRAFT or ON_HOLD. Moves it to OPEN, accepting applications.' })
  publishVacancy(@Param('id') id: string) {
    return this.recruitment.publishVacancy(id);
  }

  @Patch('vacancies/:id/close')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Close a vacancy',
    description: 'Set filled=true to record it as FILLED, or omit/false for CLOSED (unfilled) — two distinct outcomes, not a single close with a follow-up choice.',
  })
  closeVacancy(@Param('id') id: string, @Query('filled') filled?: string) {
    return this.recruitment.closeVacancy(id, filled === 'true');
  }

  // ---- Dashboard & Reports ----

  @Get('dashboard')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'Recruiter dashboard',
    description: 'Open vacancies, pending requisitions, the applications pipeline by stage, upcoming interviews, and calendar/Teams sync-failure counts (contact/signature sync failures are tracked in their own list endpoints, not counted here).',
  })
  dashboard(@Query('entityId') entityId?: string) {
    return this.recruitment.recruiterDashboard(entityId);
  }

  @Get('reports/pipeline')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: 'Per-vacancy pipeline report',
    description: 'One row per vacancy: total/hired/rejected application counts and average time-to-hire in days (null if nobody has been hired for it yet).',
  })
  report(@Query('entityId') entityId?: string) {
    return this.recruitment.recruitmentReport(entityId);
  }
}
