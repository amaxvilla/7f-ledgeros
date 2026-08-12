import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlacementStatus } from '@prisma/client';
import { TreasuryService } from './treasury.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { MaskFields } from '../security/decorators/mask-fields.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('treasury')
@ApiBearerAuth()
@Controller('treasury')
export class TreasuryController {
  constructor(
    private readonly treasury: TreasuryService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Bank & Cash accounts ----

  @Post('bank-accounts')
  @RequirePermissions('treasury.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a bank account for an entity' })
  createBankAccount(
    @Body() body: { entityId: string; accountName: string; accountNumber: string; bankName: string; currency?: string },
  ) {
    return this.treasury.createBankAccount(
      body.entityId,
      body.accountName,
      body.accountNumber,
      body.bankName,
      body.currency,
    );
  }

  @Get('bank-accounts')
  @RequirePermissions('treasury.view')
  @MaskFields({ group: 'bankDetails', fields: ['accountNumber'] })
  @ApiOperation({ summary: 'List bank accounts', description: 'accountNumber is masked for callers without the unmask permission for the bankDetails field group.' })
  async findBankAccounts(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.treasury.findBankAccounts(scope, entityId);
  }

  @Post('cash-accounts')
  @RequirePermissions('treasury.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a petty-cash/custodian cash account for an entity' })
  createCashAccount(@Body() body: { entityId: string; name: string; custodian?: string; currency?: string }) {
    return this.treasury.createCashAccount(body.entityId, body.name, body.custodian, body.currency);
  }

  @Get('cash-accounts')
  @RequirePermissions('treasury.view')
  @ApiOperation({ summary: 'List cash accounts for an entity' })
  async findCashAccounts(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.treasury.findCashAccounts(scope, entityId);
  }

  // ---- Loan Facilities ----

  @Post('loan-facilities')
  @RequirePermissions('treasury.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a loan facility' })
  createLoanFacility(@Body() body: Parameters<TreasuryService['createLoanFacility']>[0]) {
    return this.treasury.createLoanFacility(body);
  }

  @Get('loan-facilities')
  @RequirePermissions('treasury.view')
  @MaskFields({ group: 'loanValues', fields: ['facilityAmount', 'interestRatePercent'] })
  @ApiOperation({ summary: 'List loan facilities', description: 'facilityAmount and interestRatePercent are masked for callers without the unmask permission for the loanValues field group.' })
  async findLoanFacilities(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.treasury.findLoanFacilities(scope, entityId);
  }

  @Get('loan-facilities/:id/position')
  @RequirePermissions('treasury.view')
  @MaskFields({
    group: 'loanValues',
    fields: ['facilityAmount', 'totalDrawn', 'undrawnBalance', 'outstandingPrincipal', 'outstandingInterest'],
  })
  @ApiOperation({
    summary: 'Get a loan facility\'s current position',
    description: 'Computed on the fly from the facility\'s drawdowns, repayment schedule, and interest accruals — not a stored balance. Returns facilityAmount, totalDrawn, undrawnBalance, outstanding principal and interest.',
  })
  getLoanPosition(@Param('id') id: string) {
    return this.treasury.getLoanPosition(id);
  }

  @Post('drawdowns')
  @RequirePermissions('treasury.transact')
  @ApiOperation({
    summary: 'Draw down against a loan facility',
    description: 'Rejected if the facility is not ACTIVE, or if the drawdown would exceed the undrawn balance (facilityAmount minus prior drawdowns).',
  })
  createDrawdown(
    @Body() body: Omit<Parameters<TreasuryService['createDrawdown']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treasury.createDrawdown({ ...body, createdById: user.id });
  }

  @Post('repayment-schedules')
  @RequirePermissions('treasury.manage')
  @ApiOperation({
    summary: 'Generate a flat-interest repayment schedule for a facility',
    description: 'Equal principal installments; interest on each installment is computed on the ORIGINAL total drawn balance (flat-rate, not declining-balance). Rejected if a schedule already exists for this facility, or if nothing has been drawn down yet.',
  })
  generateRepaymentSchedule(@Body() body: Parameters<TreasuryService['generateRepaymentSchedule']>[0]) {
    return this.treasury.generateRepaymentSchedule(body);
  }

  @Post('repayments')
  @RequirePermissions('treasury.transact')
  @ApiOperation({
    summary: 'Record a repayment against one installment',
    description: 'Rejected if the installment was already fully paid, or if the principal/interest paid would exceed the amount due on that installment. The installment is marked settled once both principal and interest match what was due.',
  })
  recordRepayment(@Body() body: Parameters<TreasuryService['recordRepayment']>[0]) {
    return this.treasury.recordRepayment(body);
  }

  @Post('loan-facilities/:id/interest-accruals')
  @RequirePermissions('treasury.transact')
  @ApiOperation({ summary: 'Record an interest accrual against a loan facility' })
  recordInterestAccrual(@Param('id') id: string, @Body() body: { accrualDate: string; amount: number }) {
    return this.treasury.recordInterestAccrual(id, body.accrualDate, body.amount);
  }

  // ---- Investment placements ----

  @Post('placements')
  @RequirePermissions('treasury.manage')
  @ApiOperation({
    summary: 'Create an investment placement',
    description: 'Rejected if principalAmount is not positive, or if maturityDate is not after placementDate.',
  })
  createPlacement(@Body() body: Parameters<TreasuryService['createPlacement']>[0]) {
    return this.treasury.createPlacement(body);
  }

  @Get('placements')
  @RequirePermissions('treasury.view')
  @ApiOperation({ summary: 'List investment placements, optionally filtered by entity and/or status' })
  findPlacements(@Query('entityId') entityId?: string, @Query('status') status?: PlacementStatus) {
    return this.treasury.findPlacements(entityId, status);
  }

  @Post('placements/:id/mature')
  @RequirePermissions('treasury.transact')
  @ApiOperation({
    summary: 'Process a placement reaching maturity',
    description: "Behavior depends on the placement's own maturityInstruction: PAYOUT marks it MATURED and stops there. Either rollover instruction marks the original MATURED AND creates a brand-new ACTIVE placement of the same tenor length, with its principal equal to the original principal (ROLLOVER_PRINCIPAL) or original principal plus actualInterestEarned (ROLLOVER_PRINCIPAL_AND_INTEREST). Returns the NEW placement in the rollover case, not the matured one. Rejected if the placement is not currently ACTIVE.",
  })
  processMaturity(@Param('id') id: string, @Body() body: { actualInterestEarned: number }) {
    return this.treasury.processMaturity(id, body.actualInterestEarned);
  }
}
