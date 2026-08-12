import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowEngineService } from './workflow.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { StartWorkflowInstanceDto } from './dto/start-workflow-instance.dto';
import { ActOnWorkflowDto } from './dto/act-on-workflow.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Generic, no-code, multi-stage approval-chain engine used across
 * several other modules in this app (e.g. Budgeting decisions,
 * Procurement requisitions) rather than each rolling its own approval
 * flow. Definitions describe an ordered sequence of stages, each
 * optionally role-gated and optionally conditional (a stage-level rule
 * can make it apply only when the starting context matches); instances
 * are one live run of a definition against one real entity.
 */
@ApiTags('workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowEngineService) {}

  // ---- Definitions (no-code admin configuration) ----

  @Post('definitions')
  @ApiOperation({ summary: 'Create a workflow definition', description: 'code must be unique (409 if not); stage sequence numbers must be unique within the definition (400 if not). workflowRules reference a stage by its own sequence number, not its id, since the id does not exist yet at request time.' })
  @RequirePermissions('workflow.admin')
  createDefinition(@Body() dto: CreateWorkflowDefinitionDto) {
    return this.workflow.createDefinition(dto);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'List workflow definitions', description: 'entityType is an optional filter.' })
  @RequirePermissions('workflow.view')
  listDefinitions(@Query('entityType') entityType?: string) {
    return this.workflow.listDefinitions(entityType);
  }

  @Get('definitions/:code')
  @ApiOperation({ summary: 'Get a workflow definition by code, with its stages and rules' })
  @RequirePermissions('workflow.view')
  findDefinition(@Param('code') code: string) {
    return this.workflow.findDefinition(code);
  }

  // ---- Instances ----

  @Post('instances')
  @ApiOperation({
    summary: 'Start a workflow instance for an entity',
    description: 'Rejected (409) if the workflow is not active. Any stage with a workflow-level rule targeting it is included only if at least one of those rules matches the supplied context — a definition with rules can produce instances with genuinely different stage sets depending on context, not always the full stage list. 400 if no stage ends up applicable at all.',
  })
  @RequirePermissions('workflow.manage')
  startInstance(@Body() dto: StartWorkflowInstanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.startInstance(dto, user.id);
  }

  @Get('instances/:id')
  @ApiOperation({ summary: 'Get a workflow instance, with every stage instance and every action taken on it' })
  @RequirePermissions('workflow.view')
  getInstance(@Param('id') id: string) {
    return this.workflow.getInstance(id);
  }

  @Get('instances')
  @ApiOperation({ summary: 'List workflow instances for one entity', description: 'entityType and entityId are both required, not optional filters — this route always scopes to exactly one entity.' })
  @RequirePermissions('workflow.view')
  getInstancesForEntity(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.workflow.getInstancesForEntity(entityType, entityId);
  }

  @Post('instances/:id/actions')
  @ApiOperation({
    summary: 'Act on the currently-active stage of a workflow instance',
    description: "409 if the instance isn't IN_PROGRESS or has no active stage. Role-gated by the active stage's own requiredRoleCode for every action except COMMENT (400 if the caller lacks it). A REJECT action ends the WHOLE instance immediately, not just the current stage — there is no per-stage-only rejection.",
  })
  @RequirePermissions('workflow.act')
  act(@Param('id') id: string, @Body() dto: ActOnWorkflowDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.act(id, dto, user.id);
  }

  @Post('instances/:id/resubmit')
  @ApiOperation({ summary: 'Resubmit a RETURNED instance', description: 'Rejected (409) unless the instance is currently RETURNED. Always restarts from the FIRST stage, not the stage it was returned from — a RETURN sends the whole approval chain back to the beginning, not just back one step.' })
  @RequirePermissions('workflow.manage')
  resubmit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.resubmit(id, user.id);
  }
}
