import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResourceAllocationStatus, ResourceType } from '@prisma/client';
import { ResourceService } from './resource.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  CancelAllocationDto,
  CompleteAllocationDto,
  CreateAllocationDto,
  CreateResourceDto,
} from './dto/resource.dto';

@ApiTags('pmo-resources')
@ApiBearerAuth()
@Controller('project-resources')
export class ResourceController {
  constructor(
    private readonly resource: ResourceService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Register a project resource (a labour crew or a piece of equipment)' })
  create(@Body() dto: CreateResourceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resource.createResource(dto, user.id);
  }

  @Get()
  @RequirePermissions('pmo.view')
  @ApiOperation({
    summary: 'List project resources',
    description: 'projectId and type are both optional filters. isActive is not exposed as a filter here despite the underlying service supporting it — every resource, active or not, is currently returned.',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('type') type?: ResourceType,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.resource.findResources(scope, { projectId, type });
  }

  @Get('utilization')
  @RequirePermissions('pmo.view')
  @ApiOperation({
    summary: 'Get per-resource utilization for a project',
    description: 'Committed quantity (PLANNED+ACTIVE allocations) against capacity, per active resource. A resource with no capacity set reports utilizationPct as null rather than a misleading 0% or 100%.',
  })
  getUtilization(@Query('projectId') projectId: string) {
    return this.resource.getResourceUtilization(projectId);
  }

  @Get(':id')
  @RequirePermissions('pmo.view')
  @ApiOperation({ summary: 'Get a resource by id, including its own allocation history' })
  getOne(@Param('id') id: string) {
    return this.resource.getResource(id);
  }

  @Post(':id/deactivate')
  @RequirePermissions('pmo.manage')
  @ApiOperation({ summary: 'Deactivate a resource' })
  deactivate(@Param('id') id: string) {
    return this.resource.setResourceActive(id, false);
  }

  @Post(':id/reactivate')
  @RequirePermissions('pmo.manage')
  @ApiOperation({ summary: 'Reactivate a previously deactivated resource' })
  reactivate(@Param('id') id: string) {
    return this.resource.setResourceActive(id, true);
  }
}

@ApiTags('pmo-resource-allocations')
@ApiBearerAuth()
@Controller('resource-allocations')
export class ResourceAllocationController {
  constructor(
    private readonly resource: ResourceService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({
    summary: 'Allocate a resource to a task',
    description: "Rejects the allocation if it would over-book the resource: the sum of plannedQuantity across every PLANNED/ACTIVE allocation whose date range overlaps this one (including this request) is checked against the resource's own capacity. Resources with no capacity set skip this check entirely — capacity is opt-in, not assumed.",
  })
  create(@Body() dto: CreateAllocationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.resource.allocateResource(dto, user.id);
  }

  @Get()
  @RequirePermissions('pmo.view')
  @ApiOperation({
    summary: 'List resource allocations',
    description: 'resourceId, taskId, and status are all optional filters.',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('resourceId') resourceId?: string,
    @Query('taskId') taskId?: string,
    @Query('status') status?: ResourceAllocationStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.resource.findAllocations(scope, { resourceId, taskId, status });
  }

  @Get(':id')
  @RequirePermissions('pmo.view')
  @ApiOperation({ summary: 'Get an allocation by id, including its own resource and task' })
  getOne(@Param('id') id: string) {
    return this.resource.getAllocation(id);
  }

  @Post(':id/start')
  @RequirePermissions('pmo.manage')
  @ApiOperation({ summary: 'Start a PLANNED allocation', description: 'Rejected with a 409 if the allocation is already COMPLETED or CANCELLED.' })
  start(@Param('id') id: string) {
    return this.resource.startAllocation(id);
  }

  @Post(':id/complete')
  @RequirePermissions('pmo.manage')
  @ApiOperation({
    summary: 'Complete an allocation',
    description: 'actualQuantity is optional — defaults to the allocation\'s own plannedQuantity if omitted. Rejected with a 409 if the allocation is already COMPLETED or CANCELLED.',
  })
  complete(@Param('id') id: string, @Body() dto: CompleteAllocationDto) {
    return this.resource.completeAllocation(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('pmo.manage')
  @ApiOperation({ summary: 'Cancel an allocation', description: 'Rejected with a 409 if the allocation is already COMPLETED or CANCELLED.' })
  cancel(@Param('id') id: string, @Body() dto: CancelAllocationDto) {
    return this.resource.cancelAllocation(id, dto);
  }
}
