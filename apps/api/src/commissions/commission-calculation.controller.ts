import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommissionCalculationStatus } from '@prisma/client';
import { CommissionCalculationService } from './commission-calculation.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  AdjustCommissionCalculationDto,
  ApproveCommissionCalculationDto,
  CalculateCommissionDto,
  CancelCommissionCalculationDto,
  MarkPaidCommissionCalculationDto,
  MarkPayableCommissionCalculationDto,
  RejectCommissionCalculationDto,
  ReverseCommissionCalculationDto,
  SubmitCommissionCalculationDto,
} from './dto/commission-calculation.dto';

/**
 * Agent & Commission Management, RE-COMM.2/RE-COMM.3/RE-COMM.4 —
 * Commission Calculation + Lifecycle + Financial Integration. Computes
 * and stores one commission amount per (SALE-scope) AgentAssignment,
 * plus a dry-run preview, guarded cancel/reverse, the full submit ->
 * approve/reject -> markPayable -> markPaid approval/payment workflow
 * (markPayable/markPaid both post through PostingEngineService — see
 * CommissionCalculationService's own doc comment), and an atomic
 * adjust (reverse-and-recalculate).
 */
@ApiTags('commission-calculations')
@ApiBearerAuth()
@Controller('commission-calculations')
export class CommissionCalculationController {
  constructor(
    private readonly calculations: CommissionCalculationService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Preview a commission calculation without persisting it',
    description: 'Runs the identical resolution/computation logic as POST / — same validation, same plan resolution — but writes nothing.',
  })
  @RequirePermissions('commission.view')
  async preview(@Body() dto: CalculateCommissionDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.preview(scope, dto);
  }

  @Post()
  @ApiOperation({
    summary: 'Calculate and persist a commission for a SALE-scope agent assignment',
    description:
      'Resolves the applicable CommissionPlan (UNIT > PROJECT > ESTATE > AGENT > GLOBAL), applies its rate/tier schedule to the chosen basis, deducts WHT if a tax code is supplied, and snapshots every number used. Rejected with a 409 if the assignment already has an active (CALCULATED) calculation.',
  })
  @RequirePermissions('commission.manage')
  async calculate(@Body() dto: CalculateCommissionDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.calculate(scope, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List commission calculations, optionally filtered by entity/agent/status' })
  @RequirePermissions('commission.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('agentId') agentId?: string,
    @Query('status') status?: CommissionCalculationStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.findAll(scope, { entityId, agentId, status });
  }

  @Get('by-agent/:agentId')
  @ApiOperation({ summary: 'List commission calculations for a specific agent' })
  @RequirePermissions('commission.view')
  async findForAgent(@Param('agentId') agentId: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.findForAgent(scope, agentId);
  }

  @Get('by-allocation/:allocationId')
  @ApiOperation({ summary: 'List commission calculations for a specific sale allocation' })
  @RequirePermissions('commission.view')
  async findForAllocation(@Param('allocationId') allocationId: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.findForAllocation(scope, allocationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single commission calculation by id' })
  @RequirePermissions('commission.view')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.getOne(scope, id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a CALCULATED commission calculation that was never acted on',
    description: 'Terminal. Valid from CALCULATED or PENDING only — once APPROVED, use reverse instead. Recalculate (or use adjust) instead of trying to resurrect a cancelled row.',
  })
  @RequirePermissions('commission.manage')
  async cancel(@Param('id') id: string, @Body() dto: CancelCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.cancel(scope, id, dto, user.id);
  }

  @Post(':id/reverse')
  @ApiOperation({
    summary: 'Reverse a commission calculation (e.g. the underlying sale was reversed, or the calculation itself was wrong)',
    description: 'Terminal. Valid from any non-terminal status, including PAID (a clawback). The row is kept for audit, never deleted.',
  })
  @RequirePermissions('commission.manage')
  async reverse(@Param('id') id: string, @Body() dto: ReverseCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.reverse(scope, id, dto, user.id);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Submit a CALCULATED commission for approval',
    description: 'CALCULATED -> PENDING. First step of the approval workflow — see CommissionCalculationService for the full transition graph.',
  })
  @RequirePermissions('commission.manage')
  async submit(@Param('id') id: string, @Body() dto: SubmitCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.submit(scope, id, dto, user.id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve a PENDING commission calculation',
    description: 'PENDING -> APPROVED. Requires commission.approve specifically, a distinct permission from commission.manage — a real maker-checker control.',
  })
  @RequirePermissions('commission.approve')
  async approve(@Param('id') id: string, @Body() dto: ApproveCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.approve(scope, id, dto, user.id);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject a PENDING commission calculation',
    description: 'PENDING -> REJECTED. Terminal — a distinct outcome from cancel: this means an approver reviewed and declined it. Requires commission.approve, same as approve itself.',
  })
  @RequirePermissions('commission.approve')
  async reject(@Param('id') id: string, @Body() dto: RejectCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.reject(scope, id, dto, user.id);
  }

  @Post(':id/mark-payable')
  @ApiOperation({
    summary: 'Mark an APPROVED commission calculation as payable and post the accrual',
    description: 'APPROVED -> PAYABLE. Posts Dr commission expense (gross) / Cr WHT authority (if applicable) / Cr commission payable (net) through PostingEngineService.',
  })
  @RequirePermissions('commission.manage')
  async markPayable(@Param('id') id: string, @Body() dto: MarkPayableCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.markPayable(scope, id, dto, user.id);
  }

  @Post(':id/mark-paid')
  @ApiOperation({
    summary: 'Mark a PAYABLE commission calculation as paid and post the clearing entry',
    description: 'PAYABLE -> PAID. Posts Dr commission payable (the same account markPayable recorded) / Cr cash through PostingEngineService.',
  })
  @RequirePermissions('commission.manage')
  async markPaid(@Param('id') id: string, @Body() dto: MarkPaidCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.markPaid(scope, id, dto, user.id);
  }

  @Post(':id/adjust')
  @ApiOperation({
    summary: 'Reverse a commission calculation and immediately recalculate a corrected replacement, atomically',
    description: 'Valid from any non-terminal status. The new row is linked back to the one it replaced via supersedesCalculationId.',
  })
  @RequirePermissions('commission.manage')
  async adjust(@Param('id') id: string, @Body() dto: AdjustCommissionCalculationDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.calculations.adjust(scope, id, dto, user.id);
  }
}
