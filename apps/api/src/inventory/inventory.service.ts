import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryDocStatus, InventoryDomain, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';

interface CreateGoodsReceiptDto {
  warehouseId: string;
  vendorId?: string;
  receiptDate: string;
  referenceNumber?: string;
  createdById: string;
  lines: { stockItemId: string; quantity: number; unitCost: number }[];
}

interface CreateMaterialIssueDto {
  warehouseId: string;
  projectId?: string;
  costCenterId?: string;
  issueDate: string;
  purpose?: string;
  createdById: string;
  lines: { stockItemId: string; quantity: number }[];
}

interface CreateStockTransferDto {
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  createdById: string;
  lines: { stockItemId: string; quantity: number }[];
}

interface CreateStockCountDto {
  warehouseId: string;
  countDate: string;
  createdById: string;
  lines: { stockItemId: string; countedQuantity: number }[];
}

const QTY_TOLERANCE = 0.0005;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // ---- Master data ----

  async createWarehouse(entityId: string, code: string, name: string) {
    const existing = await this.prisma.warehouse.findUnique({ where: { entityId_code: { entityId, code } } });
    if (existing) throw new ConflictException(`Warehouse code "${code}" already exists for this entity`);
    return this.prisma.warehouse.create({ data: { entityId, code, name } });
  }

  findWarehouses(scope: SecurityScope, entityId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.warehouse.findMany({ where: { AND: [rls, { entityId }] } });
  }

  async createStockItem(entityId: string, code: string, name: string, domain: InventoryDomain, unitOfMeasure: string) {
    const existing = await this.prisma.stockItem.findUnique({ where: { entityId_code: { entityId, code } } });
    if (existing) throw new ConflictException(`Stock item code "${code}" already exists for this entity`);
    return this.prisma.stockItem.create({ data: { entityId, code, name, domain, unitOfMeasure } });
  }

  findStockItems(scope: SecurityScope, entityId?: string, domain?: InventoryDomain) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.stockItem.findMany({
      where: { AND: [rls, { entityId, domain }] },
    });
  }

  getBalance(stockItemId: string, warehouseId: string) {
    return this.prisma.stockBalance.findUnique({
      where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
    });
  }

  // ---- Goods Receipt (increases stock at the receipt's own unit cost) ----

  async createGoodsReceipt(dto: CreateGoodsReceiptDto) {
    if (dto.lines.length === 0) throw new BadRequestException('Goods receipt needs at least one line');
    return this.prisma.goodsReceipt.create({
      data: {
        warehouseId: dto.warehouseId,
        vendorId: dto.vendorId,
        receiptDate: new Date(dto.receiptDate),
        referenceNumber: dto.referenceNumber,
        createdById: dto.createdById,
        status: InventoryDocStatus.DRAFT,
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  async postGoodsReceipt(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findUnique({ where: { id }, include: { lines: true } });
      if (!receipt) throw new NotFoundException(`Goods receipt ${id} not found`);
      if (receipt.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Goods receipt is already ${receipt.status}`);
      }

      for (const line of receipt.lines) {
        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: receipt.warehouseId,
          movementType: StockMovementType.RECEIPT,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          movementDate: receipt.receiptDate,
          referenceType: 'GoodsReceipt',
          referenceId: receipt.id,
        });
      }

      return tx.goodsReceipt.update({ where: { id }, data: { status: InventoryDocStatus.POSTED } });
    });
  }

  // ---- Material Issue (decreases stock at current weighted-average cost) ----

  async createMaterialIssue(dto: CreateMaterialIssueDto) {
    if (dto.lines.length === 0) throw new BadRequestException('Material issue needs at least one line');
    return this.prisma.materialIssue.create({
      data: {
        warehouseId: dto.warehouseId,
        projectId: dto.projectId,
        costCenterId: dto.costCenterId,
        issueDate: new Date(dto.issueDate),
        purpose: dto.purpose,
        createdById: dto.createdById,
        status: InventoryDocStatus.DRAFT,
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  async postMaterialIssue(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.materialIssue.findUnique({ where: { id }, include: { lines: true } });
      if (!issue) throw new NotFoundException(`Material issue ${id} not found`);
      if (issue.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Material issue is already ${issue.status}`);
      }

      for (const line of issue.lines) {
        const balance = await tx.stockBalance.findUnique({
          where: { stockItemId_warehouseId: { stockItemId: line.stockItemId, warehouseId: issue.warehouseId } },
        });
        const onHand = balance ? Number(balance.quantityOnHand) : 0;
        if (Number(line.quantity) > onHand + QTY_TOLERANCE) {
          throw new BadRequestException(
            `Cannot issue ${line.quantity} of item ${line.stockItemId}: only ${onHand} on hand`,
          );
        }

        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: issue.warehouseId,
          movementType: StockMovementType.ISSUE,
          quantity: -Number(line.quantity),
          unitCost: balance ? Number(balance.averageUnitCost) : 0,
          movementDate: issue.issueDate,
          referenceType: 'MaterialIssue',
          referenceId: issue.id,
        });
      }

      return tx.materialIssue.update({ where: { id }, data: { status: InventoryDocStatus.POSTED } });
    });
  }

  // ---- Stock Transfer (issue from source at its avg cost, receive into destination at that cost) ----

  async createStockTransfer(dto: CreateStockTransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouse must differ');
    }
    if (dto.lines.length === 0) throw new BadRequestException('Stock transfer needs at least one line');
    return this.prisma.stockTransfer.create({
      data: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        transferDate: new Date(dto.transferDate),
        createdById: dto.createdById,
        status: InventoryDocStatus.DRAFT,
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  async postStockTransfer(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { lines: true } });
      if (!transfer) throw new NotFoundException(`Stock transfer ${id} not found`);
      if (transfer.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Stock transfer is already ${transfer.status}`);
      }

      for (const line of transfer.lines) {
        const sourceBalance = await tx.stockBalance.findUnique({
          where: {
            stockItemId_warehouseId: { stockItemId: line.stockItemId, warehouseId: transfer.fromWarehouseId },
          },
        });
        const onHand = sourceBalance ? Number(sourceBalance.quantityOnHand) : 0;
        if (Number(line.quantity) > onHand + QTY_TOLERANCE) {
          throw new BadRequestException(
            `Cannot transfer ${line.quantity} of item ${line.stockItemId}: only ${onHand} on hand at source`,
          );
        }
        const transferCost = sourceBalance ? Number(sourceBalance.averageUnitCost) : 0;

        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: transfer.fromWarehouseId,
          movementType: StockMovementType.TRANSFER_OUT,
          quantity: -Number(line.quantity),
          unitCost: transferCost,
          movementDate: transfer.transferDate,
          referenceType: 'StockTransfer',
          referenceId: transfer.id,
        });

        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: transfer.toWarehouseId,
          movementType: StockMovementType.TRANSFER_IN,
          quantity: Number(line.quantity),
          unitCost: transferCost,
          movementDate: transfer.transferDate,
          referenceType: 'StockTransfer',
          referenceId: transfer.id,
        });
      }

      return tx.stockTransfer.update({ where: { id }, data: { status: InventoryDocStatus.POSTED } });
    });
  }

  // ---- Stock Count (adjusts quantity to the counted figure at current avg cost) ----

  async createStockCount(dto: CreateStockCountDto) {
    if (dto.lines.length === 0) throw new BadRequestException('Stock count needs at least one line');

    const linesWithSystemQty = await Promise.all(
      dto.lines.map(async (line) => {
        const balance = await this.prisma.stockBalance.findUnique({
          where: { stockItemId_warehouseId: { stockItemId: line.stockItemId, warehouseId: dto.warehouseId } },
        });
        const systemQuantity = balance ? Number(balance.quantityOnHand) : 0;
        return {
          stockItemId: line.stockItemId,
          countedQuantity: line.countedQuantity,
          systemQuantity,
          varianceQuantity: line.countedQuantity - systemQuantity,
        };
      }),
    );

    return this.prisma.stockCount.create({
      data: {
        warehouseId: dto.warehouseId,
        countDate: new Date(dto.countDate),
        createdById: dto.createdById,
        status: InventoryDocStatus.DRAFT,
        lines: { create: linesWithSystemQty },
      },
      include: { lines: true },
    });
  }

  async postStockCount(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
      if (!count) throw new NotFoundException(`Stock count ${id} not found`);
      if (count.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Stock count is already ${count.status}`);
      }

      for (const line of count.lines) {
        if (Math.abs(Number(line.varianceQuantity)) < QTY_TOLERANCE) continue;

        const balance = await tx.stockBalance.findUnique({
          where: { stockItemId_warehouseId: { stockItemId: line.stockItemId, warehouseId: count.warehouseId } },
        });
        const currentAvgCost = balance ? Number(balance.averageUnitCost) : 0;

        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: count.warehouseId,
          movementType: StockMovementType.COUNT_ADJUSTMENT,
          quantity: Number(line.varianceQuantity),
          unitCost: currentAvgCost,
          movementDate: count.countDate,
          referenceType: 'StockCount',
          referenceId: count.id,
        });
      }

      return tx.stockCount.update({ where: { id }, data: { status: InventoryDocStatus.POSTED } });
    });
  }

  // ---- External receipts (e.g. Procurement's ProcurementGRN posting) ----
  // Public, transaction-composable wrapper around applyMovement so other
  // modules can record a stock receipt against their own reference
  // document without duplicating StockMovement/StockBalance logic here.
  // Callers pass their own `tx` so the receipt, the caller's own record
  // updates, and any GL posting all commit atomically together.
  async receiveStockForReference(
    params: {
      stockItemId: string;
      warehouseId: string;
      quantity: number;
      unitCost: number;
      movementDate: Date;
      referenceType: string;
      referenceId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const run = (client: Prisma.TransactionClient) =>
      this.applyMovement(client, {
        stockItemId: params.stockItemId,
        warehouseId: params.warehouseId,
        movementType: StockMovementType.RECEIPT,
        quantity: params.quantity,
        unitCost: params.unitCost,
        movementDate: params.movementDate,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      });

    if (tx) return run(tx);
    return this.prisma.$transaction((client) => run(client));
  }

  // -------------------------------------------------------------------
  // Internal: single point of truth for weighted-average recalculation.
  // A positive quantity increases stock (receipt/transfer-in/positive
  // count adjustment); negative decreases it (issue/transfer-out/negative
  // count adjustment). unitCost is the cost of THIS movement — for
  // increases it's the acquisition cost, for decreases it's the current
  // running average (cost of goods leaving at weighted-average value).
  // -------------------------------------------------------------------
  private async applyMovement(
    tx: Prisma.TransactionClient,
    params: {
      stockItemId: string;
      warehouseId: string;
      movementType: StockMovementType;
      quantity: number;
      unitCost: number;
      movementDate: Date;
      referenceType: string;
      referenceId: string;
    },
  ) {
    const existing = await tx.stockBalance.findUnique({
      where: { stockItemId_warehouseId: { stockItemId: params.stockItemId, warehouseId: params.warehouseId } },
    });

    const oldQty = existing ? Number(existing.quantityOnHand) : 0;
    const oldValue = existing ? Number(existing.totalValue) : 0;

    const movementValue = params.quantity * params.unitCost;
    const newQty = oldQty + params.quantity;
    const newValue = oldValue + movementValue;

    if (newQty < -QTY_TOLERANCE) {
      throw new BadRequestException(
        `Movement would drive stock item ${params.stockItemId} negative in warehouse ${params.warehouseId}`,
      );
    }

    const newAvgCost = Math.abs(newQty) < QTY_TOLERANCE ? 0 : newValue / newQty;

    await tx.stockBalance.upsert({
      where: { stockItemId_warehouseId: { stockItemId: params.stockItemId, warehouseId: params.warehouseId } },
      create: {
        stockItemId: params.stockItemId,
        warehouseId: params.warehouseId,
        quantityOnHand: newQty,
        averageUnitCost: newAvgCost,
        totalValue: newValue,
      },
      update: {
        quantityOnHand: newQty,
        averageUnitCost: newAvgCost,
        totalValue: newValue,
      },
    });

    await tx.stockMovement.create({
      data: {
        stockItemId: params.stockItemId,
        warehouseId: params.warehouseId,
        movementType: params.movementType,
        quantity: params.quantity,
        unitCost: params.unitCost,
        totalCost: movementValue,
        movementDate: params.movementDate,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });
  }
}
