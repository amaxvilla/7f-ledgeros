import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentAssignmentScope } from '@prisma/client';
import { AgentAssignmentService } from './agent-assignment.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import { CreateAgentAssignmentDto, EndAgentAssignmentDto } from './dto/agent-assignment.dto';

/**
 * Agent Management, RE-AGENT.2 — Agent Assignment. Reuses the same
 * `agent.manage`/`agent.view` permissions as AgentController (RE-AGENT.1)
 * — assignment is part of the same Agent domain, not a separate
 * permission-gated resource.
 */
@ApiTags('agents')
@ApiBearerAuth()
@Controller('agent-assignments')
export class AgentAssignmentController {
  constructor(
    private readonly assignments: AgentAssignmentService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Assign an agent to a project, unit, or confirmed sale',
    description: 'Exactly one of projectId/unitId/allocationId must be supplied, matching `scope`. At most one active PRIMARY assignment is allowed per target — a second is rejected with a 409, requiring the existing one to be ended first. entityId is cross-validated against the target\'s own real entity and rejected with a 400 on mismatch.',
  })
  @RequirePermissions('agent.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateAgentAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignments.create(dto, user.id);
  }

  @Get('by-agent/:agentId')
  @ApiOperation({ summary: 'Full assignment history for one agent', description: 'Includes ended assignments, not just active ones — this is the agent\'s own assignment history, most recent first.' })
  @RequirePermissions('agent.view')
  async findForAgent(@Param('agentId') agentId: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.assignments.findForAgent(scope, agentId);
  }

  @Get('by-target')
  @ApiOperation({
    summary: 'Full assignment history for one project, unit, or sale',
    description: 'Pass `scope` plus exactly one of projectId/unitId/allocationId. Includes ended assignments, most recent first.',
  })
  @RequirePermissions('agent.view')
  async findForTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope: AgentAssignmentScope,
    @Query('projectId') projectId?: string,
    @Query('unitId') unitId?: string,
    @Query('allocationId') allocationId?: string,
  ) {
    const securityScope = await this.securityContext.buildScope(user);
    return this.assignments.findForTarget(securityScope, { scope, projectId, unitId, allocationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single agent assignment by id' })
  @RequirePermissions('agent.view')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.assignments.getAssignment(scope, id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End an active agent assignment', description: 'Preserved as history, never deleted. Rejected with a 409 if this assignment has already ended.' })
  @RequirePermissions('agent.manage')
  async end(@Param('id') id: string, @Body() dto: EndAgentAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.assignments.end(scope, id, dto, user.id);
  }
}
