import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ARInvoiceStatus, CustomerLedgerEntryType, ReceiptStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { CreateARInvoiceDto } from './dto/create-ar-invoice.dto';
import { PostARInvoiceDto } from './dto/post-ar-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { PostReceiptDto } from './dto/post-receipt.dto';

const AMOUNT_TOLERANCE = 0.01;

@Injectable()
export class AccountsReceivableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // AR INVOICES
  // -------------------------------------------------------------------

  /**
   * Release L — Output VAT on AR Invoices. Resolves each line's optional
   * vatTaxCodeId to a snapshot { vatRate, vatAmount, vatAuthorityAccountId }
   * at invoice-creation time — see ARInvoiceLine's schema doc comment for
   * why this isn't a live TaxCode lookup. Rejects an unknown id and a
   * TaxCode whose taxType isn't VAT (e.g. someone passing a WHT code by
   * mistake) rather than silently accepting it.
   */
  private async resolveVatForLines(lines: CreateARInvoiceDto['lines']) {
    const taxCodeIds = [...new Set(lines.map((l) => l.vatTaxCodeId).filter((id): id is string => !!id))];
    const taxCodeById = new Map(
      taxCodeIds.length ? (await this.prisma.taxCode.findMany({ where: { id: { in: taxCodeIds } } })).map((tc) => [tc.id, tc]) : [],
    );
    return lines.map((line) => {
      if (!line.vatTaxCodeId) return { vatRate: null, vatAmount: null, vatAuthorityAccountId: null };
      const taxCode = taxCodeById.get(line.vatTaxCodeId);
      if (!taxCode) throw new NotFoundException(`Tax code ${line.vatTaxCodeId} not found`);
      if (taxCode.taxType !== 'VAT') {
        throw new BadRequestException(`Tax code ${taxCode.code} is not a VAT code (taxType=${taxCode.taxType})`);
      }
      const rate = Number(taxCode.rate);
      return {
        vatRate: rate,
        vatAmount: round2(line.quantity * line.unitPrice * rate),
        vatAuthorityAccountId: taxCode.taxAuthorityAccountId,
      };
    });
  }

  async createInvoice(dto: CreateARInvoiceDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || !customer.isActive) throw new NotFoundException(`Customer ${dto.customerId} not found or inactive`);

    const existing = await this.prisma.aRInvoice.findUnique({
      where: { entityId_invoiceNumber: { entityId: dto.entityId, invoiceNumber: dto.invoiceNumber } },
    });
    if (existing) throw new ConflictException(`Invoice ${dto.invoiceNumber} already exists for this entity`);

    const vatByLine = await this.resolveVatForLines(dto.lines);

    return this.prisma.aRInvoice.create({
      data: {
        entityId: dto.entityId,
        invoiceNumber: dto.invoiceNumber,
        customerId: dto.customerId,
        allocationId: dto.allocationId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: ARInvoiceStatus.DRAFT,
        createdById: userId,
        lines: {
          create: dto.lines.map((line, i) => ({
            description: line.description,
            accountId: line.accountId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            projectId: line.projectId,
            phaseId: line.phaseId,
            vatRate: vatByLine[i].vatRate ?? undefined,
            vatAmount: vatByLine[i].vatAmount ?? undefined,
            vatAuthorityAccountId: vatByLine[i].vatAuthorityAccountId ?? undefined,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async findInvoice(id: string, scope: SecurityScope) {
    const invoice = await this.prisma.aRInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!invoice) throw new NotFoundException(`AR invoice ${id} not found`);
    if (!this.rowLevelSecurity.canAccess(scope, { entityId: invoice.entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`AR invoice ${id} not found`);
    }
    return invoice;
  }

  listInvoices(scope: SecurityScope, filters: { entityId?: string; customerId?: string; status?: ARInvoiceStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.aRInvoice.findMany({
      where: { AND: [rls, { entityId: filters.entityId, customerId: filters.customerId, status: filters.status }] },
      include: { lines: true },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  /** Posts Dr AR control (incl. any VAT) / Cr <line accounts> (revenue, ex-VAT) / Cr <VAT authority account(s)>. */
  async postInvoice(id: string, dto: PostARInvoiceDto, userId: string) {
    const invoice = await this.prisma.aRInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!invoice) throw new NotFoundException(`AR invoice ${id} not found`);
    if (invoice.status !== ARInvoiceStatus.DRAFT) {
      throw new ConflictException(`Cannot post an invoice with status ${invoice.status}`);
    }

    let total = 0;
    const journalLines: { accountId: string; debit: number; credit: number; customerId: string; projectId?: string; phaseId?: string }[] = [];
    for (const line of invoice.lines) {
      const value = Number(line.quantity) * Number(line.unitPrice);
      total += value;
      journalLines.push({
        accountId: line.accountId,
        debit: 0,
        credit: value,
        customerId: invoice.customerId,
        projectId: line.projectId ?? undefined,
        phaseId: line.phaseId ?? undefined,
      });
      // Release L — Output VAT on AR Invoices (additive). Only present
      // when the line was created with a vatTaxCodeId; existing/
      // non-taxed lines have vatAmount=null and add nothing here.
      if (line.vatAmount != null && line.vatAuthorityAccountId) {
        const vat = Number(line.vatAmount);
        total += vat;
        journalLines.push({
          accountId: line.vatAuthorityAccountId,
          debit: 0,
          credit: vat,
          customerId: invoice.customerId,
        });
      }
    }
    journalLines.unshift({
      accountId: dto.arControlAccountId,
      debit: total,
      credit: 0,
      customerId: invoice.customerId,
    });

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: invoice.entityId,
        entryDate: invoice.invoiceDate.toISOString(),
        description: `AR invoice ${invoice.invoiceNumber}`,
        sourceType: 'ACCOUNTS_RECEIVABLE',
        sourceReference: invoice.id,
        lines: journalLines,
      } as never,
      userId,
    );

    await this.prisma.aRInvoice.update({ where: { id }, data: { status: ARInvoiceStatus.POSTED, postedAt: new Date() } });

    await this.prisma.customerLedger.create({
      data: {
        entityId: invoice.entityId,
        customerId: invoice.customerId,
        transactionDate: invoice.invoiceDate,
        entryType: CustomerLedgerEntryType.INVOICE,
        debit: total,
        credit: 0,
        description: `Invoice ${invoice.invoiceNumber}`,
        referenceType: 'ARInvoice',
        referenceId: invoice.id,
        journalEntryId: (posted as { id: string }).id,
      },
    });

    return { invoiceId: invoice.id, journalEntry: posted };
  }

  // -------------------------------------------------------------------
  // RECEIPTS
  // -------------------------------------------------------------------

  async createReceipt(dto: CreateReceiptDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const invoices = await this.prisma.aRInvoice.findMany({
      where: { id: { in: dto.allocations.map((a) => a.arInvoiceId) } },
      include: { lines: true },
    });
    const invoiceById = new Map(invoices.map((i) => [i.id, i]));

    for (const allocation of dto.allocations) {
      const invoice = invoiceById.get(allocation.arInvoiceId);
      if (!invoice) throw new NotFoundException(`AR invoice ${allocation.arInvoiceId} not found`);
      if (invoice.customerId !== dto.customerId) {
        throw new BadRequestException(`Invoice ${invoice.invoiceNumber} does not belong to customer ${dto.customerId}`);
      }
      if (invoice.status !== ARInvoiceStatus.POSTED) {
        throw new ConflictException(`Invoice ${invoice.invoiceNumber} is not posted and cannot receive a payment yet`);
      }
      const total = invoice.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice) + Number(l.vatAmount ?? 0), 0);
      const open = total - Number(invoice.amountReceived);
      if (allocation.amountAllocated > open + AMOUNT_TOLERANCE) {
        throw new BadRequestException(
          `Cannot allocate ${allocation.amountAllocated} to invoice ${invoice.invoiceNumber}: only ${open} remains open`,
        );
      }
    }

    const existing = await this.prisma.receipt.findUnique({
      where: { entityId_receiptNumber: { entityId: dto.entityId, receiptNumber: dto.receiptNumber } },
    });
    if (existing) throw new ConflictException(`Receipt ${dto.receiptNumber} already exists for this entity`);

    return this.prisma.receipt.create({
      data: {
        entityId: dto.entityId,
        receiptNumber: dto.receiptNumber,
        customerId: dto.customerId,
        receiptDate: new Date(dto.receiptDate),
        paymentMethod: dto.paymentMethod,
        bankAccountId: dto.bankAccountId,
        status: ReceiptStatus.DRAFT,
        createdById: userId,
        allocations: {
          create: dto.allocations.map((a) => ({ arInvoiceId: a.arInvoiceId, amountAllocated: a.amountAllocated })),
        },
      },
      include: { allocations: true },
    });
  }

  async findReceipt(id: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id }, include: { allocations: { include: { arInvoice: true } } } });
    if (!receipt) throw new NotFoundException(`Receipt ${id} not found`);
    return receipt;
  }

  /** Posts Dr Cash / Cr AR control for the receipt's total allocated amount. */
  async postReceipt(id: string, dto: PostReceiptDto, userId: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id }, include: { allocations: true } });
    if (!receipt) throw new NotFoundException(`Receipt ${id} not found`);
    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new ConflictException(`Cannot post a receipt with status ${receipt.status}`);
    }

    const total = receipt.allocations.reduce((sum, a) => sum + Number(a.amountAllocated), 0);

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: receipt.entityId,
        entryDate: receipt.receiptDate.toISOString(),
        description: `Receipt ${receipt.receiptNumber}`,
        sourceType: 'ACCOUNTS_RECEIVABLE',
        sourceReference: receipt.id,
        lines: [
          { accountId: dto.cashGlAccountId, debit: total, credit: 0, customerId: receipt.customerId },
          { accountId: dto.arControlAccountId, debit: 0, credit: total, customerId: receipt.customerId },
        ],
      } as never,
      userId,
    );

    for (const allocation of receipt.allocations) {
      await this.prisma.aRInvoice.update({
        where: { id: allocation.arInvoiceId },
        data: { amountReceived: { increment: allocation.amountAllocated } },
      });
    }

    await this.prisma.customerLedger.create({
      data: {
        entityId: receipt.entityId,
        customerId: receipt.customerId,
        transactionDate: receipt.receiptDate,
        entryType: CustomerLedgerEntryType.RECEIPT,
        debit: 0,
        credit: total,
        description: `Receipt ${receipt.receiptNumber}`,
        referenceType: 'Receipt',
        referenceId: receipt.id,
        journalEntryId: (posted as { id: string }).id,
      },
    });

    await this.prisma.receipt.update({ where: { id }, data: { status: ReceiptStatus.POSTED, postedAt: new Date() } });

    return { receiptId: id, journalEntry: posted, total };
  }

  // -------------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------------

  async getAging(entityId: string, asOfDate?: string) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const invoices = await this.prisma.aRInvoice.findMany({
      where: { entityId, status: ARInvoiceStatus.POSTED },
      include: { lines: true, customer: true },
    });

    return invoices
      .map((inv) => {
        const total = inv.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice) + Number(l.vatAmount ?? 0), 0);
        const open = total - Number(inv.amountReceived);
        if (open <= AMOUNT_TOLERANCE) return null;
        const daysPastDue = inv.dueDate ? Math.floor((asOf.getTime() - inv.dueDate.getTime()) / 86_400_000) : 0;
        const bucket =
          daysPastDue <= 0 ? 'current' : daysPastDue <= 30 ? '1-30' : daysPastDue <= 60 ? '31-60' : daysPastDue <= 90 ? '61-90' : '90+';
        return {
          customerId: inv.customerId,
          customerName: inv.customer.name,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          dueDate: inv.dueDate,
          openBalance: open,
          daysPastDue,
          bucket,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  /** Posted revenue (invoiced) grouped by project, for a date range. */
  async getCollectionsByProject(entityId: string, from?: string, to?: string) {
    const invoices = await this.prisma.aRInvoice.findMany({
      where: {
        entityId,
        status: ARInvoiceStatus.POSTED,
        invoiceDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      include: { lines: { include: { project: true } } },
    });

    const byProject = new Map<string, { projectId: string | null; projectName: string; invoiced: number; received: number }>();
    for (const inv of invoices) {
      const invoiceTotal = inv.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);
      for (const line of inv.lines) {
        const lineValue = Number(line.quantity) * Number(line.unitPrice);
        const key = line.projectId ?? 'unassigned';
        const existing = byProject.get(key) ?? {
          projectId: line.projectId,
          projectName: line.project?.name ?? 'Unassigned',
          invoiced: 0,
          received: 0,
        };
        existing.invoiced += lineValue;
        // Apportion this invoice's receipts across its lines pro-rata by value.
        const share = invoiceTotal > 0 ? lineValue / invoiceTotal : 0;
        existing.received += Number(inv.amountReceived) * share;
        byProject.set(key, existing);
      }
    }

    return Array.from(byProject.values());
  }

  /** Real Estate installment lines that are overdue, for AR-side visibility. */
  async getOverdueInstallments(entityId: string, asOfDate?: string) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const lines = await this.prisma.installmentLine.findMany({
      where: {
        dueDate: { lt: asOf },
        schedule: { allocation: { unit: { floor: { block: { phase: { project: { entityId } } } } } } },
      },
      include: { schedule: { include: { customer: true, unit: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return lines
      .filter((l) => Number(l.amountPaid) < Number(l.amountDue) - AMOUNT_TOLERANCE)
      .map((l) => ({
        installmentLineId: l.id,
        customerId: l.schedule.customerId,
        customerName: l.schedule.customer.name,
        unitId: l.schedule.unitId,
        dueDate: l.dueDate,
        amountDue: Number(l.amountDue),
        amountPaid: Number(l.amountPaid),
        openBalance: Number(l.amountDue) - Number(l.amountPaid),
        daysPastDue: Math.floor((asOf.getTime() - l.dueDate.getTime()) / 86_400_000),
      }));
  }

  async getCustomerStatement(entityId: string, customerId: string, from?: string, to?: string) {
    const entries = await this.prisma.customerLedger.findMany({
      where: {
        entityId,
        customerId,
        transactionDate: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined },
      },
      orderBy: { transactionDate: 'asc' },
    });

    let runningBalance = 0;
    return entries.map((entry) => {
      runningBalance += Number(entry.debit) - Number(entry.credit);
      return { ...entry, runningBalance };
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
