import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LandAcquisitionStatus, LandParcelStatus, PlotStatus } from '@prisma/client';
import { LandBankService } from './land-bank.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  AddTitleDeedDto,
  ApproveSurveyPlanDto,
  CancelPlotReleaseDto,
  CompleteLandAcquisitionDto,
  CreateLandParcelDto,
  CreateMasterPlanDto,
  CreateSurveyPlanDto,
  PerfectTitleDeedDto,
  RecordLandAcquisitionDto,
  RejectSurveyPlanDto,
  RejectTitleDeedDto,
  ReleasePlotDto,
  SubdivideParcelDto,
  UpdatePlotStatusDto,
} from './dto/land-bank.dto';

@ApiTags('land-bank')
@ApiBearerAuth()
@Controller('land-bank')
export class LandBankController {
  constructor(
    private readonly landBank: LandBankService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Land Parcels ----

  @Post('parcels')
  @ApiOperation({ summary: 'Register a new land parcel', description: '409 if the code is already used by another parcel for the same entity.' })
  @RequirePermissions('landbank.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createParcel(@Body() dto: CreateLandParcelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landBank.createParcel(dto, user.id);
  }

  @Get('parcels')
  @ApiOperation({ summary: 'List land parcels', description: "RLS-scoped to the caller's entity/business-unit access; optionally further filtered by entityId and status. Each parcel includes its acquisitions, title deeds, survey plans, and plots." })
  @RequirePermissions('landbank.view')
  async findParcels(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: LandParcelStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.landBank.findParcels(scope, entityId, status);
  }

  @Get('parcels/:parcelId')
  @ApiOperation({ summary: 'Get a land parcel', description: 'Includes acquisitions, title deeds, survey plans, and plots (each plot with its own project-release record, if any). 404 if the parcel does not exist.' })
  @RequirePermissions('landbank.view')
  getParcel(@Param('parcelId') parcelId: string) {
    return this.landBank.getParcel(parcelId);
  }

  // ---- Land Acquisitions ----

  @Post('acquisitions')
  @ApiOperation({ summary: 'Record a land acquisition against a parcel', description: '404 if the parcel does not exist. Sets the parcel to UNDER_ACQUISITION as a side effect.' })
  @RequirePermissions('landbank.manage')
  recordAcquisition(@Body() dto: RecordLandAcquisitionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landBank.recordAcquisition(dto, user.id);
  }

  @Patch('acquisitions/:acquisitionId/status')
  @ApiOperation({ summary: 'Set a land acquisition\'s status directly', description: '404 if not found; 400 once the acquisition is COMPLETED — use the dedicated complete route to reach that status instead.' })
  @RequirePermissions('landbank.manage')
  updateAcquisitionStatus(
    @Param('acquisitionId') acquisitionId: string,
    @Body('status') status: LandAcquisitionStatus,
  ) {
    return this.landBank.updateAcquisitionStatus(acquisitionId, status);
  }

  @Post('acquisitions/:acquisitionId/complete')
  @ApiOperation({
    summary: 'Complete a land acquisition',
    description: "404 if not found; 409 if already COMPLETED; 400 if CANCELLED. Sets the parcel to ACQUIRED. Capitalizing the acquisition cost to a GL asset account is deliberately out of scope here — deferred to the Fixed Assets module's own Construction-in-Progress handling once that exists.",
  })
  @RequirePermissions('landbank.manage')
  completeAcquisition(@Param('acquisitionId') acquisitionId: string, @Body() dto: CompleteLandAcquisitionDto) {
    return this.landBank.completeAcquisition(acquisitionId, dto.acquisitionDate);
  }

  // ---- Titles ----

  @Post('titles')
  @ApiOperation({ summary: 'Add a title deed to a parcel', description: "404 if the parcel does not exist. Created as IN_PROGRESS. Moves the parcel to IN_TITLING unless it's already TITLED." })
  @RequirePermissions('landbank.manage')
  addTitleDeed(@Body() dto: AddTitleDeedDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landBank.addTitleDeed(dto, user.id);
  }

  @Post('titles/:titleId/perfect')
  @ApiOperation({ summary: 'Mark a title deed as perfected', description: '404 if not found; 409 if already PERFECTED. Sets the parcel to TITLED.' })
  @RequirePermissions('landbank.manage')
  perfectTitleDeed(@Param('titleId') titleId: string, @Body() dto: PerfectTitleDeedDto) {
    return this.landBank.perfectTitleDeed(titleId, dto.issuedDate, dto.expiryDate, dto.titleNumber);
  }

  @Post('titles/:titleId/reject')
  @ApiOperation({ summary: 'Reject a title deed', description: "404 if not found. The reason is appended to the title's own notes field, not stored on a dedicated rejection-reason column." })
  @RequirePermissions('landbank.manage')
  rejectTitleDeed(@Param('titleId') titleId: string, @Body() dto: RejectTitleDeedDto) {
    return this.landBank.rejectTitleDeed(titleId, dto.reason);
  }

  @Get('parcels/:parcelId/titles')
  @ApiOperation({ summary: 'List title deeds for a parcel' })
  @RequirePermissions('landbank.view')
  findTitleDeeds(@Param('parcelId') parcelId: string) {
    return this.landBank.findTitleDeeds(parcelId);
  }

  // ---- Survey Plans ----

  @Post('survey-plans')
  @ApiOperation({ summary: 'Create a survey plan for a parcel', description: '404 if the parcel does not exist; 409 if the plan number is already used for this parcel. Created as SUBMITTED.' })
  @RequirePermissions('landbank.manage')
  createSurveyPlan(@Body() dto: CreateSurveyPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landBank.createSurveyPlan(dto, user.id);
  }

  @Post('survey-plans/:surveyPlanId/approve')
  @ApiOperation({ summary: 'Approve a survey plan', description: '404 if not found; 409 if already APPROVED. Sets the parcel to SURVEYED.' })
  @RequirePermissions('landbank.manage')
  approveSurveyPlan(@Param('surveyPlanId') surveyPlanId: string, @Body() _dto: ApproveSurveyPlanDto) {
    return this.landBank.approveSurveyPlan(surveyPlanId);
  }

  @Post('survey-plans/:surveyPlanId/reject')
  @ApiOperation({ summary: 'Reject a survey plan', description: "404 if not found. The reason is not persisted on the record itself — it's captured only via the automatic audit trail on this request." })
  @RequirePermissions('landbank.manage')
  rejectSurveyPlan(@Param('surveyPlanId') surveyPlanId: string, @Body() dto: RejectSurveyPlanDto) {
    return this.landBank.rejectSurveyPlan(surveyPlanId, dto.reason);
  }

  @Get('parcels/:parcelId/survey-plans')
  @ApiOperation({ summary: 'List survey plans for a parcel' })
  @RequirePermissions('landbank.view')
  findSurveyPlans(@Param('parcelId') parcelId: string) {
    return this.landBank.findSurveyPlans(parcelId);
  }

  // ---- Plots ----

  @Post('parcels/:parcelId/subdivide')
  @ApiOperation({
    summary: 'Subdivide a parcel into plots against an approved survey plan',
    description: 'Requires at least one plot. The survey plan must belong to this parcel and be APPROVED. The sum of plot areas cannot exceed the parcel area. Creates every plot as AVAILABLE and sets the parcel to SUBDIVIDED.',
  })
  @RequirePermissions('landbank.manage')
  subdivideParcel(@Param('parcelId') parcelId: string, @Body() dto: SubdivideParcelDto) {
    return this.landBank.subdivideParcel(parcelId, dto.surveyPlanId, dto.plots);
  }

  @Get('parcels/:parcelId/plots')
  @ApiOperation({ summary: 'List plots for a parcel', description: 'Optionally filtered by status.' })
  @RequirePermissions('landbank.view')
  findPlots(@Param('parcelId') parcelId: string, @Query('status') status?: PlotStatus) {
    return this.landBank.findPlots(parcelId, status);
  }

  @Patch('plots/:plotId/status')
  @ApiOperation({ summary: "Set a plot's status directly", description: '404 if not found. Not guarded by any status-transition rule — any value can be set from any current status.' })
  @RequirePermissions('landbank.manage')
  updatePlotStatus(@Param('plotId') plotId: string, @Body() dto: UpdatePlotStatusDto) {
    return this.landBank.updatePlotStatus(plotId, dto.status as PlotStatus);
  }

  // ---- Estate Master Planning ----

  @Post('master-plans')
  @ApiOperation({ summary: 'Create a new master plan version for an estate', description: '404 if the estate does not exist. The version number auto-increments from the highest existing version for this estate (starting at 1). Zones are optional and created inline if provided.' })
  @RequirePermissions('landbank.manage')
  createMasterPlan(@Body() dto: CreateMasterPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.landBank.createMasterPlan(dto, user.id);
  }

  @Get('estates/:estateId/master-plans')
  @ApiOperation({ summary: 'List master plan versions for an estate, newest first' })
  @RequirePermissions('landbank.view')
  findMasterPlans(@Param('estateId') estateId: string) {
    return this.landBank.findMasterPlans(estateId);
  }

  @Get('master-plans/:masterPlanId')
  @ApiOperation({ summary: 'Get a master plan version, including its zones', description: '404 if not found.' })
  @RequirePermissions('landbank.view')
  getMasterPlan(@Param('masterPlanId') masterPlanId: string) {
    return this.landBank.getMasterPlan(masterPlanId);
  }

  @Post('master-plans/:masterPlanId/approve')
  @ApiOperation({
    summary: 'Approve a master plan version',
    description: "404 if not found; 409 if already APPROVED; 400 if SUPERSEDED. Whichever other version of this estate's plan is currently APPROVED (if any) is automatically moved to SUPERSEDED in the same transaction — only one version can be APPROVED per estate at a time.",
  })
  @RequirePermissions('landbank.manage')
  approveMasterPlan(@Param('masterPlanId') masterPlanId: string) {
    return this.landBank.approveMasterPlan(masterPlanId);
  }

  // ---- Plot -> Project Release ----

  @Post('plots/:plotId/release')
  @ApiOperation({
    summary: 'Release a plot to a project (Land Bank -> Real Estate hand-off)',
    description: '404 if the plot or project does not exist; 400 if the plot is not AVAILABLE; 409 if the plot already has an active (non-cancelled) release. Re-releasing a plot whose prior release was cancelled updates that same release record rather than creating a new one. Sets the plot to ALLOCATED.',
  })
  @RequirePermissions('landbank.manage')
  releasePlot(
    @Param('plotId') plotId: string,
    @Body() dto: ReleasePlotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.landBank.releasePlotToProject(plotId, dto.projectId, dto.notes, user.id);
  }

  @Post('plots/:plotId/release/cancel')
  @ApiOperation({ summary: "Cancel a plot's active project release", description: '404 if there is no active release for this plot. Sets the plot back to AVAILABLE.' })
  @RequirePermissions('landbank.manage')
  cancelPlotRelease(@Param('plotId') plotId: string, @Body() dto: CancelPlotReleaseDto) {
    return this.landBank.cancelPlotRelease(plotId, dto.reason);
  }

  @Get('projects/:projectId/plot-releases')
  @ApiOperation({ summary: 'List active (non-cancelled) plot releases for a project', description: 'Each release includes its own plot record.' })
  @RequirePermissions('landbank.view')
  findReleasesForProject(@Param('projectId') projectId: string) {
    return this.landBank.findReleasesForProject(projectId);
  }
}
