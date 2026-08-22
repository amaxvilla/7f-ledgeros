import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaxRemittanceStatus, VendorInvoiceStatus } from '@prisma/client';
import { AccountsPayableService } from './accounts-payable.service';
import { CreateAPInvoiceDto } from './dto/create-ap-invoice.dto';
import { PostAPInvoiceDto } from './dto/post-ap-invoice.dto';
import { CreatePaymentBatchDto } from './dto/create-payment-batch.dto';
import { BulkImportPaymentBatchDto } from './dto/bulk-import-payment-batch.dto';
import { CreatePaymentVoucherDto } from './dto/create-payment-voucher.dto';
import { PostPaymentVoucherDto } from './dto/post-payment-voucher.dto';
import { RemitTaxDeductionDto } from './dto/remit-tax-deduction.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('accounts-payable')
@ApiBearerAuth()
@Controller('ap')
export class AccountsPayableController {
  constructor(
    private readonly ap: AccountsPayableService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Invoices ----

  @Post('invoices')
  @ApiOperation({ summary: 'Create a vendor invoice (DRAFT)' })
  @RequirePermissions('ap.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createInvoice(@Body() dto: CreateAPInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.createInvoice(dto, user.id);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List vendor invoices, optionally filtered by entity, vendor, or status' })
  @RequirePermissions('ap.view')
  async listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: VendorInvoiceStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.ap.listInvoices(scope, { entityId, vendorId, status });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get a single vendor invoice by id' })
  @RequirePermissions('ap.view')
  async findInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.ap.findInvoice(id, scope);
  }

  @Post('invoices/:id/post')
  @ApiOperation({
    summary: 'Post a DRAFT, non-PO vendor invoice to the GL',
    description:
      'Only invoices with no purchaseOrderId can post here — a PO-backed invoice must post through Procurement\'s own three-way match instead. Only DRAFT invoices are postable. Debits each line\'s own account for quantity times unit cost, credits the supplied AP control account for the total, and writes a matching VendorLedger INVOICE entry.',
  })
  @RequirePermissions('ap.manage')
  postInvoice(@Param('id') id: string, @Body() dto: PostAPInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.postInvoice(id, dto, user.id);
  }

  // ---- Payment Batches ----

  @Post('payment-batches')
  @ApiOperation({ summary: 'Create a DRAFT payment batch for a given entity and batch number' })
  @RequirePermissions('ap.manage')
  createPaymentBatch(@Body() dto: CreatePaymentBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.createPaymentBatch(dto, user.id);
  }

  @Post('payment-batches/bulk-import')
  @ApiOperation({ summary: 'Bulk import a payment batch with its vouchers', description: 'Creates the batch and all constituent vouchers atomically.' })
  @RequirePermissions('ap.payment.create')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  bulkImportPaymentBatch(@Body() dto: BulkImportPaymentBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.bulkImportPaymentBatch(dto, user.id);
  }

  @Post('payment-batches/:id/approve')
  @ApiOperation({
    summary: 'Approve a DRAFT payment batch',
    description: 'The preparer who created the batch cannot also approve it — segregation of duties, enforced server-side.',
  })
  @RequirePermissions('ap.approve')
  approvePaymentBatch(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.approvePaymentBatch(id, user.id);
  }

  @Post('payment-batches/:id/process')
  @ApiOperation({
    summary: 'Post every APPROVED voucher in an APPROVED batch, then close the batch',
    description:
      'Iterates every voucher currently in the batch; only vouchers already at APPROVED status are posted (others are silently skipped, not rejected). Sets the batch itself to PROCESSED once done.',
  })
  @RequirePermissions('ap.pay')
  processPaymentBatch(
    @Param('id') id: string,
    @Body() dto: PostPaymentVoucherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ap.processPaymentBatch(id, dto, user.id);
  }

  // ---- Payment Vouchers ----

  @Post('payment-vouchers')
  @ApiOperation({
    summary: 'Create a DRAFT payment voucher allocating a payment across one or more posted vendor invoices',
    description:
      'Every allocation\'s target invoice must belong to the same vendor and already be POSTED, and the allocated amount cannot exceed that invoice\'s own open balance (its total less amountPaid, with a small rounding tolerance). WHT/VAT for each allocation can be supplied either as a taxCodeId (resolved to a rate and authority account server-side) or as an explicit rate plus authority account directly.',
  })
  @RequirePermissions('ap.manage')
  createPaymentVoucher(@Body() dto: CreatePaymentVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.createPaymentVoucher(dto, user.id);
  }

  @Get('payment-vouchers/:id')
  @ApiOperation({ summary: 'Get a single payment voucher, with its allocations and any WHT/VAT deductions' })
  @RequirePermissions('ap.view')
  findPaymentVoucher(@Param('id') id: string) {
    return this.ap.findPaymentVoucher(id);
  }

  @Post('payment-vouchers/:id/approve')
  @ApiOperation({
    summary: 'Approve a DRAFT payment voucher',
    description: 'The preparer who created the voucher cannot also approve it — segregation of duties, enforced server-side.',
  })
  @RequirePermissions('ap.approve')
  approvePaymentVoucher(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.approvePaymentVoucher(id, user.id);
  }

  @Post('payment-vouchers/:id/post')
  @ApiOperation({
    summary: 'Post an APPROVED payment voucher to the GL and apply it against its allocated invoices',
    description:
      'Posts Dr AP control (gross allocated) / Cr Cash (net of WHT+VAT) / Cr WHT payable / Cr VAT payable, the tax-payable lines grouped by tax authority account since different allocations may use different accounts. Increments amountPaid on every allocated invoice and writes one VendorLedger PAYMENT entry.',
  })
  @RequirePermissions('ap.pay')
  postPaymentVoucher(
    @Param('id') id: string,
    @Body() dto: PostPaymentVoucherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ap.postPaymentVoucher(id, dto, user.id);
  }

  // ---- WHT / VAT remittance ----

  @Post('wht-deductions/:id/remit')
  @ApiOperation({
    summary: 'Remit a PENDING WHT deduction to the tax authority',
    description: 'Posts Dr tax authority payable / Cr the supplied cash account, then marks the deduction REMITTED. Rejected if the deduction has already been remitted.',
  })
  @RequirePermissions('ap.pay')
  remitWHT(@Param('id') id: string, @Body() dto: RemitTaxDeductionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.remitWHT(id, dto, user.id);
  }

  @Post('vat-deductions/:id/remit')
  @ApiOperation({
    summary: 'Remit a PENDING VAT deduction to the tax authority',
    description: 'Posts Dr tax authority payable / Cr the supplied cash account, then marks the deduction REMITTED. Rejected if the deduction has already been remitted.',
  })
  @RequirePermissions('ap.pay')
  remitVAT(@Param('id') id: string, @Body() dto: RemitTaxDeductionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ap.remitVAT(id, dto, user.id);
  }

  // ---- Reports ----

  @Get('reports/aging')
  @ApiOperation({
    summary: 'Vendor aging report: open posted invoices bucketed by days past due',
    description: 'Buckets are current, 1-30, 31-60, 61-90, 90+, computed from each invoice\'s own due date against asOfDate (defaults to today).',
  })
  @RequirePermissions('ap.view')
  getVendorAging(@Query('entityId') entityId: string, @Query('asOfDate') asOfDate?: string) {
    return this.ap.getVendorAging(entityId, asOfDate);
  }

  @Get('reports/due-payments')
  @ApiOperation({ summary: 'List open posted invoices due on or before throughDate (defaults to today)' })
  @RequirePermissions('ap.view')
  getDuePayments(@Query('entityId') entityId: string, @Query('throughDate') throughDate?: string) {
    return this.ap.getDuePayments(entityId, throughDate);
  }

  @Get('reports/cash-requirement')
  @ApiOperation({ summary: 'Forecast total cash required to clear every invoice due within the next N days (default 30)' })
  @RequirePermissions('ap.view')
  getCashRequirementForecast(@Query('entityId') entityId: string, @Query('days') days?: string) {
    return this.ap.getCashRequirementForecast(entityId, days ? Number(days) : 30);
  }

  @Get('reports/wht-schedule')
  @ApiOperation({ summary: 'List WHT deductions for an entity, optionally filtered by remittance status' })
  @RequirePermissions('ap.view')
  getWHTSchedule(@Query('entityId') entityId: string, @Query('status') status?: TaxRemittanceStatus) {
    return this.ap.getWHTSchedule(entityId, status);
  }

  @Get('reports/vat-schedule')
  @ApiOperation({ summary: 'List VAT deductions for an entity, optionally filtered by remittance status' })
  @RequirePermissions('ap.view')
  getVATSchedule(@Query('entityId') entityId: string, @Query('status') status?: TaxRemittanceStatus) {
    return this.ap.getVATSchedule(entityId, status);
  }

  @Get('reports/vendor-statement')
  @ApiOperation({
    summary: 'Vendor statement: every ledger entry for a vendor within an optional date range, with a running balance',
    description: 'Running balance accumulates as credit minus debit per entry, in transactionDate order.',
  })
  @RequirePermissions('ap.view')
  getVendorStatement(
    @Query('entityId') entityId: string,
    @Query('vendorId') vendorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ap.getVendorStatement(entityId, vendorId, from, to);
  }
}
