import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { POStatus, PRStatus } from '@prisma/client';
import { ProcurementService } from './procurement.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { RequisitionDecisionDto } from './dto/requisition-decision.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { CreateGRNDto } from './dto/create-grn.dto';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { CreateThreeWayMatchDto } from './dto/create-three-way-match.dto';
import { CompleteThreeWayMatchDto } from './dto/complete-three-way-match.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('procurement')
@ApiBearerAuth()
@Controller('procurement')
export class ProcurementController {
  constructor(
    private readonly procurement: ProcurementService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Purchase Requisitions ----

  @Post('requisitions')
  @ApiOperation({ summary: 'Create a draft purchase requisition' })
  @RequirePermissions('procurement.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createRequisition(@Body() dto: CreateRequisitionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.createRequisition(dto, user.id);
  }

  @Get('requisitions')
  @ApiOperation({ summary: 'List purchase requisitions', description: 'RLS-scoped to the caller\'s entity access; optionally further filtered by entityId and/or status.' })
  @RequirePermissions('procurement.view')
  async findAllRequisitions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: PRStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.procurement.findAllRequisitions(scope, { entityId, status });
  }

  @Get('requisitions/:id')
  @ApiOperation({ summary: 'Get one purchase requisition' })
  @RequirePermissions('procurement.view')
  async findRequisition(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.procurement.findRequisition(id, scope);
  }

  @Post('requisitions/:id/submit')
  @ApiOperation({ summary: 'Submit a draft (or previously-rejected) requisition for approval' })
  @RequirePermissions('procurement.manage')
  submitRequisition(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.submitRequisition(id, user.id);
  }

  @Post('requisitions/:id/approve')
  @ApiOperation({ summary: 'Approve a submitted requisition', description: 'The original requester cannot also approve it — segregation of duties, enforced server-side.' })
  @RequirePermissions('procurement.approve')
  approveRequisition(
    @Param('id') id: string,
    @Body() dto: RequisitionDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procurement.approveRequisition(id, user.id, dto);
  }

  @Post('requisitions/:id/reject')
  @ApiOperation({ summary: 'Reject a submitted requisition, returning it to draft' })
  @RequirePermissions('procurement.approve')
  rejectRequisition(
    @Param('id') id: string,
    @Body() dto: RequisitionDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procurement.rejectRequisition(id, user.id, dto);
  }

  // ---- Purchase Orders ----

  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create a purchase order' })
  @RequirePermissions('procurement.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.createPurchaseOrder(dto, user.id);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders', description: 'RLS-scoped to the caller\'s entity access; optionally further filtered by entityId, status, and/or vendorId.' })
  @RequirePermissions('procurement.view')
  async findAllPurchaseOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: POStatus,
    @Query('vendorId') vendorId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.procurement.findAllPurchaseOrders(scope, { entityId, status, vendorId });
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get one purchase order' })
  @RequirePermissions('procurement.view')
  async findPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.procurement.findPurchaseOrder(id, scope);
  }

  @Post('purchase-orders/:id/approve')
  @ApiOperation({ summary: 'Approve a purchase order' })
  @RequirePermissions('procurement.approve')
  approvePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.approvePurchaseOrder(id, user.id);
  }

  @Post('purchase-orders/:id/reject')
  @ApiOperation({ summary: 'Reject a purchase order' })
  @RequirePermissions('procurement.approve')
  rejectPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.rejectPurchaseOrder(id, user.id);
  }

  // ---- Goods Receipt (ProcurementGRN) ----

  @Post('grn')
  @ApiOperation({ summary: 'Record a goods receipt against a purchase order', description: 'The PO must currently be APPROVED or PARTIALLY_RECEIVED. Feeds the GR/IR clearing account that a later three-way match completion clears against.' })
  @RequirePermissions('procurement.receive')
  receiveGoods(@Body() dto: CreateGRNDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.receiveGoods(dto, user.id);
  }

  // ---- Vendor Invoices ----

  @Post('vendor-invoices')
  @ApiOperation({ summary: 'Record a vendor invoice', description: 'purchaseOrderId is optional; when given, the PO must belong to the same entity/vendor as the invoice. A PO-backed invoice is expected to post through three-way match (POST /procurement/three-way-match/:id/complete) rather than directly through Accounts Payable.' })
  @RequirePermissions('procurement.manage')
  createVendorInvoice(@Body() dto: CreateVendorInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procurement.createVendorInvoice(dto, user.id);
  }

  @Get('vendor-invoices/:id')
  @ApiOperation({ summary: 'Get one vendor invoice, including its lines' })
  @RequirePermissions('procurement.view')
  findVendorInvoice(@Param('id') id: string) {
    return this.procurement.findVendorInvoice(id);
  }

  // ---- Three-Way Match ----

  @Post('three-way-match')
  @ApiOperation({
    summary: 'Match a purchase order, its goods receipt, and its vendor invoice',
    description:
      'Compares invoiced quantity/value against received quantity/value and marks the match MATCHED or MATCHED_WITH_VARIANCE depending on whether both are within tolerance. Does not itself post anything to AP — see POST /procurement/three-way-match/:id/complete for that.',
  })
  @RequirePermissions('procurement.match')
  createThreeWayMatch(@Body() dto: CreateThreeWayMatchDto) {
    return this.procurement.createThreeWayMatch(dto);
  }

  @Get('three-way-match/:id')
  @ApiOperation({ summary: 'Get one three-way match, including the PO/GRN/invoice it compares' })
  @RequirePermissions('procurement.view')
  findThreeWayMatch(@Param('id') id: string) {
    return this.procurement.findThreeWayMatch(id);
  }

  @Post('three-way-match/:id/complete')
  @ApiOperation({
    summary: 'Complete a three-way match by posting its AP voucher',
    description:
      'Debits the GR/IR clearing account the matched GRN accrued to and credits the AP control account. Invoice lines with no purchaseOrderLineId (e.g. freight billed with no prior GRN accrual) are debited directly to their own account instead, since there is no GR/IR entry to clear for them. Fails if the vendor invoice has already been posted.',
  })
  @RequirePermissions('procurement.match')
  completeThreeWayMatch(
    @Param('id') id: string,
    @Body() dto: CompleteThreeWayMatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procurement.completeThreeWayMatch(id, dto, user.id);
  }
}
