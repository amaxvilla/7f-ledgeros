import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FacilityStatus, MaintenanceRequestStatus } from '@prisma/client';
import { FacilityService } from './facility.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  CreateFacilityDto,
  RecordServiceDto,
  SetOutOfServiceDto,
  RequestDecommissionDto,
  CreateMaintenanceRequestDto,
  AssignMaintenanceRequestDto,
  HoldMaintenanceRequestDto,
  ResolveMaintenanceRequestDto,
  CancelMaintenanceRequestDto,
  BillMaintenanceVendorDto,
} from './dto/facility.dto';

@ApiTags('facility')
@ApiBearerAuth()
@Controller('facility')
export class FacilityController {
  constructor(
    private readonly facility: FacilityService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Facilities ----

  @Post('facilities')
  @ApiOperation({ summary: 'Create a facility', description: 'Must be linked to either a projectId (a common-area asset) or a unitId (an in-unit asset) — rejected if neither is given.' })
  @RequirePermissions('facility.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createFacility(@Body() dto: CreateFacilityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.facility.createFacility(dto, user.id);
  }

  @Get('facilities')
  @ApiOperation({ summary: 'List facilities', description: 'RLS-scoped to the caller; entityId, status, projectId, and unitId are all optional filters. Each facility\'s own nested maintenanceRequests only includes OPEN/ASSIGNED/IN_PROGRESS/ON_HOLD ones — unlike getFacility, which includes every request regardless of status.' })
  @RequirePermissions('facility.view')
  async findFacilities(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: FacilityStatus,
    @Query('projectId') projectId?: string,
    @Query('unitId') unitId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.facility.findFacilities(scope, { entityId, status, projectId, unitId });
  }

  @Get('facilities/:facilityId')
  @ApiOperation({ summary: 'Get a facility by id, with every maintenance request against it', description: 'Unlike findFacilities\' own nested list, this includes requests of every status, not just the open ones.' })
  @RequirePermissions('facility.view')
  getFacility(@Param('facilityId') facilityId: string) {
    return this.facility.getFacility(facilityId);
  }

  @Post('facilities/:facilityId/service')
  @ApiOperation({ summary: 'Record a completed service visit', description: 'Rejected if the facility is DECOMMISSIONED. Sets status back to OPERATIONAL regardless of what it was before (e.g. clears OUT_OF_SERVICE).' })
  @RequirePermissions('facility.manage')
  recordService(@Param('facilityId') facilityId: string, @Body() dto: RecordServiceDto) {
    return this.facility.recordService(facilityId, dto);
  }

  @Post('facilities/:facilityId/out-of-service')
  @ApiOperation({ summary: 'Mark a facility out of service', description: 'Rejected if the facility is already DECOMMISSIONED.' })
  @RequirePermissions('facility.manage')
  setOutOfService(@Param('facilityId') facilityId: string, @Body() dto: SetOutOfServiceDto) {
    return this.facility.setOutOfService(facilityId, dto);
  }

  @Post('facilities/:facilityId/decommission/request')
  @ApiOperation({
    summary: 'Send a facility for decommission approval',
    description: 'Only valid from OPERATIONAL, UNDER_MAINTENANCE, or OUT_OF_SERVICE, and rejected if a decommission request is already in progress for this facility. Starts a Workflow Engine instance; the facility\'s own status is left untouched until refreshDecommission is called and the workflow resolves.',
  })
  @RequirePermissions('facility.manage')
  requestDecommission(
    @Param('facilityId') facilityId: string,
    @Body() dto: RequestDecommissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.facility.requestDecommission(facilityId, dto, user.id);
  }

  @Post('facilities/:facilityId/decommission/refresh')
  @ApiOperation({
    summary: 'Poll the linked decommission workflow instance',
    description: 'A no-op if there is no workflow in progress. If the workflow is APPROVED, moves the facility to DECOMMISSIONED. If REJECTED or RETURNED, clears the workflow link and leaves the facility\'s prior status untouched — a rejected decommission does not change its operational state.',
  })
  @RequirePermissions('facility.view')
  refreshDecommission(@Param('facilityId') facilityId: string) {
    return this.facility.refreshDecommission(facilityId);
  }

  // ---- Maintenance Requests ----

  @Post('maintenance-requests')
  @ApiOperation({ summary: 'Raise a maintenance request', description: 'If facilityId is given, rejected when that facility is DECOMMISSIONED. priority defaults to MEDIUM and source to INTERNAL when omitted. Starts OPEN.' })
  @RequirePermissions('maintenance.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createMaintenanceRequest(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.facility.createMaintenanceRequest(dto, user.id);
  }

  @Get('maintenance-requests')
  @ApiOperation({ summary: 'List maintenance requests', description: 'RLS-scoped to the caller; entityId, status, facilityId, unitId, and tenantId are all optional filters.' })
  @RequirePermissions('maintenance.view')
  async findMaintenanceRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: MaintenanceRequestStatus,
    @Query('facilityId') facilityId?: string,
    @Query('unitId') unitId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.facility.findMaintenanceRequests(scope, { entityId, status, facilityId, unitId, tenantId });
  }

