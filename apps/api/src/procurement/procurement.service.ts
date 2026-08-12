import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BudgetCommitmentSourceType,
  PRStatus,
  POStatus,
  ProcurementGRNStatus,
  VendorInvoiceStatus,
  ThreeWayMatchStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { BudgetingService } from '../budgeting/budgeting.service';
import { InventoryService } from '../inventory/inventory.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { RequisitionDecisionDto } from './dto/requisition-decision.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { CreateGRNDto } from './dto/create-grn.dto';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { CreateThreeWayMatchDto } from './dto/create-three-way-match.dto';
import { CompleteThreeWayMatchDto } from './dto/complete-three-way-match.dto';

// Tolerance for quantity/currency comparisons, guarding against floating
// point drift on decimal math — mirrors the convention already used by
// PostingEngineService (CENTS_TOLERANCE) and InventoryService (QTY_TOLERANCE).
const QTY_TOLERANCE = 0.0005;
const AMOUNT_TOLERANCE = 0.01;

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
    private readonly budgeting: BudgetingService,
    private readonly inventory: InventoryService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // PURCHASE REQUISITION
  // -------------------------------------------------------------------

  async createRequisition(dto: CreateRequisitionDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const existing = await this.prisma.purchaseRequisition.findUnique({
      where: { entityId_prNumber: { entityId: dto.entityId, prNumber: dto.prNumber } },
    });
    if (existing) throw new ConflictException(`Requisition number ${dto.prNumber} already exists for this entity`);

    return this.prisma.purchaseRequisition.create({
      data: {
        entityId: dto.entityId,
        prNumber: dto.prNumber,
        requestedById: userId,
        projectId: dto.projectId,
        departmentId: dto.departmentId,
        costCenterId: dto.costCenterId,
        fundingSourceId: dto.fundingSourceId,
        justification: dto.justification,
        status: PRStatus.DRAFT,
        lines: {
          create: dto.lines.map((line) => ({
            description: line.description,
            accountId: line.accountId,
            budgetLineId: line.budgetLineId,
            quantity: line.quantity,
            estimatedUnitCost: line.estimatedUnitCost,
            projectId: line.projectId,
            phaseId: line.phaseId,
            departmentId: line.departmentId,
            costCenterId: line.costCenterId,
            fundingSourceId: line.fundingSourceId,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findAllRequisitions(scope: SecurityScope, filters: { entityId?: string; status?: PRStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, {
      dimensions: ['entity', 'department', 'costCenter', 'project', 'businessUnit'],
    });
    return this.prisma.purchaseRequisition.findMany({
      where: { AND: [rls, { entityId: filters.entityId, status: filters.status }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRequisition(id: string, scope: SecurityScope) {
    const pr = await this.prisma.purchaseRequisition.findUnique({
      where: { id },
      include: { lines: true, purchaseOrders: true },
    });
    if (!pr) throw new NotFoundException(`Requisition ${id} not found`);
    if (
      !this.rowLevelSecurity.canAccess(
        scope,
        { entityId: pr.entityId, departmentId: pr.departmentId, costCenterId: pr.costCenterId, projectId: pr.projectId },
        { dimensions: ['entity', 'department', 'costCenter', 'project', 'businessUnit'] },
      )
    ) {
      throw new NotFoundException(`Requisition ${id} not found`);
    }
    return pr;
  }

  async submitRequisition(id: string, _userId: string) {
    const pr = await this.getRequisitionOrThrow(id);
    this.assertPRStatus(pr.status, [PRStatus.DRAFT, PRStatus.REJECTED], 'submit');
    return this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PRStatus.SUBMITTED, submittedAt: new Date() },
    });
  }

  async approveRequisition(id: string, userId: string, _dto?: RequisitionDecisionDto) {
    const pr = await this.getRequisitionOrThrow(id);
    this.assertPRStatus(pr.status, [PRStatus.SUBMITTED], 'approve');
    if (pr.requestedById === userId) {
      throw new BadRequestException('The requester of a requisition cannot also approve it');
    }
    return this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PRStatus.APPROVED, approvedById: userId, approvedAt: new Date() },
    });
  }

  async rejectRequisition(id: string, _userId: string, dto?: RequisitionDecisionDto) {
    const pr = await this.getRequisitionOrThrow(id);
    this.assertPRStatus(pr.status, [PRStatus.SUBMITTED], 'reject');
    return this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PRStatus.REJECTED, rejectedReason: dto?.comments },
    });
  }

  // -------------------------------------------------------------------
  // PURCHASE ORDER
  // -------------------------------------------------------------------

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor || !vendor.isActive) throw new NotFoundException(`Vendor ${dto.vendorId} not found or inactive`);

    if (dto.requisitionId) {
      const pr = await this.prisma.purchaseRequisition.findUnique({ where: { id: dto.requisitionId } });
      if (!pr) throw new NotFoundException(`Requisition ${dto.requisitionId} not found`);
      if (pr.status !== PRStatus.APPROVED) {
        throw new ConflictException('A purchase order can only be raised against an approved requisition');
      }
      if (pr.entityId !== dto.entityId) {
        throw new BadRequestException('Requisition belongs to a different entity');
      }
    }

    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { entityId_poNumber: { entityId: dto.entityId, poNumber: dto.poNumber } },
    });
    if (existing) throw new ConflictException(`PO number ${dto.poNumber} already exists for this entity`);

    return this.prisma.purchaseOrder.create({
      data: {
        entityId: dto.entityId,
        poNumber: dto.poNumber,
        requisitionId: dto.requisitionId,
        vendorId: dto.vendorId,
        orderDate: new Date(dto.orderDate),
        status: POStatus.DRAFT,
        createdById: userId,
        lines: {
          create: dto.lines.map((line) => ({
            requisitionLineId: line.requisitionLineId,
            description: line.description,
            accountId: line.accountId,
            stockItemId: line.stockItemId,
            budgetLineId: line.budgetLineId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            projectId: line.projectId,
            phaseId: line.phaseId,
            departmentId: line.departmentId,
            costCenterId: line.costCenterId,
            fundingSourceId: line.fundingSourceId,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findAllPurchaseOrders(scope: SecurityScope, filters: { entityId?: string; status?: POStatus; vendorId?: string }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.purchaseOrder.findMany({
      where: { AND: [rls, { entityId: filters.entityId, status: filters.status, vendorId: filters.vendorId }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPurchaseOrder(id: string, scope: SecurityScope) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true, goodsReceipts: true, vendorInvoices: true },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    if (!this.rowLevelSecurity.canAccess(scope, { entityId: po.entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return po;
  }

  /**
   * Checks available budget (Budget - Actual - Commitments) on every line
   * BEFORE raising any commitment, then raises one BudgetCommitment per
   * line via BudgetingService. Note: as with the rest of this codebase's
   * subsystem postings (see RevenueRecognitionService), the pre-check and
   * the per-line commitment creation are not wrapped in a single DB
   * transaction — under concurrent approvals of different POs against the
   * same budget line there is a narrow race window between the check and
   * the write. Acceptable for this phase; tightening this (e.g. a
   * SELECT ... FOR UPDATE on BudgetLine) is a good follow-up once
   * concurrent PO approval volume warrants it.
   */
  async approvePurchaseOrder(id: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    this.assertPOStatus(po.status, [POStatus.DRAFT], 'approve');
    if (po.createdById === userId) {
      throw new BadRequestException('The preparer of a purchase order cannot also approve it');
    }
    if (po.lines.length === 0) throw new BadRequestException('Purchase order has no lines');

    for (const line of po.lines) {
      const available = await this.budgeting.getAvailableForLine(line.budgetLineId);
      const required = Number(line.quantity) * Number(line.unitCost);
      if (available < required) {
        throw new BadRequestException(
          `Insufficient available budget for PO line "${line.description}": available ${available}, required ${required}`,
        );
      }
    }

    for (const line of po.lines) {
      const required = Number(line.quantity) * Number(line.unitCost);
      const commitment = await this.budgeting.createCommitment(
        {
          budgetLineId: line.budgetLineId,
          amount: required,
          sourceType: BudgetCommitmentSourceType.PURCHASE_ORDER,
          sourceId: line.id,
          description: `PO ${po.poNumber} — ${line.description}`,
        },
        userId,
      );
      await this.prisma.purchaseOrderLine.update({
        where: { id: line.id },
        data: { budgetCommitmentId: commitment.id },
      });
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.APPROVED, approvedById: userId, approvedAt: new Date() },
      include: { lines: true },
    });
  }

  async rejectPurchaseOrder(id: string, _userId: string) {
    const po = await this.getPurchaseOrderOrThrow(id);
    this.assertPOStatus(po.status, [POStatus.DRAFT], 'reject');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: POStatus.CANCELLED } });
  }

  // -------------------------------------------------------------------
  // GOODS RECEIPT (ProcurementGRN)
  // -------------------------------------------------------------------

  /**
   * Records a (possibly partial) delivery against an approved PO:
   *   1. Posts Dr <line account> / Cr GR/IR clearing through
   *      PostingEngineService.postSystemEntry (the GL kernel).
   *   2. Records the matching StockMovement/StockBalance update via
   *      InventoryService for any line tied to a stock item — never
   *      duplicating that logic here.
   *   3. Releases the corresponding BudgetCommitment by the received
   *      value (commitment -> actual).
   *   4. Advances quantityReceived on each PO line and rolls the PO's own
   *      status up to PARTIALLY_RECEIVED / FULLY_RECEIVED.
   */
  async receiveGoods(dto: CreateGRNDto, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.purchaseOrderId },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException(`Purchase order ${dto.purchaseOrderId} not found`);
    if (!([POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED] as POStatus[]).includes(po.status)) {
      throw new ConflictException(`Cannot receive goods against a PO with status ${po.status}`);
    }

    const poLineById = new Map(po.lines.map((l) => [l.id, l]));
    for (const grnLine of dto.lines) {
      const poLine = poLineById.get(grnLine.purchaseOrderLineId);
      if (!poLine) throw new BadRequestException(`PO line ${grnLine.purchaseOrderLineId} does not belong to this PO`);
      const remaining = Number(poLine.quantity) - Number(poLine.quantityReceived);
      if (grnLine.quantityReceived > remaining + QTY_TOLERANCE) {
        throw new BadRequestException(
          `Cannot receive ${grnLine.quantityReceived}: only ${remaining} remains outstanding on PO line "${poLine.description}"`,
        );
      }
    }

    const existing = await this.prisma.procurementGRN.findUnique({
      where: { entityId_grnNumber: { entityId: dto.entityId, grnNumber: dto.grnNumber } },
    });
    if (existing) throw new ConflictException(`GRN number ${dto.grnNumber} already exists for this entity`);

    const grn = await this.prisma.procurementGRN.create({
      data: {
        entityId: dto.entityId,
        grnNumber: dto.grnNumber,
        purchaseOrderId: po.id,
        vendorId: po.vendorId,
        warehouseId: dto.warehouseId,
        receiptDate: new Date(dto.receiptDate),
        referenceNumber: dto.referenceNumber,
        grIrClearingAccountId: dto.grIrClearingAccountId,
        status: ProcurementGRNStatus.DRAFT,
        createdById: userId,
        lines: {
          create: dto.lines.map((l) => {
            const poLine = poLineById.get(l.purchaseOrderLineId)!;
            return {
              purchaseOrderLineId: l.purchaseOrderLineId,
              stockItemId: poLine.stockItemId,
              quantityReceived: l.quantityReceived,
              unitCost: l.unitCost ?? poLine.unitCost,
            };
          }),
        },
      },
      include: { lines: true },
    });

    let total = 0;
    const journalLines = grn.lines.map((line) => {
      const poLine = poLineById.get(line.purchaseOrderLineId)!;
      const value = Number(line.quantityReceived) * Number(line.unitCost);
      total += value;
      return {
        accountId: poLine.accountId,
        debit: value,
        credit: 0,
        projectId: poLine.projectId ?? undefined,
        phaseId: poLine.phaseId ?? undefined,
        departmentId: poLine.departmentId ?? undefined,
        costCenterId: poLine.costCenterId ?? undefined,
        fundingSourceId: poLine.fundingSourceId ?? undefined,
        vendorId: po.vendorId,
      };
    });
    journalLines.push({
      accountId: dto.grIrClearingAccountId,
      debit: 0,
      credit: total,
      projectId: undefined,
      phaseId: undefined,
      departmentId: undefined,
      costCenterId: undefined,
      fundingSourceId: undefined,
      vendorId: po.vendorId,
    });

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: dto.entityId,
        entryDate: dto.receiptDate,
        description: `Goods receipt ${dto.grnNumber} — PO ${po.poNumber}`,
        sourceType: 'PROCUREMENT',
        sourceReference: grn.id,
        lines: journalLines,
      } as never,
      userId,
    );

    for (const line of grn.lines) {
      const poLine = poLineById.get(line.purchaseOrderLineId)!;

      if (poLine.stockItemId) {
        await this.inventory.receiveStockForReference({
          stockItemId: poLine.stockItemId,
          warehouseId: dto.warehouseId,
          quantity: Number(line.quantityReceived),
          unitCost: Number(line.unitCost),
          movementDate: new Date(dto.receiptDate),
          referenceType: 'ProcurementGRN',
          referenceId: grn.id,
        });
      }

      if (poLine.budgetCommitmentId) {
        await this.budgeting.releaseCommitment(
          poLine.budgetCommitmentId,
          Number(line.quantityReceived) * Number(line.unitCost),
        );
      }

      await this.prisma.purchaseOrderLine.update({
        where: { id: poLine.id },
        data: { quantityReceived: Number(poLine.quantityReceived) + Number(line.quantityReceived) },
      });
    }

    await this.prisma.procurementGRN.update({
      where: { id: grn.id },
      data: { status: ProcurementGRNStatus.POSTED, postedAt: new Date() },
    });

    const refreshedLines = await this.prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
    const fullyReceived = refreshedLines.every((l) => Number(l.quantityReceived) >= Number(l.quantity) - QTY_TOLERANCE);
    const anyReceived = refreshedLines.some((l) => Number(l.quantityReceived) > QTY_TOLERANCE);
    await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: fullyReceived ? POStatus.FULLY_RECEIVED : anyReceived ? POStatus.PARTIALLY_RECEIVED : po.status },
    });

    return { grn, journalEntry: posted };
  }

  // -------------------------------------------------------------------
  // VENDOR INVOICE
  // -------------------------------------------------------------------

  async createVendorInvoice(dto: CreateVendorInvoiceDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);

    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor || !vendor.isActive) throw new NotFoundException(`Vendor ${dto.vendorId} not found or inactive`);

    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
      if (!po) throw new NotFoundException(`Purchase order ${dto.purchaseOrderId} not found`);
      if (po.entityId !== dto.entityId || po.vendorId !== dto.vendorId) {
        throw new BadRequestException('Purchase order does not belong to this entity/vendor');
      }
    }

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
        purchaseOrderId: dto.purchaseOrderId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: VendorInvoiceStatus.PENDING_MATCH,
        createdById: userId,
        lines: {
          create: dto.lines.map((line) => ({
            purchaseOrderLineId: line.purchaseOrderLineId,
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

  async findVendorInvoice(id: string) {
    const invoice = await this.prisma.vendorInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (!invoice) throw new NotFoundException(`Vendor invoice ${id} not found`);
    return invoice;
  }

  // -------------------------------------------------------------------
  // THREE-WAY MATCH
  // -------------------------------------------------------------------

  /**
   * Links a PO, a GRN raised against it, and a vendor invoice, and
   * computes quantity/price variance between what was received and what
   * was billed. Does not itself post anything — completing the match
   * (below) is the step that raises the AP voucher.
   */
  async createThreeWayMatch(dto: CreateThreeWayMatchDto) {
    const [po, grn, invoice] = await Promise.all([
      this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } }),
      this.prisma.procurementGRN.findUnique({ where: { id: dto.grnId }, include: { lines: true } }),
      this.prisma.vendorInvoice.findUnique({ where: { id: dto.vendorInvoiceId }, include: { lines: true } }),
    ]);
    if (!po) throw new NotFoundException(`Purchase order ${dto.purchaseOrderId} not found`);
    if (!grn) throw new NotFoundException(`GRN ${dto.grnId} not found`);
    if (!invoice) throw new NotFoundException(`Vendor invoice ${dto.vendorInvoiceId} not found`);
    if (grn.purchaseOrderId !== po.id) throw new BadRequestException('GRN does not belong to this PO');
    if (invoice.purchaseOrderId && invoice.purchaseOrderId !== po.id) {
      throw new BadRequestException('Vendor invoice does not belong to this PO');
    }

    const grnQty = grn.lines.reduce((sum, l) => sum + Number(l.quantityReceived), 0);
    const grnValue = grn.lines.reduce((sum, l) => sum + Number(l.quantityReceived) * Number(l.unitCost), 0);
    const invoiceQty = invoice.lines.reduce((sum, l) => sum + Number(l.quantity), 0);
    const invoiceValue = invoice.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);

    const quantityVarianceQty = invoiceQty - grnQty;
    const priceVarianceAmount = invoiceValue - grnValue;
    const withinTolerance =
      Math.abs(quantityVarianceQty) <= QTY_TOLERANCE && Math.abs(priceVarianceAmount) <= AMOUNT_TOLERANCE;

    return this.prisma.threeWayMatch.create({
      data: {
        purchaseOrderId: po.id,
        grnId: grn.id,
        vendorInvoiceId: invoice.id,
        status: withinTolerance ? ThreeWayMatchStatus.MATCHED : ThreeWayMatchStatus.MATCHED_WITH_VARIANCE,
        quantityVarianceQty,
        priceVarianceAmount,
      },
    });
  }

  async findThreeWayMatch(id: string) {
    const match = await this.prisma.threeWayMatch.findUnique({
      where: { id },
      include: { purchaseOrder: true, grn: true, vendorInvoice: { include: { lines: true } } },
    });
    if (!match) throw new NotFoundException(`Three-way match ${id} not found`);
    return match;
  }

  /**
   * Completes a three-way match by posting the AP voucher:
   *   Dr GR/IR clearing (the account the matched GRN accrued to)
   *   Cr AP control account
   * Invoice lines with no purchaseOrderLineId (e.g. freight/other
   * charges billed with no prior GRN accrual) are debited directly to
   * their own account instead, since there is no GR/IR entry to clear
   * for them.
   */
  async completeThreeWayMatch(id: string, dto: CompleteThreeWayMatchDto, userId: string) {
    const match = await this.prisma.threeWayMatch.findUnique({
      where: { id },
      include: {
        purchaseOrder: true,
        grn: true,
        vendorInvoice: { include: { lines: true } },
      },
    });
    if (!match) throw new NotFoundException(`Three-way match ${id} not found`);
    if (match.vendorInvoice.status === VendorInvoiceStatus.POSTED) {
      throw new ConflictException('This vendor invoice has already been posted to AP');
    }

    let invoiceTotal = 0;
    const journalLines = match.vendorInvoice.lines.map((line) => {
      const value = Number(line.quantity) * Number(line.unitCost);
      invoiceTotal += value;
      return {
        accountId: line.purchaseOrderLineId ? match.grn.grIrClearingAccountId : line.accountId,
        debit: value,
        credit: 0,
        vendorId: match.purchaseOrder.vendorId,
      };
    });
    journalLines.push({
      accountId: dto.apControlAccountId,
      debit: 0,
      credit: invoiceTotal,
      vendorId: match.purchaseOrder.vendorId,
    });

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: match.purchaseOrder.entityId,
        entryDate: new Date().toISOString(),
        description: `AP voucher — Vendor invoice ${match.vendorInvoice.invoiceNumber} (3-way match)`,
        sourceType: 'PROCUREMENT',
        sourceReference: match.vendorInvoiceId,
        lines: journalLines,
      } as never,
      userId,
    );

    await this.prisma.vendorInvoice.update({
      where: { id: match.vendorInvoiceId },
      data: { status: VendorInvoiceStatus.POSTED, postedAt: new Date() },
    });

    await this.prisma.threeWayMatch.update({
      where: { id },
      data: {
        matchedById: userId,
        matchedAt: new Date(),
        notes: dto.notes ?? match.notes,
      },
    });

    for (const line of match.vendorInvoice.lines) {
      if (line.purchaseOrderLineId) {
        await this.prisma.purchaseOrderLine.update({
          where: { id: line.purchaseOrderLineId },
          data: { quantityInvoiced: { increment: line.quantity } },
        });
      }
    }

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: match.purchaseOrderId },
      include: { lines: true },
    });
    if (po) {
      const fullyInvoiced = po.lines.every((l) => Number(l.quantityInvoiced) >= Number(l.quantity) - QTY_TOLERANCE);
      if (fullyInvoiced && po.status !== POStatus.FULLY_INVOICED) {
        await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: POStatus.FULLY_INVOICED } });
      } else if (!fullyInvoiced && po.status === POStatus.FULLY_RECEIVED) {
        await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: POStatus.PARTIALLY_INVOICED } });
      }
    }

    return { journalEntry: posted, vendorInvoiceId: match.vendorInvoiceId };
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async getRequisitionOrThrow(id: string) {
    const pr = await this.prisma.purchaseRequisition.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException(`Requisition ${id} not found`);
    return pr;
  }

  private async getPurchaseOrderOrThrow(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po;
  }

  private assertPRStatus(current: PRStatus, allowed: PRStatus[], action: string) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `Cannot ${action} a requisition with status ${current}. Expected one of: ${allowed.join(', ')}`,
      );
    }
  }

  private assertPOStatus(current: POStatus, allowed: POStatus[], action: string) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `Cannot ${action} a purchase order with status ${current}. Expected one of: ${allowed.join(', ')}`,
      );
    }
  }
}
