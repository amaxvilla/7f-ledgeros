import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeadStatus, ProspectStatus } from '@prisma/client';
import { CrmService } from './crm.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  AssignLeadDto,
  ConvertLeadDto,
  CreateLeadDto,
  CreateProspectDto,
  DisqualifyLeadDto,
  LogActivityDto,
  MarkProspectLostDto,
  ReserveUnitForProspectDto,
} from './dto/crm.dto';

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Leads ----

  @Post('leads')
  @RequirePermissions('crm.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a lead', description: 'Sends a best-effort assignment notification to assignedToId if given (a notification failure never blocks lead creation).' })
  createLead(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.crm.createLead(dto, user.id);
  }

  @Get('leads')
  @RequirePermissions('crm.view')
  @ApiOperation({ summary: 'List leads', description: 'Row-level-security scoped by entity/businessUnit dimensions, then optionally filtered by entityId/status/assignedToId.' })
  async findLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: LeadStatus,
    @Query('assignedToId') assignedToId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.crm.findLeads(scope, { entityId, status, assignedToId });
  }

  @Get('leads/:leadId')
  @RequirePermissions('crm.view')
  @ApiOperation({ summary: 'Get a lead, with its assignee, activity history, and linked prospect if converted' })
  getLead(@Param('leadId') leadId: string) {
    return this.crm.getLead(leadId);
  }

  @Post('leads/:leadId/assign')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Reassign a lead', description: 'Sends a best-effort "assigned to you" notification to the new assignee only if assignedToId actually changes, not on a no-op reassignment to the same person.' })
  assignLead(@Param('leadId') leadId: string, @Body() dto: AssignLeadDto) {
    return this.crm.assignLead(leadId, dto);
  }

  @Post('leads/:leadId/qualify')
  @RequirePermissions('crm.manage')
  @ApiOperation({
    summary: 'Mark a lead qualified and ready to convert',
    description: 'Rejected if the lead has already CONVERTED or is DISQUALIFIED. (NEW -> CONTACTED happens implicitly on the first logged activity, not through this route — see the activities endpoints.)',
  })
  qualifyLead(@Param('leadId') leadId: string) {
    return this.crm.qualifyLead(leadId);
  }

  @Post('leads/:leadId/disqualify')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Disqualify a lead', description: 'Rejected only if the lead has already CONVERTED; allowed from any other status, including a lead that is already disqualified.' })
  disqualifyLead(@Param('leadId') leadId: string, @Body() dto: DisqualifyLeadDto) {
    return this.crm.disqualifyLead(leadId, dto);
  }

  @Post('leads/:leadId/convert')
  @RequirePermissions('crm.manage')
  @ApiOperation({
    summary: 'Convert a qualified lead into a Prospect',
    description: 'One transaction: marks the lead CONVERTED and creates a linked Prospect (1:1). Rejected if the lead has already converted, is disqualified, or already has a linked prospect. Does not touch Customer/Reservation — that only happens later, when the resulting prospect reserves a unit.',
  })
  convertLead(
    @Param('leadId') leadId: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.convertLeadToProspect(leadId, dto, user.id);
  }

  @Post('leads/:leadId/activities')
  @RequirePermissions('crm.manage')
  @ApiOperation({
    summary: 'Log an activity against a lead',
    description: 'If this is the first activity logged on a lead still in NEW status, the lead is automatically advanced to CONTACTED as a side effect.',
  })
  logLeadActivity(
    @Param('leadId') leadId: string,
    @Body() dto: LogActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.logLeadActivity(leadId, dto, user.id);
  }

  // ---- Prospects ----

  @Post('prospects')
  @RequirePermissions('crm.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({
    summary: 'Create a prospect directly (not via lead conversion)',
    description: 'existingCustomerId, if given, must reference a real Customer (rejected otherwise). Sends a best-effort assignment notification if assignedToId is given.',
  })
  createProspect(@Body() dto: CreateProspectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.crm.createProspect(dto, user.id);
  }

  @Get('prospects')
  @RequirePermissions('crm.view')
  @ApiOperation({ summary: 'List prospects', description: 'Row-level-security scoped by entity/businessUnit dimensions, then optionally filtered by entityId/status/assignedToId.' })
  async findProspects(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: ProspectStatus,
    @Query('assignedToId') assignedToId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.crm.findProspects(scope, { entityId, status, assignedToId });
  }

  @Get('prospects/:prospectId')
  @RequirePermissions('crm.view')
  @ApiOperation({ summary: 'Get a prospect, with its assignee, linked lead, unit of interest, converted customer, and activity history' })
  getProspect(@Param('prospectId') prospectId: string) {
    return this.crm.getProspect(prospectId);
  }

  @Post('prospects/:prospectId/site-visit/schedule')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Mark a site visit scheduled for a prospect', description: 'Rejected if the prospect is already WON or LOST.' })
  scheduleSiteVisit(@Param('prospectId') prospectId: string) {
    return this.crm.scheduleSiteVisit(prospectId);
  }

  @Post('prospects/:prospectId/site-visit/complete')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Mark a scheduled site visit done', description: 'Rejected if the prospect is already WON or LOST.' })
  recordSiteVisitDone(@Param('prospectId') prospectId: string) {
    return this.crm.recordSiteVisitDone(prospectId);
  }

  @Post('prospects/:prospectId/negotiate')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Move a prospect into negotiation', description: 'Rejected if the prospect is already WON or LOST.' })
  startNegotiation(@Param('prospectId') prospectId: string) {
    return this.crm.startNegotiation(prospectId);
  }

  @Post('prospects/:prospectId/lost')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Mark a prospect lost', description: 'Rejected if the prospect is already WON or LOST.' })
  markProspectLost(@Param('prospectId') prospectId: string, @Body() dto: MarkProspectLostDto) {
    return this.crm.markProspectLost(prospectId, dto);
  }

  @Post('prospects/:prospectId/won')
  @RequirePermissions('crm.manage')
  @ApiOperation({
    summary: 'Mark a prospect won',
    description: 'Rejected unless the prospect is currently RESERVED — a stricter gate than the other prospect-status routes (which only reject WON/LOST). Does not itself touch the sale allocation; it only closes out the CRM record once a sale has been confirmed elsewhere.',
  })
  markProspectWon(@Param('prospectId') prospectId: string) {
    return this.crm.markProspectWon(prospectId);
  }

  @Post('prospects/:prospectId/reserve')
  @RequirePermissions('realestate.sell')
  @ApiOperation({
    summary: 'Reserve a unit for a prospect',
    description: "Uses realestate.sell, not crm.manage, unlike every other route in this controller. Delegates to the existing Real Estate unit-reservation flow rather than reimplementing it; creates a Customer first if the prospect doesn't already have one converted. On success, marks the prospect RESERVED.",
  })
  reserveUnitForProspect(
    @Param('prospectId') prospectId: string,
    @Body() dto: ReserveUnitForProspectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.reserveUnitForProspect(prospectId, dto, user.id);
  }

  @Post('prospects/:prospectId/activities')
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Log an activity against a prospect', description: 'Unlike the equivalent lead-activity route, this has no side effect on the prospect\'s own status.' })
  logProspectActivity(
    @Param('prospectId') prospectId: string,
    @Body() dto: LogActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crm.logProspectActivity(prospectId, dto, user.id);
  }

  // ---- Follow-ups & analytics ----

  @Get('follow-ups')
  @RequirePermissions('crm.view')
  @ApiOperation({
    summary: 'List upcoming/overdue follow-ups across leads and prospects',
    description: 'withinHours defaults to 48 when not given. Optionally filtered to one assignee.',
  })
  getUpcomingFollowUps(@Query('assignedToId') assignedToId?: string, @Query('withinHours') withinHours?: string) {
    return this.crm.getUpcomingFollowUps(assignedToId, withinHours ? Number(withinHours) : undefined);
  }

  @Get('pipeline-summary')
  @RequirePermissions('crm.view')
  @ApiOperation({
    summary: 'CRM pipeline analytics: lead/prospect counts by status and source, plus won/lost this month',
    description: 'leadConversionRate is convertedLeads/totalLeads (0 if there are no leads). wonThisMonth/lostThisMonth are calendar-month-to-date counts (since the 1st of the current month), not a rolling 30-day window.',
  })
  getCrmPipelineSummary(@Query('entityId') entityId?: string) {
    return this.crm.getCrmPipelineSummary(entityId);
  }
}
