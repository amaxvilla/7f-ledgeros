import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentBatchStatus,
  PaymentVoucherStatus,
  TaxRemittanceStatus,
  VendorInvoiceStatus,
  VendorLedgerEntryType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { CreateAPInvoiceDto } from './dto/create-ap-invoice.dto';
import { PostAPInvoiceDto } from './dto/post-ap-invoice.dto';
import { CreatePaymentBatchDto } from './dto/create-payment-batch.dto';
import { CreatePaymentVoucherDto } from './dto/create-payment-voucher.dto';
import { PostPaymentVoucherDto } from './dto/post-payment-voucher.dto';
import { RemitTaxDeductionDto } from './dto/remit-tax-deduction.dto';

const AMOUNT_TOLERANCE = 0.01;

@Injectable()
export class AccountsPayableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // DIRECT (NON-PO) AP INVOICES — reuses Procurement's VendorInvoice /
  // VendorInvoiceLine models. PO-backed invoices are created and posted
  // by ProcurementService instead, so each invoice has exactly one
  // posting path.
  // -------------------------------------------------------------------

  async createInvoice(dto: CreateAPInvoiceDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor || !vendor.isActive) throw new NotFoundException(`Vendor ${dto.vendorId} not found or inactive`);

    const existing = await this.prisma.vendorInvoice.findUnique({
      where: {
        entityId_vendorId_invoiceNumber: {
          entityId: dto.entityId,
          vendorId: dto.vendorId,
          invoiceNumber: dto.invoiceNumber,
        },
      },
    });
    if (existing) throw new ConflictException(`Invoice ${dto.invoiceNumber} already exists for this vendor`);

    return this.prisma.vendorInvoice.create({
      data: {
        entityId: dto.entityId,
        invoiceNumber: dto.invoiceNumber,
        vendorId: dto.vendorId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: VendorInvoiceStatus.DRAFT,
        createdById: userId,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            accountId: line.accountId,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async findInvoice(id: string, scope: SecurityScope) {
    const invoice = await this.prisma.vendorInvoice.findUnique({
      where: { id },
      include: { lines: true, paymentAllocations: true },
    });
    if (!invoice) throw new NotFoundException(`Vendor invoice ${id} not found`);
    if (!this.rowLevelSecurity.canAccess(scope, { entityId: invoice.entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Vendor invoice ${id} not found`);
    }
    return invoice;
  }

  listInvoices(scope: SecurityScope, filters: { entityId?: string; vendorId?: string; status?: VendorInvoiceStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.vendorInvoice.findMany({
      where: { AND: [rls, { entityId: filters.entityId, vendorId: filters.vendorId, status: filters.status }] },
      include: { lines: true },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  /** Posts Dr <line accounts> / Cr AP control for a non-PO invoice. */
  async postInvoice(id: string, dto: PostAPInvoiceDto, userId: string) {
    const invoice = await this.prisma.vendorInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!invoice) throw new NotFoundException(`Vendor invoice ${id} not found`);
    if (invoice.purchaseOrderId) {
      throw new BadRequestException(
        'PO-backed invoices post through Procurement (three-way match), not the AP direct-posting endpoint',
      );
    }
    if (invoice.status !== VendorInvoiceStatus.DRAFT) {
      throw new ConflictException(`Cannot post an invoice with status ${invoice.status}`);
    }

    let total = 0;
    const journalLines = invoice.lines.map((line) => {
      const value = Number(line.quantity) * Number(line.unitCost);
      total += value;
      return { accountId: line.accountId, debit: value, credit: 0, vendorId: invoice.vendorId };
    });
    journalLines.push({ accountId: dto.apControlAccountId, debit: 0, credit: total, vendorId: invoice.vendorId });

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: invoice.entityId,
        entryDate: invoice.invoiceDate.toISOString(),
        description: `AP invoice ${invoice.invoiceNumber} — ${invoice.vendorId}`,
        sourceType: 'ACCOUNTS_PAYABLE',
        sourceReference: invoice.id,
        lines: journalLines,
      } as never,
      userId,
    );

    await this.prisma.vendorInvoice.update({
      where: { id },
      data: { status: VendorInvoiceStatus.POSTED, postedAt: new Date() },
    });

    await this.prisma.vendorLedger.create({
      data: {
        entityId: invoice.entityId,
        vendorId: invoice.vendorId,
        transactionDate: invoice.invoiceDate,
        entryType: VendorLedgerEntryType.INVOICE,
        debit: 0,
        credit: total,
        description: `Invoice ${invoice.invoiceNumber}`,
        referenceType: 'VendorInvoice',
        referenceId: invoice.id,
        journalEntryId: (posted as { id: string }).id,
      },
    });

    return { invoiceId: invoice.id, journalEntry: posted };
  }

  // -------------------------------------------------------------------
  // PAYMENT BATCHES
  // -------------------------------------------------------------------

  async createPaymentBatch(dto: CreatePaymentBatchDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const existing = await this.prisma.paymentBatch.findUnique({
      where: { entityId_batchNumber: { entityId: dto.entityId, batchNumber: dto.batchNumber } },
    });
    if (existing) throw new ConflictException(`Batch ${dto.batchNumber} already exists for this entity`);

    return this.prisma.paymentBatch.create({
      data: {
        entityId: dto.entityId,
        batchNumber: dto.batchNumber,
        paymentDate: new Date(dto.paymentDate),
        status: PaymentBatchStatus.DRAFT,
        createdById: userId,
      },
    });
  }

  async approvePaymentBatch(id: string, userId: string) {
    const batch = await this.getBatchOrThrow(id);
    if (batch.status !== PaymentBatchStatus.DRAFT) {
      throw new ConflictException(`Cannot approve a batch with status ${batch.status}`);
    }
    if (batch.createdById === userId) {
      throw new BadRequestException('The preparer of a payment batch cannot also approve it');
    }
    return this.prisma.paymentBatch.update({
      where: { id },
      data: { status: PaymentBatchStatus.APPROVED, approvedById: userId, approvedAt: new Date() },
    });
  }

  /** Posts every APPROVED voucher in an APPROVED batch, then closes it. */
  async processPaymentBatch(id: string, dto: PostPaymentVoucherDto, userId: string) {
    const batch = await this.prisma.paymentBatch.findUnique({ where: { id }, include: { vouchers: true } });
    if (!batch) throw new NotFoundException(`Payment batch ${id} not found`);
    if (batch.status !== PaymentBatchStatus.APPROVED) {
      throw new ConflictException(`Cannot process a batch with status ${batch.status}`);
    }

    const results = [];
    for (const voucher of batch.vouchers) {
      if (voucher.status === PaymentVoucherStatus.APPROVED) {
        results.push(await this.postPaymentVoucher(voucher.id, dto, userId));
      }
    }

    await this.prisma.paymentBatch.update({
      where: { id },
      data: { status: PaymentBatchStatus.PROCESSED, processedAt: new Date() },
    });

    return { batchId: id, postedVouchers: results.length };
  }

  // -------------------------------------------------------------------
  // PAYMENT VOUCHERS
  // -------------------------------------------------------------------

  async createPaymentVoucher(dto: CreatePaymentVoucherDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const invoices = await this.prisma.vendorInvoice.findMany({
      where: { id: { in: dto.allocations.map((a) => a.vendorInvoiceId) } },
    });
    const invoiceById = new Map(invoices.map((i) => [i.id, i]));

    for (const allocation of dto.allocations) {
      const invoice = invoiceById.get(allocation.vendorInvoiceId);
      if (!invoice) throw new NotFoundException(`Vendor invoice ${allocation.vendorInvoiceId} not found`);
      if (invoice.vendorId !== dto.vendorId) {
        throw new BadRequestException(`Invoice ${invoice.invoiceNumber} does not belong to vendor ${dto.vendorId}`);
      }
      if (invoice.status !== VendorInvoiceStatus.POSTED) {
        throw new ConflictException(`Invoice ${invoice.invoiceNumber} is not posted and cannot be paid yet`);
      }
      const invoiceTotal = await this.getInvoiceTotal(invoice.id);
      const openBalance = invoiceTotal - Number(invoice.amountPaid);
      if (allocation.amountAllocated > openBalance + AMOUNT_TOLERANCE) {
        throw new BadRequestException(
          `Cannot allocate ${allocation.amountAllocated} to invoice ${invoice.invoiceNumber}: only ${openBalance} remains open`,
        );
      }
    }

    const existing = await this.prisma.paymentVoucher.findUnique({
      where: { entityId_voucherNumber: { entityId: dto.entityId, voucherNumber: dto.voucherNumber } },
    });
    if (existing) throw new ConflictException(`Voucher ${dto.voucherNumber} already exists for this entity`);

    // Release (Tax Center Core follow-up, additive). Resolve any
    // whtTaxCodeId/vatTaxCodeId to a rate + authority account up front.
    // Allocations that instead supply whtRate/whtTaxAuthorityAccountId
    // directly (the pre-existing path) are untouched below.
    const taxCodeIds = [
      ...new Set(dto.allocations.flatMap((a) => [a.whtTaxCodeId, a.vatTaxCodeId].filter((id): id is string => !!id))),
    ];
    const taxCodeById = new Map(
      taxCodeIds.length
        ? (await this.prisma.taxCode.findMany({ where: { id: { in: taxCodeIds } } })).map((tc) => [tc.id, tc])
        : [],
    );
    for (const id of taxCodeIds) {
      if (!taxCodeById.has(id)) throw new NotFoundException(`Tax code ${id} not found`);
    }
    const resolveWht = (a: (typeof dto.allocations)[number]) =>
      a.whtTaxCodeId
        ? { rate: Number(taxCodeById.get(a.whtTaxCodeId)!.rate), authorityAccountId: taxCodeById.get(a.whtTaxCodeId)!.taxAuthorityAccountId }
        : a.whtRate && a.whtTaxAuthorityAccountId
          ? { rate: a.whtRate, authorityAccountId: a.whtTaxAuthorityAccountId }
          : null;
    const resolveVat = (a: (typeof dto.allocations)[number]) =>
      a.vatTaxCodeId
        ? { rate: Number(taxCodeById.get(a.vatTaxCodeId)!.rate), authorityAccountId: taxCodeById.get(a.vatTaxCodeId)!.taxAuthorityAccountId }
        : a.vatRate && a.vatTaxAuthorityAccountId
          ? { rate: a.vatRate, authorityAccountId: a.vatTaxAuthorityAccountId }
          : null;

    return this.prisma.paymentVoucher.create({
      data: {
        entityId: dto.entityId,
        voucherNumber: dto.voucherNumber,
        vendorId: dto.vendorId,
        batchId: dto.batchId,
        paymentDate: new Date(dto.paymentDate),
        paymentMethod: dto.paymentMethod,
        bankAccountId: dto.bankAccountId,
        status: PaymentVoucherStatus.DRAFT,
        createdById: userId,
        allocations: {
          create: dto.allocations.map((a) => {
            const wht = resolveWht(a);
            const vat = resolveVat(a);
            return {
              vendorInvoiceId: a.vendorInvoiceId,
              amountAllocated: a.amountAllocated,
              whtDeduction: wht
                ? {
                    create: {
                      entityId: dto.entityId,
                      rate: wht.rate,
                      amount: a.amountAllocated * wht.rate,
                      taxAuthorityAccountId: wht.authorityAccountId,
                    },
                  }
                : undefined,
              vatDeduction: vat
                ? {
                    create: {
                      entityId: dto.entityId,
                      rate: vat.rate,
                      amount: a.amountAllocated * vat.rate,
                      taxAuthorityAccountId: vat.authorityAccountId,
                    },
                  }
                : undefined,
            };
          }),
        },
      },
      include: { allocations: { include: { whtDeduction: true, vatDeduction: true } } },
    });
  }

  async findPaymentVoucher(id: string) {
    const voucher = await this.prisma.paymentVoucher.findUnique({
      where: { id },
      include: { allocations: { include: { whtDeduction: true, vatDeduction: true, vendorInvoice: true } } },
    });
    if (!voucher) throw new NotFoundException(`Payment voucher ${id} not found`);
    return voucher;
  }

  async approvePaymentVoucher(id: string, userId: string) {
    const voucher = await this.getVoucherOrThrow(id);
    if (voucher.status !== PaymentVoucherStatus.DRAFT) {
      throw new ConflictException(`Cannot approve a voucher with status ${voucher.status}`);
    }
    if (voucher.createdById === userId) {
      throw new BadRequestException('The preparer of a payment voucher cannot also approve it');
    }
    return this.prisma.paymentVoucher.update({
      where: { id },
      data: { status: PaymentVoucherStatus.APPROVED, approvedById: userId, approvedAt: new Date() },
    });
  }

  /**
   * Posts: Dr AP control (gross allocated) / Cr Cash (net of WHT+VAT) /
   * Cr WHT payable / Cr VAT payable (grouped by tax authority account,
   * since different allocations may use different accounts). Updates
   * VendorInvoice.amountPaid and writes one VendorLedger PAYMENT entry.
   */
  async postPaymentVoucher(id: string, dto: PostPaymentVoucherDto, userId: string) {
    const voucher = await this.prisma.paymentVoucher.findUnique({
      where: { id },
      include: { allocations: { include: { whtDeduction: true, vatDeduction: true, vendorInvoice: true } } },
    });
    if (!voucher) throw new NotFoundException(`Payment voucher ${id} not found`);
    if (voucher.status !== PaymentVoucherStatus.APPROVED) {
      throw new ConflictException(`Cannot post a voucher with status ${voucher.status}`);
    }

    let totalGross = 0;
    let totalNetCash = 0;
    const taxCredits = new Map<string, number>(); // taxAuthorityAccountId -> amount

    for (const allocation of voucher.allocations) {
      const gross = Number(allocation.amountAllocated);
      const wht = allocation.whtDeduction ? Number(allocation.whtDeduction.amount) : 0;
      const vat = allocation.vatDeduction ? Number(allocation.vatDeduction.amount) : 0;
      totalGross += gross;
      totalNetCash += gross - wht - vat;
      if (allocation.whtDeduction) {
        taxCredits.set(
          allocation.whtDeduction.taxAuthorityAccountId,
          (taxCredits.get(allocation.whtDeduction.taxAuthorityAccountId) ?? 0) + wht,
        );
      }
      if (allocation.vatDeduction) {
        taxCredits.set(
          allocation.vatDeduction.taxAuthorityAccountId,
          (taxCredits.get(allocation.vatDeduction.taxAuthorityAccountId) ?? 0) + vat,
        );
      }
    }

    const journalLines = [
      { accountId: dto.apControlAccountId, debit: totalGross, credit: 0, vendorId: voucher.vendorId },
      { accountId: dto.cashGlAccountId, debit: 0, credit: totalNetCash, vendorId: voucher.vendorId },
      ...Array.from(taxCredits.entries()).map(([accountId, amount]) => ({
        accountId,
        debit: 0,
        credit: amount,
        vendorId: voucher.vendorId,
      })),
    ];

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: voucher.entityId,
        entryDate: voucher.paymentDate.toISOString(),
        description: `Payment voucher ${voucher.voucherNumber}`,
        sourceType: 'ACCOUNTS_PAYABLE',
        sourceReference: voucher.id,
        lines: journalLines,
      } as never,
      userId,
    );

    for (const allocation of voucher.allocations) {
      await this.prisma.vendorInvoice.update({
        where: { id: allocation.vendorInvoiceId },
        data: { amountPaid: { increment: allocation.amountAllocated } },
      });
    }

    await this.prisma.vendorLedger.create({
      data: {
        entityId: voucher.entityId,
        vendorId: voucher.vendorId,
        transactionDate: voucher.paymentDate,
        entryType: VendorLedgerEntryType.PAYMENT,
        debit: totalGross,
        credit: 0,
        description: `Payment voucher ${voucher.voucherNumber}`,
        referenceType: 'PaymentVoucher',
        referenceId: voucher.id,
        journalEntryId: (posted as { id: string }).id,
      },
    });

    await this.prisma.paymentVoucher.update({
      where: { id },
      data: { status: PaymentVoucherStatus.POSTED, postedAt: new Date() },
    });

    return { voucherId: id, journalEntry: posted, totalGross, totalNetCash };
  }

  // -------------------------------------------------------------------
  // WHT / VAT REMITTANCE
  // -------------------------------------------------------------------

  async remitWHT(id: string, dto: RemitTaxDeductionDto, userId: string) {
    const deduction = await this.prisma.wHTDeduction.findUnique({ where: { id } });
    if (!deduction) throw new NotFoundException(`WHT deduction ${id} not found`);
    if (deduction.status !== TaxRemittanceStatus.PENDING) throw new ConflictException('Already remitted');

    await this.postingEngine.postSystemEntry(
      {
        entityId: deduction.entityId,
        entryDate: new Date().toISOString(),
        description: `WHT remittance ${id}`,
        sourceType: 'ACCOUNTS_PAYABLE',
        sourceReference: id,
        lines: [
          { accountId: deduction.taxAuthorityAccountId, debit: Number(deduction.amount), credit: 0 },
          { accountId: dto.cashGlAccountId, debit: 0, credit: Number(deduction.amount) },
        ],
      } as never,
      userId,
    );

    return this.prisma.wHTDeduction.update({ where: { id }, data: { status: TaxRemittanceStatus.REMITTED, remittedAt: new Date() } });
  }

  async remitVAT(id: string, dto: RemitTaxDeductionDto, userId: string) {
    const deduction = await this.prisma.vATDeduction.findUnique({ where: { id } });
    if (!deduction) throw new NotFoundException(`VAT deduction ${id} not found`);
    if (deduction.status !== TaxRemittanceStatus.PENDING) throw new ConflictException('Already remitted');

    await this.postingEngine.postSystemEntry(
      {
        entityId: deduction.entityId,
        entryDate: new Date().toISOString(),
        description: `VAT remittance ${id}`,
        sourceType: 'ACCOUNTS_PAYABLE',
        sourceReference: id,
        lines: [
          { accountId: deduction.taxAuthorityAccountId, debit: Number(deduction.amount), credit: 0 },
          { accountId: dto.cashGlAccountId, debit: 0, credit: Number(deduction.amount) },
        ],
      } as never,
      userId,
    );

    return this.prisma.vATDeduction.update({ where: { id }, data: { status: TaxRemittanceStatus.REMITTED, remittedAt: new Date() } });
  }

  // -------------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------------

  /** Open (POSTED, unpaid-balance > 0) invoices bucketed by days past due. */
  async getVendorAging(entityId: string, asOfDate?: string) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const invoices = await this.prisma.vendorInvoice.findMany({
      where: { entityId, status: VendorInvoiceStatus.POSTED },
      include: { lines: true, vendor: true },
    });

    const buckets = invoices
      .map((inv) => {
        const total = inv.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);
        const open = total - Number(inv.amountPaid);
        if (open <= AMOUNT_TOLERANCE) return null;
        const daysPastDue = inv.dueDate ? Math.floor((asOf.getTime() - inv.dueDate.getTime()) / 86_400_000) : 0;
        const bucket =
          daysPastDue <= 0 ? 'current' : daysPastDue <= 30 ? '1-30' : daysPastDue <= 60 ? '31-60' : daysPastDue <= 90 ? '61-90' : '90+';
        return {
          vendorId: inv.vendorId,
          vendorName: inv.vendor.name,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          dueDate: inv.dueDate,
          openBalance: open,
          daysPastDue,
          bucket,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return buckets;
  }

  async getDuePayments(entityId: string, throughDate?: string) {
    const through = throughDate ? new Date(throughDate) : new Date();
    const invoices = await this.prisma.vendorInvoice.findMany({
      where: { entityId, status: VendorInvoiceStatus.POSTED, dueDate: { lte: through } },
      include: { lines: true, vendor: true },
    });
    return invoices
      .map((inv) => {
        const total = inv.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);
        const open = total - Number(inv.amountPaid);
        return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, vendorName: inv.vendor.name, dueDate: inv.dueDate, openBalance: open };
      })
      .filter((x) => x.openBalance > AMOUNT_TOLERANCE);
  }

  /** Cash needed to clear everything due within `days` days of today. */
  async getCashRequirementForecast(entityId: string, days: number) {
    const horizon = new Date(Date.now() + days * 86_400_000);
    const due = await this.getDuePayments(entityId, horizon.toISOString());
    const total = due.reduce((sum, d) => sum + d.openBalance, 0);
    return { entityId, horizonDays: days, totalDue: total, invoiceCount: due.length, invoices: due };
  }

  async getWHTSchedule(entityId: string, status?: TaxRemittanceStatus) {
    return this.prisma.wHTDeduction.findMany({
      where: { entityId, status },
      include: { paymentVoucherAllocation: { include: { paymentVoucher: true, vendorInvoice: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVATSchedule(entityId: string, status?: TaxRemittanceStatus) {
    return this.prisma.vATDeduction.findMany({
      where: { entityId, status },
      include: { paymentVoucherAllocation: { include: { paymentVoucher: true, vendorInvoice: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVendorStatement(entityId: string, vendorId: string, from?: string, to?: string) {
    const entries = await this.prisma.vendorLedger.findMany({
      where: {
        entityId,
        vendorId,
        transactionDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      orderBy: { transactionDate: 'asc' },
    });

    let runningBalance = 0;
    return entries.map((entry) => {
      runningBalance += Number(entry.credit) - Number(entry.debit);
      return { ...entry, runningBalance };
    });
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async getInvoiceTotal(invoiceId: string): Promise<number> {
    const lines = await this.prisma.vendorInvoiceLine.findMany({ where: { vendorInvoiceId: invoiceId } });
    return lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);
  }

  private async getBatchOrThrow(id: string) {
    const batch = await this.prisma.paymentBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException(`Payment batch ${id} not found`);
    return batch;
  }

  private async getVoucherOrThrow(id: string) {
    const voucher = await this.prisma.paymentVoucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException(`Payment voucher ${id} not found`);
    return voucher;
  }
}
