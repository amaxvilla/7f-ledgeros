import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommissionPlanScope, CommissionPlanStatus } from '@prisma/client';
import { CommissionPlanService } from './commission-plan.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  CreateCommissionPlanDto,
  DeactivateCommissionPlanDto,
  UpdateCommissionPlanDto,
} from './dto/commission-plan.dto';

/**
 * Agent & Commission Management, RE-COMM.1 — Commission Plans. Ordinary
 * JWT+RBAC+RLS admin CRUD for the CommissionPlan master, plus its one
 * guarded lifecycle transition (deactivate), plus a read-only
 * plan-resolution lookup endpoint RE-COMM.2 (Commission Calculation)
 * will build on. See CommissionPlanService's own doc comment for what
 * is deliberately NOT in this checkpoint's scope.
 */
@ApiTags('commission-plans')
@ApiBearerAuth()
@Controller('commission-plans')
export class CommissionPlanController {
  constructor(
    private readonly plans: CommissionPlanService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new commission plan',
    description: 'Starts ACTIVE. Exactly one of projectId/estateId/unitId/agentId must match `scope` (GLOBAL sets none).',
  })
  @RequirePermissions('commission.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateCommissionPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List commission plans, optionally filtered by entity/scope/status/agent/project/estate/unit/isReferral',
  })
  @RequirePermissions('commission.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('scope') scope?: CommissionPlanScope,
    @Query('status') status?: CommissionPlanStatus,
    @Query('agentId') agentId?: string,
    @Query('projectId') projectId?: string,
    @Query('estateId') estateId?: string,
    @Query('unitId') unitId?: string,
    @Query('isReferral') isReferral?: string,
  ) {
    const securityScope = await this.securityContext.buildScope(user);
    return this.plans.findPlans(securityScope, {
      entityId,
      scope,
      status,
      agentId,
      projectId,
      estateId,
      unitId,
      isReferral: isReferral === undefined ? undefined : isReferral === 'true',
    });
  }

  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve the single best-matching ACTIVE plan for a target',
    description: 'Precedence: UNIT > PROJECT > ESTATE > AGENT > GLOBAL. Returns null if nothing matches. Read-only — computes nothing.',
  })
  @RequirePermissions('commission.view')
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId?: string,
    @Query('estateId') estateId?: string,
    @Query('unitId') unitId?: string,
    @Query('agentId') agentId?: string,
    @Query('isReferral') isReferral?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.plans.resolvePlan(scope, {
      entityId,
      projectId,
      estateId,
      unitId,
      agentId,
      isReferral: isReferral === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single commission plan by id' })
  @RequirePermissions('commission.view')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.plans.getPlan(scope, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a commission plan',
    description: 'Cannot change status, code, entityId, scope, or scope-target fields — those are immutable after create.',
  })
  @RequirePermissions('commission.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateCommissionPlanDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.plans.update(scope, id, dto);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an active commission plan', description: 'Only valid from ACTIVE — rejected with a 409 otherwise. No reactivation path; create a new plan instead.' })
  @RequirePermissions('commission.manage')
  async deactivate(@Param('id') id: string, @Body() dto: DeactivateCommissionPlanDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.plans.deactivate(scope, id, dto, user.id);
  }
}
