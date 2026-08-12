import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectTaskStatus } from '@prisma/client';
import { SchedulingService } from './scheduling.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  CreateProjectTaskDto,
  CreateTaskDependencyDto,
  SetTaskStatusDto,
  UpdateTaskProgressDto,
} from './dto/scheduling.dto';

@ApiTags('pmo-scheduling')
@ApiBearerAuth()
@Controller('project-tasks')
export class SchedulingController {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a project task (WBS item)' })
  create(@Body() dto: CreateProjectTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.scheduling.createTask(dto, user.id);
  }

  @Get()
  @RequirePermissions('pmo.view')
  @ApiOperation({ summary: 'List project tasks', description: 'projectId and status are both optional filters.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('status') status?: ProjectTaskStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.scheduling.findTasks(scope, { projectId, status });
  }

  @Get(':id')
  @RequirePermissions('pmo.view')
  @ApiOperation({ summary: 'Get a task by id, including its own child tasks and dependency edges' })
  getOne(@Param('id') id: string) {
    return this.scheduling.getTask(id);
  }

  @Post(':id/progress')
  @RequirePermissions('pmo.manage')
  @ApiOperation({
    summary: 'Update a task\'s percent complete',
    description: 'Status is derived automatically from percentComplete, not settable directly here: 0 -> NOT_STARTED, 1-99 -> IN_PROGRESS, 100 -> COMPLETED (stamping actualEnd if not already set). Rejected with a 409 on a CANCELLED task.',
  })
  updateProgress(@Param('id') id: string, @Body() dto: UpdateTaskProgressDto) {
    return this.scheduling.updateProgress(id, dto);
  }

  @Post(':id/status')
  @RequirePermissions('pmo.manage')
  @ApiOperation({ summary: 'Set a task\'s status directly', description: 'Unlike POST :id/progress, this sets status without touching percentComplete — no guard against setting a status inconsistent with the current progress value.' })
  setStatus(@Param('id') id: string, @Body() dto: SetTaskStatusDto) {
    return this.scheduling.setStatus(id, dto);
  }

  @Post('dependencies')
  @RequirePermissions('pmo.manage')
  @ApiOperation({
    summary: 'Add a dependency between two tasks',
    description: 'Both tasks must belong to the same project. Rejected if the dependency already exists, or if it would create a cycle in the task network (checked via a graph reachability search, not assumed absent).',
  })
  addDependency(@Body() dto: CreateTaskDependencyDto) {
    return this.scheduling.addDependency(dto);
  }

  @Get('project/:projectId/critical-path')
  @RequirePermissions('pmo.view')
  @ApiOperation({
    summary: 'Compute the critical path for a project',
    description: 'Classic forward/backward-pass CPM. Every dependency type is treated as "successor cannot start before predecessor + lag" for this calculation — a documented simplification; the four distinct relationship types (FINISH_TO_START etc.) are stored faithfully but this release\'s float math does not distinguish between them. Persists isCritical/totalFloatDays on every task as a side effect of computing them.',
  })
  computeCriticalPath(@Param('projectId') projectId: string) {
    return this.scheduling.computeCriticalPath(projectId);
  }

  @Get('project/:projectId/gantt')
  @RequirePermissions('pmo.view')
  @ApiOperation({ summary: 'Get Gantt-chart-shaped task and dependency data for a project' })
  getGanttData(@Param('projectId') projectId: string) {
    return this.scheduling.getGanttData(projectId);
  }

  @Get('project/:projectId/earned-value')
  @RequirePermissions('pmo.view')
  @ApiOperation({
    summary: 'Compute PV/EV/AC/SV/CV/SPI/CPI earned-value metrics for a project',
    description: 'asOfDate is optional, defaulting to now. PV time-phases each task\'s budgetedCost linearly across its planned duration (a documented simplification, not S-curve-weighted). SPI/CPI are null rather than a divide-by-zero artifact when PV/AC is 0.',
  })
  computeEarnedValue(@Param('projectId') projectId: string, @Query('asOfDate') asOfDate?: string) {
    return this.scheduling.computeEarnedValue(projectId, asOfDate);
  }
}
