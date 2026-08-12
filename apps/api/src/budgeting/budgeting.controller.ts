import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BudgetStatus } from '@prisma/client';
import { BudgetingService } from './budgeting.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { ReviseBudgetDto } from './dto/revise-budget.dto';
import { TransferBudgetDto } from './dto/transfer-budget.dto';
import { CreateBudgetCommitmentDto, ReleaseBudgetCommitmentDto } from './dto/budget-commitment.dto';
import { BudgetDecisionDto } from './dto/budget-decision.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('budgeting')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetingController {
  constructor(
    private readonly budgeting: BudgetingService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a budget shell with its lines', description: 'Starts DRAFT (schema default) regardless of any status implied elsewhere in the request.' })
  @RequirePermissions('budget.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.createBudget(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List budgets', description: 'entityId, fiscalYear, and status are all optional filters; RLS-scoped to the caller regardless.' })
  @RequirePermissions('budget.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('fiscalYear') fiscalYear?: string,
    @Query('status') status?: BudgetStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.budgeting.findAll(scope, {
      entityId,
      fiscalYear: fiscalYear ? Number(fiscalYear) : undefined,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a budget by id, with its lines' })
  @RequirePermissions('budget.view')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.budgeting.findOne(id, scope);
  }

  @Get(':id/variance')
  @ApiOperation({
    summary: 'Get budget-vs-actual variance by line',
    description: 'Actual figures are broken down by every dimension a line carries (account, project, phase, department, cost center, funding source).',
  })
  @RequirePermissions('budget.view')
  variance(@Param('id') id: string) {
    return this.budgeting.variance(id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit a draft budget for approval', description: 'Only valid from DRAFT or REJECTED.' })
  @RequirePermissions('budget.submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.submit(id, user.id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a submitted budget' })
  @RequirePermissions('budget.approve')
  approve(@Param('id') id: string, @Body() dto: BudgetDecisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.approve(id, user.id, dto?.comments);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a submitted budget', description: 'Returns it to REJECTED — resubmittable via the same submit endpoint above.' })
  @RequirePermissions('budget.approve')
  reject(@Param('id') id: string, @Body() dto: BudgetDecisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.reject(id, user.id, dto?.comments);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a budget at year end', description: 'Only valid from APPROVED. Terminal — no route reopens a closed budget.' })
  @RequirePermissions('budget.approve')
  close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.close(id, user.id);
  }

  @Post(':id/revise')
  @ApiOperation({
    summary: 'Revise line amounts on an approved budget',
    description: 'Only valid from APPROVED. Every referenced budgetLineId must already belong to this budget, or the whole request is rejected before any line is changed.',
  })
  @RequirePermissions('budget.manage')
  revise(@Param('id') id: string, @Body() dto: ReviseBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.revise(id, dto, user.id);
  }

  @Post(':id/transfer')
  @ApiOperation({
    summary: 'Transfer an amount between two lines of the same approved budget',
    description: 'Only valid from APPROVED. fromLineId and toLineId must differ and must both belong to this budget.',
  })
  @RequirePermissions('budget.transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.transfer(id, dto, user.id);
  }

  // ---- Commitments (used directly here for manual commitments; the
  // Procurement module will call BudgetingService.createCommitment /
  // releaseCommitment programmatically once purchase orders exist) ----

  @Post('commitments')
  @ApiOperation({
    summary: 'Raise a budget commitment against a line',
    description: 'Only valid against a line whose own budget is APPROVED. Also called internally (with an optional transaction handle) by Procurement once a purchase order is created — this route is the manual/direct entry point for the same operation.',
  })
  @RequirePermissions('budget.commit')
  createCommitment(@Body() dto: CreateBudgetCommitmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.budgeting.createCommitment(dto, user.id);
  }

  @Post('commitments/:id/release')
  @ApiOperation({
    summary: 'Release part or all of an open commitment',
    description: 'amount may be partial; rejected if it would exceed the commitment\'s own total (a small floating-point tolerance is allowed). Also called internally by Procurement.',
  })
  @RequirePermissions('budget.commit')
  releaseCommitment(@Param('id') id: string, @Body() dto: ReleaseBudgetCommitmentDto) {
    return this.budgeting.releaseCommitment(id, dto.amount);
  }

  @Post('commitments/:id/cancel')
  @ApiOperation({ summary: 'Cancel an open commitment outright', description: 'Only valid on a still-open commitment; rejected if already released or cancelled.' })
  @RequirePermissions('budget.commit')
  cancelCommitment(@Param('id') id: string) {
    return this.budgeting.cancelCommitment(id);
  }
}
