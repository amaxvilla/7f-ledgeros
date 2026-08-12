import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CorrectiveActionStatus, HseCaseStatus } from '@prisma/client';
import { HseService } from './hse.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Corrective actions are the one HSE record type with an outbound
 * integration: creating and completing one both best-effort sync to
 * Microsoft To Do (`HseService.trySyncCreate`/the sync block inside
 * `completeCorrectiveAction`, confirmed directly) — the same
 * never-block-the-primary-write shape `InterviewService`'s calendar
 * sync and `CandidateService`'s contact sync already use elsewhere in
 * this codebase. A sync failure never fails the create/complete call
 * itself; it just leaves a `taskSyncFailedAt` flag for later.
 */
@ApiTags('hse')
@ApiBearerAuth()
@Controller('hse')
export class HseController {
  constructor(private readonly hse: HseService) {}

  // ---- Incident reports ----

  @Post('incidents')
  @ApiOperation({ summary: 'Report an incident', description: 'Starts OPEN. reportedById is taken from the authenticated caller, not the request body.' })
  @RequirePermissions('hse.report')
  createIncident(
    @Body() body: Omit<Parameters<HseService['createIncidentReport']>[0], 'reportedById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hse.createIncidentReport({ ...body, reportedById: user.id });
  }

  @Get('incidents')
  @ApiOperation({ summary: 'List incident reports', description: 'Optional entityId/status filters. Includes each incident\'s own corrective actions. Newest incident date first.' })
  @RequirePermissions('hse.view')
  findIncidents(@Query('entityId') entityId?: string, @Query('status') status?: HseCaseStatus) {
    return this.hse.findIncidentReports(entityId, status);
  }

  @Post('incidents/:id/status')
  @ApiOperation({
    summary: 'Advance an incident\'s status',
    description: 'Closing an incident (status: CLOSED) is rejected if any of its own corrective actions is not yet COMPLETED — a real gate near misses below do not have.',
  })
  @RequirePermissions('hse.manage')
  advanceIncident(@Param('id') id: string, @Body() body: { status: HseCaseStatus }) {
    return this.hse.advanceIncidentStatus(id, body.status);
  }

  // ---- Near misses ----

  @Post('near-misses')
  @ApiOperation({ summary: 'Report a near miss', description: 'Starts OPEN. reportedById is taken from the authenticated caller, not the request body.' })
  @RequirePermissions('hse.report')
  createNearMiss(
    @Body() body: Omit<Parameters<HseService['createNearMiss']>[0], 'reportedById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hse.createNearMiss({ ...body, reportedById: user.id });
  }

  @Get('near-misses')
  @ApiOperation({ summary: 'List near misses', description: 'Optional entityId/status filters. Includes each near miss\'s own corrective actions. Newest first.' })
  @RequirePermissions('hse.view')
  findNearMisses(@Query('entityId') entityId?: string, @Query('status') status?: HseCaseStatus) {
    return this.hse.findNearMisses(entityId, status);
  }

  @Post('near-misses/:id/status')
  @ApiOperation({ summary: 'Advance a near miss\'s status', description: 'No corrective-action-completeness gate on close, unlike an incident report\'s own advance-status route above.' })
  @RequirePermissions('hse.manage')
  advanceNearMiss(@Param('id') id: string, @Body() body: { status: HseCaseStatus }) {
    return this.hse.advanceNearMissStatus(id, body.status);
  }

  // ---- PPE ----

  @Post('ppe-issuances')
  @ApiOperation({ summary: 'Record a PPE issuance to an employee', description: 'Quantity must be positive; the employee must already exist.' })
  @RequirePermissions('hse.manage')
  issuePpe(
    @Body() body: Omit<Parameters<HseService['issuePpe']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hse.issuePpe({ ...body, createdById: user.id });
  }

  @Get('ppe-issuances')
  @ApiOperation({ summary: 'List PPE issuances', description: 'Optional employeeId filter. Newest issued date first.' })
  @RequirePermissions('hse.view')
  findPpeIssuances(@Query('employeeId') employeeId?: string) {
    return this.hse.findPpeIssuances(employeeId);
  }

  @Get('ppe-issuances/expiring')
  @ApiOperation({ summary: 'List PPE due for replacement', description: 'Every issuance with an expiryDate on or before the given date, soonest-expiring first, each including its employee.' })
  @RequirePermissions('hse.view')
  findExpiringPpe(@Query('entityId') entityId: string, @Query('onOrBefore') onOrBefore: string) {
    return this.hse.findExpiringPpe(entityId, onOrBefore);
  }

