import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IssueStatus, RiskStatus } from '@prisma/client';
import { RiskIssueService } from './risk-issue.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  AssessRiskDto,
  AssignIssueDto,
  AssignRiskOwnerDto,
  ConvertRiskToIssueDto,
  CreateIssueDto,
  CreateRiskDto,
  ResolveIssueDto,
  SetMitigationPlanDto,
} from './dto/risk-issue.dto';

@ApiTags('pmo-risk')
@ApiBearerAuth()
@Controller('project-risks')
export class RiskController {
  constructor(
    private readonly riskIssue: RiskIssueService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a project risk', description: 'probability/impact default to MEDIUM when omitted; riskScore is computed server-side from the two.' })
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateRiskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.riskIssue.createRisk(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List risks', description: 'projectId and status are both optional filters; RLS-scoped to the caller regardless.' })
  @RequirePermissions('pmo.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('status') status?: RiskStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.riskIssue.findRisks(scope, { projectId, status });
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get a risk/issue counts-and-priorities summary',
    description: 'projectId is optional. The underlying service also supports an entityId filter, but this route does not expose it — only projectId is accepted here.',
  })
  @RequirePermissions('pmo.view')
  getSummary(@Query('projectId') projectId?: string) {
    return this.riskIssue.getRiskIssueSummary(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a risk by id' })
  @RequirePermissions('pmo.view')
  getOne(@Param('id') id: string) {
    return this.riskIssue.getRisk(id);
  }

  @Post(':id/assess')
  @ApiOperation({
    summary: 'Record a risk assessment',
    description: 'Sets probability/impact and recomputes riskScore. Auto-advances status from IDENTIFIED to ASSESSED; leaves any other status unchanged. Rejected once the risk is CLOSED.',
  })
  @RequirePermissions('pmo.manage')
  assess(@Param('id') id: string, @Body() dto: AssessRiskDto) {
    return this.riskIssue.assessRisk(id, dto);
  }

  @Post(':id/owner')
  @ApiOperation({ summary: 'Assign or change the risk owner', description: 'Notifies the new owner (best-effort) only when the ownerId actually changes.' })
  @RequirePermissions('pmo.manage')
  assignOwner(@Param('id') id: string, @Body() dto: AssignRiskOwnerDto) {
    return this.riskIssue.assignRiskOwner(id, dto);
  }

  @Post(':id/mitigation-plan')
  @ApiOperation({ summary: 'Set the risk mitigation plan', description: 'Forces status to MITIGATING regardless of the risk\'s current status (other than CLOSED, which is rejected).' })
  @RequirePermissions('pmo.manage')
  setMitigationPlan(@Param('id') id: string, @Body() dto: SetMitigationPlanDto) {
    return this.riskIssue.setMitigationPlan(id, dto);
  }

  @Post(':id/monitor')
  @ApiOperation({ summary: 'Move a risk to MONITORING' })
  @RequirePermissions('pmo.manage')
  monitor(@Param('id') id: string) {
    return this.riskIssue.monitorRisk(id);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a risk', description: 'Terminal. Valid from any non-CLOSED status — unlike Issue\'s own close route below, there is no RESOLVED-first requirement.' })
  @RequirePermissions('pmo.manage')
  close(@Param('id') id: string) {
    return this.riskIssue.closeRisk(id);
  }

  @Post(':id/convert-to-issue')
  @ApiOperation({
    summary: 'Convert a risk into a linked issue',
    description: 'One transaction: marks the risk OCCURRED and creates a new ProjectIssue (linked via riskId) through the same path — including the same assignment notification — as the issue create route below.',
  })
  @RequirePermissions('pmo.manage')
  convertToIssue(
    @Param('id') id: string,
    @Body() dto: ConvertRiskToIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.riskIssue.convertRiskToIssue(id, dto, user.id);
  }
}

@ApiTags('pmo-issues')
@ApiBearerAuth()
@Controller('project-issues')
export class IssueController {
  constructor(
    private readonly riskIssue: RiskIssueService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a project issue', description: 'Notifies assignedToId (best-effort) if set at creation.' })
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateIssueDto, @CurrentUser() user: AuthenticatedUser) {
    return this.riskIssue.createIssue(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List issues', description: 'projectId and status are both optional filters; RLS-scoped to the caller regardless.' })
  @RequirePermissions('pmo.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('status') status?: IssueStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.riskIssue.findIssues(scope, { projectId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an issue by id' })
  @RequirePermissions('pmo.view')
  getOne(@Param('id') id: string) {
    return this.riskIssue.getIssue(id);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign or reassign the issue', description: 'Notifies the new assignee (best-effort) only when assignedToId actually changes.' })
  @RequirePermissions('pmo.manage')
  assign(@Param('id') id: string, @Body() dto: AssignIssueDto) {
    return this.riskIssue.assignIssue(id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Move an issue to IN_PROGRESS' })
  @RequirePermissions('pmo.manage')
  start(@Param('id') id: string) {
    return this.riskIssue.startIssueWork(id);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Move an issue to ESCALATED' })
  @RequirePermissions('pmo.manage')
  escalate(@Param('id') id: string) {
    return this.riskIssue.escalateIssue(id);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve an issue', description: 'Sets RESOLVED and stamps resolvedAt; resolutionNotes is optional.' })
  @RequirePermissions('pmo.manage')
  resolve(@Param('id') id: string, @Body() dto: ResolveIssueDto) {
    return this.riskIssue.resolveIssue(id, dto);
  }

  @Post(':id/close')
  @ApiOperation({
    summary: 'Close an issue',
    description: 'Only valid from RESOLVED — rejected with a 400 stating the current status otherwise. A real, different guard shape from Risk\'s own close route above, which allows closing from any non-CLOSED status.',
  })
  @RequirePermissions('pmo.manage')
  close(@Param('id') id: string) {
    return this.riskIssue.closeIssue(id);
  }
}
