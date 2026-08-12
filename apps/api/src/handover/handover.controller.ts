import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HandoverStatus, SnagStatus } from '@prisma/client';
import { HandoverService } from './handover.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  AddSnagDto,
  CancelHandoverDto,
  CompleteHandoverDto,
  RejectSnagDto,
  ResolveSnagDto,
  ScheduleHandoverDto,
} from './dto/handover.dto';

@ApiTags('handover')
@ApiBearerAuth()
@Controller('handover-records')
export class HandoverController {
  constructor(
    private readonly handover: HandoverService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @RequirePermissions('handover.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Schedule a handover for a unit sale allocation', description: 'Rejected if the allocation does not exist, or already has a handover record (one handover record per allocation).' })
  schedule(@Body() dto: ScheduleHandoverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.handover.scheduleHandover(dto, user.id);
  }

  @Get()
  @RequirePermissions('handover.view')
  @ApiOperation({ summary: 'List handover records', description: 'Row-level-security scoped by entity/businessUnit dimensions, then optionally filtered by status/entityId.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: HandoverStatus,
    @Query('entityId') entityId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.handover.findHandoverRecords(scope, { status, entityId });
  }

  @Get(':id')
  @RequirePermissions('handover.view')
  @ApiOperation({ summary: 'Get a handover record, with its unit, customer, allocation, and snags' })
  getOne(@Param('id') id: string) {
    return this.handover.getHandoverRecord(id);
  }

  @Post(':id/inspect')
  @RequirePermissions('handover.manage')
  @ApiOperation({ summary: 'Record the handover inspection as done', description: 'Rejected if the handover is already COMPLETED or CANCELLED.' })
  recordInspection(@Param('id') id: string) {
    return this.handover.recordInspection(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('handover.manage')
  @ApiOperation({ summary: 'Cancel a handover', description: 'Rejected if the handover is already COMPLETED or CANCELLED.' })
  cancel(@Param('id') id: string, @Body() dto: CancelHandoverDto) {
    return this.handover.cancelHandover(id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions('revenue.recognize')
  @ApiOperation({
    summary: 'Complete a handover',
    description: 'Uses revenue.recognize, not handover.manage, unlike every other route in this controller. Rejected if the handover is already COMPLETED/CANCELLED, or if any of its snags is still OPEN or IN_PROGRESS. Reuses the existing Revenue Recognition module (recognizeOnHandover) for the GL entry and the unit/allocation status flip to HANDED_OVER — no posting logic duplicated here.',
  })
  complete(@Param('id') id: string, @Body() dto: CompleteHandoverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.handover.completeHandover(id, dto, user.id);
  }

  // ---- Snags / Defects ----

  @Post(':id/snags')
  @RequirePermissions('handover.manage')
  @ApiOperation({
    summary: 'Report a snag (defect) against a handover',
    description: 'severity defaults to MINOR and source to HANDOVER_INSPECTION when omitted. Sends a best-effort notification to assignedToId if given (never blocks snag creation). Side effect: if the handover is currently INSPECTION_DONE, it moves to SNAGS_PENDING.',
  })
  addSnag(@Param('id') id: string, @Body() dto: AddSnagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.handover.addSnag(id, dto, user.id);
  }

  @Get(':id/snags')
  @RequirePermissions('handover.view')
  @ApiOperation({ summary: 'List snags for a handover record, optionally filtered by status' })
  findSnags(@Param('id') id: string, @Query('status') status?: SnagStatus) {
    return this.handover.findSnags({ handoverRecordId: id, status });
  }

  @Get(':id/snags/summary')
  @RequirePermissions('handover.view')
  @ApiOperation({ summary: 'Get snag counts by status and by severity for a handover record' })
  getSnagSummary(@Param('id') id: string) {
    return this.handover.getSnagSummary(id);
  }
}

@ApiTags('handover')
@ApiBearerAuth()
@Controller('snags')
export class SnagController {
  constructor(private readonly handover: HandoverService) {}

  @Get()
  @RequirePermissions('handover.view')
  @ApiOperation({ summary: 'List snags, optionally filtered by unit and/or status', description: 'Not scoped to one handover record — spans every handover, unlike HandoverController\'s own :id/snags.' })
  findAll(@Query('unitId') unitId?: string, @Query('status') status?: SnagStatus) {
    return this.handover.findSnags({ unitId, status });
  }

  @Post(':id/start')
  @RequirePermissions('handover.manage')
  @ApiOperation({ summary: 'Mark a snag in progress', description: 'No status guard — callable from any current status.' })
  start(@Param('id') id: string) {
    return this.handover.startSnagWork(id);
  }

  @Post(':id/resolve')
  @RequirePermissions('handover.manage')
  @ApiOperation({ summary: 'Mark a snag resolved', description: 'No status guard — callable from any current status.' })
  resolve(@Param('id') id: string, @Body() dto: ResolveSnagDto) {
    return this.handover.resolveSnag(id, dto);
  }

  @Post(':id/verify')
  @RequirePermissions('handover.manage')
  @ApiOperation({ summary: 'Verify a resolved snag', description: 'Rejected unless the snag is currently RESOLVED — the only snag-transition route in this controller with a status guard.' })
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.handover.verifySnag(id, user.id);
  }

  @Post(':id/reject')
  @RequirePermissions('handover.manage')
  @ApiOperation({ summary: 'Reject a snag', description: 'No status guard — callable from any current status.' })
  reject(@Param('id') id: string, @Body() dto: RejectSnagDto) {
    return this.handover.rejectSnag(id, dto);
  }
}
