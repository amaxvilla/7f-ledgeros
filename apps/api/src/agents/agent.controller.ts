import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentStatus, AgentType } from '@prisma/client';
import { AgentService } from './agent.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  CreateAgentDto,
  SuspendAgentDto,
  TerminateAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto';

/**
 * Agent Management, RE-AGENT.1 — Agent Master. Ordinary JWT+RBAC+RLS
 * admin CRUD for the Agent master, plus its four guarded lifecycle
 * transitions. See AgentService's own doc comment for what is
 * deliberately NOT in this checkpoint's scope (assignment, commission).
 */
@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentController {
  constructor(
    private readonly agents: AgentService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new agent',
    description: 'Starts in PENDING_APPROVAL — see the approve endpoint to activate it.',
  })
  @RequirePermissions('agent.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateAgentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agents.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List agents, optionally filtered by entity/status/type or searched by name/code/email/phone',
  })
  @RequirePermissions('agent.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: AgentStatus,
    @Query('agentType') agentType?: AgentType,
    @Query('search') search?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.findAgents(scope, { entityId, status, agentType, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single agent by id' })
  @RequirePermissions('agent.view')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.getAgent(scope, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update agent master data',
    description: 'Cannot change status, code, or entityId through this endpoint — use the lifecycle endpoints below for status.',
  })
  @RequirePermissions('agent.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.update(scope, id, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending agent', description: 'Only valid from PENDING_APPROVAL — rejected with a 409 otherwise.' })
  @RequirePermissions('agent.manage')
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.approve(scope, id, user.id);
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend an active agent', description: 'Only valid from ACTIVE — rejected with a 409 otherwise.' })
  @RequirePermissions('agent.manage')
  async suspend(@Param('id') id: string, @Body() dto: SuspendAgentDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.suspend(scope, id, dto, user.id);
  }

  @Post(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a suspended agent', description: 'Only valid from SUSPENDED — rejected with a 409 otherwise.' })
  @RequirePermissions('agent.manage')
  async reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.reactivate(scope, id, user.id);
  }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Terminate an agent', description: 'Valid from any non-terminal status. Terminal — a terminated agent cannot be un-terminated.' })
  @RequirePermissions('agent.manage')
  async terminate(@Param('id') id: string, @Body() dto: TerminateAgentDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.agents.terminate(scope, id, dto, user.id);
  }
}