  @Get('maintenance-requests/overview')
  @ApiOperation({ summary: 'Get a maintenance dashboard aggregate', description: 'Request counts by status, open-request counts by priority, and a count of facilities currently UNDER_MAINTENANCE. entityId is an optional filter. Reused by DashboardService/ReportingService rather than re-queried there.' })
  @RequirePermissions('maintenance.view')
  getMaintenanceOverview(@Query('entityId') entityId?: string) {
    return this.facility.getMaintenanceOverview(entityId);
  }

  @Get('maintenance-requests/:requestId')
  @ApiOperation({ summary: 'Get a maintenance request by id' })
  @RequirePermissions('maintenance.view')
  getMaintenanceRequest(@Param('requestId') requestId: string) {
    return this.facility.getMaintenanceRequest(requestId);
  }

  @Post('maintenance-requests/:requestId/assign')
  @ApiOperation({ summary: 'Assign a maintenance request to a vendor', description: 'Only valid from OPEN. Side effect: if the linked facility is currently OPERATIONAL, it\'s also moved to UNDER_MAINTENANCE.' })
  @RequirePermissions('maintenance.manage')
  assign(@Param('requestId') requestId: string, @Body() dto: AssignMaintenanceRequestDto) {
    return this.facility.assign(requestId, dto);
  }

  @Post('maintenance-requests/:requestId/start')
  @ApiOperation({ summary: 'Move an assigned request to IN_PROGRESS', description: 'Only valid from ASSIGNED.' })
  @RequirePermissions('maintenance.manage')
  startWork(@Param('requestId') requestId: string) {
    return this.facility.startWork(requestId);
  }

  @Post('maintenance-requests/:requestId/hold')
  @ApiOperation({ summary: 'Place a request on hold', description: 'Only valid from ASSIGNED or IN_PROGRESS.' })
  @RequirePermissions('maintenance.manage')
  hold(@Param('requestId') requestId: string, @Body() dto: HoldMaintenanceRequestDto) {
    return this.facility.hold(requestId, dto);
  }

  @Post('maintenance-requests/:requestId/resume')
  @ApiOperation({ summary: 'Resume a held request', description: 'Only valid from ON_HOLD. Moves directly to IN_PROGRESS, not back to ASSIGNED.' })
  @RequirePermissions('maintenance.manage')
  resume(@Param('requestId') requestId: string) {
    return this.facility.resume(requestId);
  }

  @Post('maintenance-requests/:requestId/resolve')
  @ApiOperation({ summary: 'Mark a request resolved', description: 'Only valid from ASSIGNED, IN_PROGRESS, or ON_HOLD.' })
  @RequirePermissions('maintenance.manage')
  resolve(@Param('requestId') requestId: string, @Body() dto: ResolveMaintenanceRequestDto) {
    return this.facility.resolve(requestId, dto);
  }

  @Post('maintenance-requests/:requestId/close')
  @ApiOperation({ summary: 'Close a resolved request', description: 'Only valid from RESOLVED. Side effect: if the linked facility is currently UNDER_MAINTENANCE, it\'s restored to OPERATIONAL.' })
  @RequirePermissions('maintenance.manage')
  close(@Param('requestId') requestId: string) {
    return this.facility.close(requestId);
  }

  @Post('maintenance-requests/:requestId/cancel')
  @ApiOperation({ summary: 'Cancel a request', description: 'Only valid from OPEN, ASSIGNED, IN_PROGRESS, or ON_HOLD — the same open-status set used to scope findFacilities\' own nested include, not just OPEN alone.' })
  @RequirePermissions('maintenance.manage')
  cancel(@Param('requestId') requestId: string, @Body() dto: CancelMaintenanceRequestDto) {
    return this.facility.cancel(requestId, dto);
  }

  @Post('maintenance-requests/:requestId/bill-vendor')
  @ApiOperation({
    summary: 'Bill the assigned vendor for a maintenance request',
    description: 'Requires an assigned vendor and is rejected if the request has already been billed, or if its status is anything other than RESOLVED or CLOSED. Uses actualCost if set, falling back to costEstimate. Reuses AccountsPayableService.createInvoice() wholesale to create a real VendorInvoice — posting that invoice to the GL remains a separate step on the existing POST /accounts-payable/invoices/:id/post route, not done here.',
  })
  @RequirePermissions('maintenance.bill')
  billVendor(@Param('requestId') requestId: string, @Body() dto: BillMaintenanceVendorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.facility.billVendor(requestId, dto, user.id);
  }
}