  // ---- Toolbox talks ----

  @Post('toolbox-talks')
  @ApiOperation({ summary: 'Log a toolbox talk', description: 'attendeeCount cannot be negative.' })
  @RequirePermissions('hse.manage')
  createToolboxTalk(@Body() body: Parameters<HseService['createToolboxTalk']>[0]) {
    return this.hse.createToolboxTalk(body);
  }

  @Get('toolbox-talks')
  @ApiOperation({ summary: 'List toolbox talks', description: 'Optional entityId/projectId filters. Newest first.' })
  @RequirePermissions('hse.view')
  findToolboxTalks(@Query('entityId') entityId?: string, @Query('projectId') projectId?: string) {
    return this.hse.findToolboxTalks(entityId, projectId);
  }

  // ---- Corrective actions ----

  @Post('corrective-actions')
  @ApiOperation({
    summary: 'Create a corrective action',
    description: 'Must reference an incident report or a near miss (rejected if neither id is supplied). Starts OPEN. Best-effort syncs to Microsoft To Do if a provider is registered — see this controller\'s own top-level note.',
  })
  @RequirePermissions('hse.manage')
  createCorrectiveAction(
    @Body() body: Omit<Parameters<HseService['createCorrectiveAction']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hse.createCorrectiveAction({ ...body, createdById: user.id });
  }

  @Get('corrective-actions')
  @ApiOperation({ summary: 'List corrective actions', description: 'Optional assignedToId/status filters. Soonest due date first.' })
  @RequirePermissions('hse.view')
  findCorrectiveActions(
    @Query('assignedToId') assignedToId?: string,
    @Query('status') status?: CorrectiveActionStatus,
  ) {
    return this.hse.findCorrectiveActions({ assignedToId, status });
  }

  @Post('corrective-actions/:id/complete')
  @ApiOperation({
    summary: 'Mark a corrective action complete',
    description: 'If a Microsoft To Do task was successfully created for this action, best-effort marks it completed too — see this controller\'s own top-level note.',
  })
  @RequirePermissions('hse.manage')
  completeCorrectiveAction(@Param('id') id: string) {
    return this.hse.completeCorrectiveAction(id);
  }

  @Post('corrective-actions/flag-overdue')
  @ApiOperation({ summary: 'Flag past-due corrective actions as OVERDUE', description: 'A bulk sweep: every OPEN/IN_PROGRESS action whose dueDate is before the given asOf date is flagged. Returns the count flagged.' })
  @RequirePermissions('hse.manage')
  flagOverdue(@Body() body: { asOf: string }) {
    return this.hse.flagOverdueCorrectiveActions(body.asOf);
  }

  // ---- Inspection checklists ----

  @Post('inspection-checklists')
  @ApiOperation({ summary: 'Create an inspection checklist', description: 'Needs at least one item.' })
  @RequirePermissions('hse.manage')
  createInspectionChecklist(@Body() body: Parameters<HseService['createInspectionChecklist']>[0]) {
    return this.hse.createInspectionChecklist(body);
  }

  @Get('inspection-checklists')
  @ApiOperation({ summary: 'List inspection checklists', description: 'Optional entityId/projectId filters. Includes each checklist\'s own items. Newest inspection date first.' })
  @RequirePermissions('hse.view')
  findInspectionChecklists(@Query('entityId') entityId?: string, @Query('projectId') projectId?: string) {
    return this.hse.findInspectionChecklists(entityId, projectId);
  }

  @Post('inspection-checklist-items/:itemId/result')
  @ApiOperation({ summary: 'Record a compliant/non-compliant result for one checklist item' })
  @RequirePermissions('hse.manage')
  recordItemResult(
    @Param('itemId') itemId: string,
    @Body() body: { isCompliant: boolean; remarks?: string },
  ) {
    return this.hse.recordItemResult(itemId, body.isCompliant, body.remarks);
  }

  @Post('inspection-checklists/:id/finalize')
  @ApiOperation({
    summary: 'Finalize a checklist and derive its overall result',
    description: 'Rejected until every item has a recorded result. All-compliant resolves to PASS; all-non-compliant to FAIL; any other mix to PASS_WITH_OBSERVATIONS.',
  })
  @RequirePermissions('hse.manage')
  finalizeChecklist(@Param('id') id: string) {
    return this.hse.finalizeChecklist(id);
  }
}
