import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ARInvoiceStatus } from '@prisma/client';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CreateARInvoiceDto } from './dto/create-ar-invoice.dto';
import { PostARInvoiceDto } from './dto/post-ar-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { PostReceiptDto } from './dto/post-receipt.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('accounts-receivable')
@ApiBearerAuth()
@Controller('ar')
export class AccountsReceivableController {
  constructor(
    private readonly ar: AccountsReceivableService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Invoices ----

  @Post('invoices')
  @ApiOperation({
    summary: 'Create an AR invoice (DRAFT)',
    description: 'Each line\'s VAT (rate, amount, authority account) is resolved server-side from its own vatTaxCodeId, if supplied — not asked for directly.',
  })
  @RequirePermissions('ar.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createInvoice(@Body() dto: CreateARInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ar.createInvoice(dto, user.id);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List AR invoices, optionally filtered by entity, customer, or status' })
  @RequirePermissions('ar.view')
  async listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: ARInvoiceStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.ar.listInvoices(scope, { entityId, customerId, status });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get a single AR invoice by id' })
  @RequirePermissions('ar.view')
  async findInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.ar.findInvoice(id, scope);
  }

  @Post('invoices/:id/post')
  @ApiOperation({
    summary: 'Post a DRAFT AR invoice to the GL',
    description:
      'Posts Dr AR control (gross, including any output VAT) / Cr each line\'s own revenue account (ex-VAT) / Cr the relevant VAT authority account for any line with output VAT — only lines created with a vatTaxCodeId contribute a VAT credit. Writes a matching CustomerLedger INVOICE entry. Only DRAFT invoices are postable.',
  })
  @RequirePermissions('ar.manage')
  postInvoice(@Param('id') id: string, @Body() dto: PostARInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ar.postInvoice(id, dto, user.id);
  }

  // ---- Receipts ----

  @Post('receipts')
  @ApiOperation({
    summary: 'Create a DRAFT receipt allocating a payment across one or more posted AR invoices',
    description:
      'Every allocation\'s target invoice must belong to the same customer and already be POSTED, and the allocated amount cannot exceed that invoice\'s own open balance (its VAT-inclusive total less amountReceived, with a small rounding tolerance). Unlike AP payment vouchers, a receipt has no separate approval step — it goes straight from DRAFT to posting.',
  })
  @RequirePermissions('ar.manage')
  createReceipt(@Body() dto: CreateReceiptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ar.createReceipt(dto, user.id);
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get a single receipt, with its invoice allocations' })
  @RequirePermissions('ar.view')
  findReceipt(@Param('id') id: string) {
    return this.ar.findReceipt(id);
  }

  @Post('receipts/:id/post')
  @ApiOperation({
    summary: 'Post a DRAFT receipt to the GL and apply it against its allocated invoices',
    description:
      'Posts Dr Cash / Cr AR control for the receipt\'s total allocated amount. Increments amountReceived on every allocated invoice and writes one CustomerLedger RECEIPT entry.',
  })
  @RequirePermissions('ar.manage')
  postReceipt(@Param('id') id: string, @Body() dto: PostReceiptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ar.postReceipt(id, dto, user.id);
  }

  // ---- Reports ----

  @Get('reports/aging')
  @ApiOperation({
    summary: 'AR aging report: open posted invoices bucketed by days past due',
    description: 'Buckets are current, 1-30, 31-60, 61-90, 90+, computed from each invoice\'s own due date against asOfDate (defaults to today).',
  })
  @RequirePermissions('ar.view')
  getAging(@Query('entityId') entityId: string, @Query('asOfDate') asOfDate?: string) {
    return this.ar.getAging(entityId, asOfDate);
  }

  @Get('reports/collections-by-project')
  @ApiOperation({
    summary: 'Posted revenue (invoiced) and receipts grouped by project, for an optional date range',
    description:
      'Invoice lines with no projectId roll up under "Unassigned". Each invoice\'s own total receipts are apportioned across its lines pro-rata by line value — there is no per-line receipt allocation in the underlying data, so this is an estimate, not a directly-recorded figure.',
  })
  @RequirePermissions('ar.view')
  getCollectionsByProject(@Query('entityId') entityId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ar.getCollectionsByProject(entityId, from, to);
  }

  @Get('reports/overdue-installments')
  @ApiOperation({
    summary: 'Overdue Real Estate mortgage installment lines, for AR-side visibility',
    description:
      'Reads InstallmentLine (Real Estate mortgage schedules), not ARInvoice — a genuinely different model, surfaced here so AR staff can see customer-facing overdue amounts that never went through an AR invoice at all.',
  })
  @RequirePermissions('ar.view')
  getOverdueInstallments(@Query('entityId') entityId: string, @Query('asOfDate') asOfDate?: string) {
    return this.ar.getOverdueInstallments(entityId, asOfDate);
  }

  @Get('reports/customer-statement')
  @ApiOperation({
    summary: 'Customer statement: every ledger entry for a customer within an optional date range, with a running balance',
    description: 'Running balance accumulates as debit minus credit per entry, in transactionDate order.',
  })
  @RequirePermissions('ar.view')
  getCustomerStatement(
    @Query('entityId') entityId: string,
    @Query('customerId') customerId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ar.getCustomerStatement(entityId, customerId, from, to);
  }
}
