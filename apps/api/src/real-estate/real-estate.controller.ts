import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UnitStatus } from '@prisma/client';
import { RealEstateService } from './real-estate.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  ReserveUnitRequestDto,
  CancelReservationDto,
  ConvertReservationRequestDto,
  CancelAllocationDto,
  TransferAllocationDto,
  SwapUnitDto,
} from './dto/property-sales.dto';

@ApiTags('real-estate')
@ApiBearerAuth()
@Controller('real-estate')
export class RealEstateController {
  constructor(
    private readonly realEstate: RealEstateService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post('estates')
  @RequirePermissions('realestate.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create an estate', description: 'Rejected if this code is already used by another estate in the same entity.' })
  createEstate(
    @Body() body: { entityId: string; code: string; name: string; description?: string; location?: string },
  ) {
    return this.realEstate.createEstate(body.entityId, body.code, body.name, body.description, body.location);
  }

  @Get('estates')
  @RequirePermissions('realestate.view')
  @ApiOperation({ summary: 'List estates for an entity, with their projects', description: 'Row-level-security scoped by entity/businessUnit dimensions.' })
  async findEstates(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.realEstate.findEstates(scope, entityId);
  }

  @Post('allocations')
  @RequirePermissions('realestate.sell')
  @ApiOperation({
    summary: 'Allocate (sell) a unit directly to a customer',
    description: 'The older, direct allocation path (pre-Phase-4), distinct from reserveUnit/convertReservation below. Rejected if the unit is not AVAILABLE or salePrice is not positive. Sets the unit to RESERVED (not ALLOCATED) and creates the allocation in one transaction.',
  })
  allocateUnit(
    @Body() body: { unitId: string; customerId: string; salePrice: number; allocationDate: string },
  ) {
    return this.realEstate.allocateUnit(body.unitId, body.customerId, body.salePrice, body.allocationDate);
  }

  @Post('units/:unitId/status')
  @RequirePermissions('realestate.manage')
  @ApiOperation({ summary: 'Force-set a unit\'s status', description: 'No transition guard of any kind — any status can be set from any current status. An administrative override, not a workflow action.' })
  updateUnitStatus(@Param('unitId') unitId: string, @Body() body: { status: UnitStatus }) {
    return this.realEstate.updateUnitStatus(unitId, body.status);
  }

  @Post('installment-schedules')
  @RequirePermissions('realestate.sell')
  @ApiOperation({
    summary: 'Create an installment schedule for an allocation',
    description: 'Rejected if the allocation already has a schedule, or if the installments\' amounts do not sum to the allocation\'s own salePrice (within 0.01).',
  })
  createSchedule(
    @Body() body: { allocationId: string; installments: { dueDate: string; amountDue: number }[] },
  ) {
    return this.realEstate.createInstallmentSchedule(body);
  }

  @Get('allocations/:allocationId/schedule')
  @RequirePermissions('realestate.view')
  @ApiOperation({ summary: 'Get an allocation\'s installment schedule and lines' })
  getSchedule(@Param('allocationId') allocationId: string) {
    return this.realEstate.getSchedule(allocationId);
  }

  @Get('customers/:customerId/statement')
  @RequirePermissions('realestate.view')
  @ApiOperation({
    summary: 'Get a customer\'s statement across every unit allocation',
    description: 'For each allocation: unit, sale price, status, and outstanding balance (total due minus total paid across its installment lines), plus a grand total outstanding across all of them.',
  })
  getCustomerStatement(@Param('customerId') customerId: string) {
    return this.realEstate.getCustomerStatement(customerId);
  }

  // ---- Phase 4: Property Sales completion ----

  @Post('reservations')
  @RequirePermissions('realestate.sell')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({
    summary: 'Reserve a unit for a customer',
    description: 'Rejected if the unit is not AVAILABLE or already has an ACTIVE reservation. expiresInHours defaults to 72 if omitted or not positive. Auto-flags the reservation as a resale if this unit has a prior cancelled allocation.',
  })
  reserveUnit(@Body() dto: ReserveUnitRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.realEstate.reserveUnit(dto, user.id);
  }

