import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommissionReportingService } from './commission-reporting.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';

/**
 * Agent & Commission Management, RE-COMM.5 — Agent Statements &
 * Reporting. Every route requires `commission.view` only (the same
 * read permission every other read route on `/commission-calculations`
 * already requires) — none of these routes write anything.
 */
@ApiTags('commission-reporting')
@ApiBearerAuth()
@Controller('commission-reporting')
export class CommissionReportingController {
  constructor(
    private readonly reporting: CommissionReportingService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Commission earned/approved/payable/paid/outstanding totals, optionally filtered by entity' })
  @RequirePermissions('commission.view')
  async summary(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.getSummary(scope, entityId);
  }

  @Get('by-agent')
  @ApiOperation({ summary: 'Commission earned/paid/outstanding broken down by agent' })
  @RequirePermissions('commission.view')
  async byAgent(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.getByAgent(scope, entityId);
  }

  @Get('by-project')
  @ApiOperation({ summary: 'Commission earned/paid/outstanding broken down by project, with a per-unit breakdown nested under each project' })
  @RequirePermissions('commission.view')
  async byProject(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.getByProject(scope, entityId);
  }

  @Get('aging')
  @ApiOperation({ summary: 'Commission aging — PAYABLE calculations bucketed by days outstanding since markedPayableAt' })
  @RequirePermissions('commission.view')
  async aging(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.getAging(scope, entityId);
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Commission forecast — unpaid pipeline grouped by lifecycle stage (CALCULATED/PENDING/APPROVED/PAYABLE)' })
  @RequirePermissions('commission.view')
  async forecast(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.getForecast(scope, entityId);
  }

  @Get('agent-statement/:agentId')
  @ApiOperation({ summary: 'A single agent statement: summary totals plus the full list of that agent\'s commission calculations' })
  @RequirePermissions('commission.view')
  async agentStatement(@Param('agentId') agentId: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.getAgentStatement(scope, agentId);
  }
}