  @Post('reservations/:reservationId/cancel')
  @RequirePermissions('realestate.sell')
  @ApiOperation({ summary: 'Cancel a reservation', description: 'Rejected unless the reservation is currently ACTIVE. Returns the unit to AVAILABLE.' })
  cancelReservation(
    @Param('reservationId') reservationId: string,
    @Body() dto: CancelReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realEstate.cancelReservation(reservationId, user.id, dto.reason);
  }

  @Post('reservations/:reservationId/convert')
  @RequirePermissions('realestate.sell')
  @ApiOperation({
    summary: 'Convert an active reservation into a confirmed sale',
    description: 'Rejected unless the reservation is ACTIVE and not yet expired. Creates the UnitSaleAllocation (status ALLOCATED), then raises and posts an AR invoice through the existing Accounts Receivable flow (no bespoke GL posting here).',
  })
  convertReservation(
    @Param('reservationId') reservationId: string,
    @Body() dto: ConvertReservationRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realEstate.convertReservationToSale(reservationId, dto, user.id);
  }

  @Post('reservations/expire-stale')
  @RequirePermissions('realestate.manage')
  @ApiOperation({
    summary: 'Expire every ACTIVE reservation past its expiry',
    description: 'Idempotent — safe to call repeatedly. Returns the affected units to AVAILABLE. Not currently wired to a scheduled worker job; this is the manual trigger until it is.',
  })
  expireStaleReservations() {
    return this.realEstate.expireStaleReservations();
  }

  @Post('allocations/:allocationId/cancel')
  @RequirePermissions('realestate.manage')
  @ApiOperation({
    summary: 'Cancel a unit sale allocation',
    description: 'Rejected if already cancelled or already HANDED_OVER/SOLD. Returns the unit to AVAILABLE. Does NOT touch any AR invoice already posted for this allocation — a credit note/write-off is a separate, deliberate AR action this route does not perform.',
  })
  cancelAllocation(
    @Param('allocationId') allocationId: string,
    @Body() dto: CancelAllocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realEstate.cancelAllocation(allocationId, user.id, dto.reason);
  }

  @Post('allocations/:allocationId/transfer')
  @RequirePermissions('realestate.manage')
  @ApiOperation({
    summary: 'Transfer an allocation to a different customer, same unit',
    description: 'Rejected if the original is cancelled or already HANDED_OVER/SOLD. Cancels the original allocation and creates a new one linked via transferredFromAllocationId, rather than mutating the customer in place, so history survives. Any existing installment schedule/AR invoice stays attached to the original (now-cancelled) allocation — reassigning those is a separate, deliberate follow-up action this route does not perform.',
  })
  transferAllocation(
    @Param('allocationId') allocationId: string,
    @Body() dto: TransferAllocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realEstate.transferAllocation(allocationId, dto.newCustomerId, user.id, dto.reason);
  }

  @Post('allocations/:allocationId/swap')
  @RequirePermissions('realestate.manage')
  @ApiOperation({
    summary: 'Swap the unit under an allocation, same customer',
    description: 'Rejected if the original allocation is cancelled/HANDED_OVER/SOLD, or the new unit is not AVAILABLE. Same lineage/limitations as transfer (installment schedule/AR invoice reassignment is a separate follow-up action). Frees the original unit to AVAILABLE.',
  })
  swapUnitAllocation(
    @Param('allocationId') allocationId: string,
    @Body() dto: SwapUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.realEstate.swapUnitAllocation(allocationId, dto.newUnitId, user.id, dto.reason);
  }

  @Get('units/:unitId/allocation-history')
  @RequirePermissions('realestate.view')
  @ApiOperation({ summary: 'Get a unit\'s full allocation event history (reservations, sales, cancellations, transfers, swaps)' })
  getAllocationHistory(@Param('unitId') unitId: string) {
    return this.realEstate.getAllocationHistory(unitId);
  }

  @Get('reservations/pipeline-summary')
  @RequirePermissions('realestate.view')
  @ApiOperation({
    summary: 'Reservation pipeline counts',
    description: 'active (currently ACTIVE), expiringSoon (ACTIVE and expiring within 48 hours), and convertedThisMonth/cancelledThisMonth (calendar-month-to-date, since the 1st of the current month).',
  })
  getReservationPipelineSummary(@Query('entityId') entityId?: string) {
    return this.realEstate.getReservationPipelineSummary(entityId);
  }
}
