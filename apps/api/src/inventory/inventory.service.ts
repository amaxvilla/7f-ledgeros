import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryDocStatus, InventoryDomain, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { InventoryAccountingService } from './accounting/inventory-accounting.service';
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
    private readonly inventoryAccounting: InventoryAccountingService,
  ) {}

  // ---- Master data ----

  async createWarehouse(entityId: string, code: string, name: string) {
    const existing = await this.prisma.warehouse.findUnique({ where: { entityId_code: { entityId, code } } });
    if (existing) throw new ConflictException(`Warehouse code "${code}" already exists for this entity`);
    return this.prisma.warehouse.create({ data: { entityId, code, name } });
  }

  async getWarehouse(id: string, scope: SecurityScope) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    await this.assertWarehouseAccess(scope, id, 'view');

    const [balances, movements] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { warehouseId: id },
        include: {
          stockItem: true,
        },
        orderBy: {
          stockItem: { code: 'asc' },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: { warehouseId: id },
        include: {
          stockItem: true,
        },
        orderBy: { movementDate: 'desc' },
        take: 100,
      }),
    ]);

    return {
      warehouse,
      balances,
      movements,
    };
  }

  async updateWarehouse(
    id: string,
    data: { code?: string; name?: string; isActive?: boolean },
    scope: SecurityScope,
  ) {
    await this.assertWarehouseAccess(scope, id, 'post');

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${id} not found`);
    }

    if (data.code && data.code !== warehouse.code) {
      const existing = await this.prisma.warehouse.findUnique({
        where: {
          entityId_code: {
            entityId: warehouse.entityId,
            code: data.code,
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Warehouse code "${data.code}" already exists for this entity`,
        );
      }
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async getStockItem(id: string, scope: SecurityScope) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    await this.assertStockItemsBelongToEntity(scope, [id], item.entityId, 'view');

    const [balances, movements] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { stockItemId: id },
        include: {
          warehouse: true,
        },
        orderBy: {
          warehouse: { code: 'asc' },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: { stockItemId: id },
        include: {
          warehouse: true,
        },
        orderBy: { movementDate: 'desc' },
        take: 100,
      }),
    ]);

    return {
      stockItem: item,
      balances,
      movements,
    };
  }

  async updateStockItem(
    id: string,
    data: {
      code?: string;
      name?: string;
      domain?: InventoryDomain;
      unitOfMeasure?: string;
      isActive?: boolean;
    },
    scope: SecurityScope,
  ) {
    const item = await this.prisma.stockItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Stock item ${id} not found`);
    }

    await this.assertStockItemsBelongToEntity(scope, [id], item.entityId, 'post');

    if (data.code && data.code !== item.code) {
      const existing = await this.prisma.stockItem.findUnique({
        where: {
          entityId_code: {
            entityId: item.entityId,
            code: data.code,
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Stock item code "${data.code}" already exists for this entity`,
        );
      }
    }

    return this.prisma.stockItem.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.domain !== undefined ? { domain: data.domain } : {}),
        ...(data.unitOfMeasure !== undefined
          ? { unitOfMeasure: data.unitOfMeasure }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
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

  getBalance(stockItemId: string, warehouseId: string, scope: SecurityScope) {
    return this.assertWarehouseAccess(scope, warehouseId, 'view').then(async (warehouse) => {
      await this.assertStockItemsBelongToEntity(
        scope,
        [stockItemId],
        warehouse.entityId,
        'view',
      );

      return this.prisma.stockBalance.findUnique({
        where: { stockItemId_warehouseId: { stockItemId, warehouseId } },
      });
    });
  }

  // ---- Goods Receipt (increases stock at the receipt's own unit cost) ----

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, scope: SecurityScope) {
    if (dto.lines.length === 0) throw new BadRequestException('Goods receipt needs at least one line');

    const warehouse = await this.assertWarehouseAccess(scope, dto.warehouseId, 'post');

    await this.assertStockItemsBelongToEntity(
      scope,
      dto.lines.map((line) => line.stockItemId),
      warehouse.entityId,
      'post',
    );

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

  async postGoodsReceipt(id: string, scope: SecurityScope) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.findUnique({ where: { id }, include: { lines: true } });
      if (!receipt) throw new NotFoundException(`Goods receipt ${id} not found`);
      if (receipt.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Goods receipt is already ${receipt.status}`);
      }

      const warehouse = await this.assertWarehouseAccess(
        scope,
        receipt.warehouseId,
        'post',
        tx,
      );

      await this.assertStockItemsBelongToEntity(
        scope,
        receipt.lines.map((line) => line.stockItemId),
        warehouse.entityId,
        'post',
        tx,
      );

      let totalInventoryValue = 0;

      for (const line of receipt.lines) {
        const lineValue = Number(line.quantity) * Number(line.unitCost);
        totalInventoryValue += lineValue;

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

      await this.inventoryAccounting.postInventoryEvent(
        'RECEIPT',
        {
          entityId: warehouse.entityId,
          sourceType: 'INVENTORY',
          sourceId: receipt.id,
          postingDate: receipt.receiptDate.toISOString(),
          currency: 'NGN',
          description: `Inventory receipt ${receipt.id}`,
        },
        totalInventoryValue,
        scope.userId,
        tx,
      );

      return tx.goodsReceipt.update({
        where: { id },
        data: { status: InventoryDocStatus.POSTED },
      });
    });
  }

  // ---- Material Issue (decreases stock at current weighted-average cost) ----

  async createMaterialIssue(dto: CreateMaterialIssueDto, scope: SecurityScope) {
    if (dto.lines.length === 0) throw new BadRequestException('Material issue needs at least one line');

    const warehouse = await this.assertWarehouseAccess(scope, dto.warehouseId, 'post');

    await this.assertStockItemsBelongToEntity(
      scope,
      dto.lines.map((line) => line.stockItemId),
      warehouse.entityId,
      'post',
    );

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

  async postMaterialIssue(id: string, scope: SecurityScope) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.materialIssue.findUnique({ where: { id }, include: { lines: true } });
      if (!issue) throw new NotFoundException(`Material issue ${id} not found`);
      if (issue.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Material issue is already ${issue.status}`);
      }

      const warehouse = await this.assertWarehouseAccess(
        scope,
        issue.warehouseId,
        'post',
        tx,
      );

      await this.assertStockItemsBelongToEntity(
        scope,
        issue.lines.map((line) => line.stockItemId),
        warehouse.entityId,
        'post',
        tx,
      );

      let totalCogs = 0;

      for (const line of issue.lines) {
        const balance = await tx.stockBalance.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: line.stockItemId,
              warehouseId: issue.warehouseId,
            },
          },
        });

        const onHand = balance ? Number(balance.quantityOnHand) : 0;

        if (Number(line.quantity) > onHand + QTY_TOLERANCE) {
          throw new BadRequestException(
            `Cannot issue ${line.quantity} of item ${line.stockItemId}: only ${onHand} on hand`,
          );
        }

        const unitCost = balance ? Number(balance.averageUnitCost) : 0;
        totalCogs += Number(line.quantity) * unitCost;

        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: issue.warehouseId,
          movementType: StockMovementType.ISSUE,
          quantity: -Number(line.quantity),
          unitCost,
          movementDate: issue.issueDate,
          referenceType: 'MaterialIssue',
          referenceId: issue.id,
        });
      }

      await this.inventoryAccounting.postInventoryEvent(
        'ISSUE',
        {
          entityId: warehouse.entityId,
          sourceType: 'INVENTORY',
          sourceId: issue.id,
          postingDate: issue.issueDate.toISOString(),
          currency: 'NGN',
          description: `Inventory issue ${issue.id}`,
        },
        totalCogs,
        scope.userId,
        tx,
      );

      return tx.materialIssue.update({
        where: { id },
        data: { status: InventoryDocStatus.POSTED },
      });
    });
  }

  // ---- Stock Transfer (issue from source at its avg cost, receive into destination at that cost) ----

  async createStockTransfer(dto: CreateStockTransferDto, scope: SecurityScope) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouse must differ');
    }

    if (dto.lines.length === 0) {
      throw new BadRequestException('Stock transfer needs at least one line');
    }

    const sourceWarehouse = await this.assertWarehouseAccess(
      scope,
      dto.fromWarehouseId,
      'post',
    );

    const destinationWarehouse = await this.assertWarehouseAccess(
      scope,
      dto.toWarehouseId,
      'post',
    );

    if (sourceWarehouse.entityId !== destinationWarehouse.entityId) {
      throw new BadRequestException(
        'Source and destination warehouse must belong to the same entity',
      );
    }

    await this.assertStockItemsBelongToEntity(
      scope,
      dto.lines.map((line) => line.stockItemId),
      sourceWarehouse.entityId,
      'post',
    );

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

  async postStockTransfer(id: string, scope: SecurityScope) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { lines: true } });
      if (!transfer) throw new NotFoundException(`Stock transfer ${id} not found`);
      if (transfer.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Stock transfer is already ${transfer.status}`);
      }

      const sourceWarehouse = await this.assertWarehouseAccess(
        scope,
        transfer.fromWarehouseId,
        'post',
        tx,
      );

      const destinationWarehouse = await this.assertWarehouseAccess(
        scope,
        transfer.toWarehouseId,
        'post',
        tx,
      );

      if (sourceWarehouse.entityId !== destinationWarehouse.entityId) {
        throw new BadRequestException(
          'Source and destination warehouse must belong to the same entity',
        );
      }

      await this.assertStockItemsBelongToEntity(
        scope,
        transfer.lines.map((line) => line.stockItemId),
        sourceWarehouse.entityId,
        'post',
        tx,
      );

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

        await this.inventoryAccounting.postInventoryEvent(
          'TRANSFER',
          {
            entityId: sourceWarehouse.entityId,
            sourceType: 'INVENTORY_TRANSFER',
            sourceId: transfer.id,
            postingDate: transfer.transferDate.toISOString(),
            currency: 'NGN',
            reference: transfer.id,
            description: `Inventory transfer ${transfer.id}`,
          },
          transferCost * Number(line.quantity),
          transfer.createdById,
        );
      }

      return tx.stockTransfer.update({ where: { id }, data: { status: InventoryDocStatus.POSTED } });
    });
  }

  // ---- Stock Count (adjusts quantity to the counted figure at current avg cost) ----

  async createStockCount(dto: CreateStockCountDto, scope: SecurityScope) {
    if (dto.lines.length === 0) throw new BadRequestException('Stock count needs at least one line');

    const warehouse = await this.assertWarehouseAccess(
      scope,
      dto.warehouseId,
      'post',
    );

    await this.assertStockItemsBelongToEntity(
      scope,
      dto.lines.map((line) => line.stockItemId),
      warehouse.entityId,
      'post',
    );

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

  async postStockCount(id: string, scope: SecurityScope) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
      if (!count) throw new NotFoundException(`Stock count ${id} not found`);
      if (count.status !== InventoryDocStatus.DRAFT) {
        throw new ConflictException(`Stock count is already ${count.status}`);
      }

      const warehouse = await this.assertWarehouseAccess(
        scope,
        count.warehouseId,
        'post',
        tx,
      );

      await this.assertStockItemsBelongToEntity(
        scope,
        count.lines.map((line) => line.stockItemId),
        warehouse.entityId,
        'post',
        tx,
      );

      let positiveVarianceValue = 0;
      let negativeVarianceValue = 0;

      for (const line of count.lines) {
        const varianceQuantity = Number(line.varianceQuantity);

        if (Math.abs(varianceQuantity) < QTY_TOLERANCE) continue;

        const balance = await tx.stockBalance.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: line.stockItemId,
              warehouseId: count.warehouseId,
            },
          },
        });

        const currentAvgCost = balance ? Number(balance.averageUnitCost) : 0;
        const varianceValue = Math.abs(varianceQuantity * currentAvgCost);

        if (varianceQuantity > 0) {
          positiveVarianceValue += varianceValue;
        } else {
          negativeVarianceValue += varianceValue;
        }

        await this.applyMovement(tx, {
          stockItemId: line.stockItemId,
          warehouseId: count.warehouseId,
          movementType: StockMovementType.COUNT_ADJUSTMENT,
          quantity: varianceQuantity,
          unitCost: currentAvgCost,
          movementDate: count.countDate,
          referenceType: 'StockCount',
          referenceId: count.id,
        });
      }

      if (positiveVarianceValue > 0) {
        await this.inventoryAccounting.postInventoryEvent(
          'COUNT_VARIANCE',
          {
            entityId: warehouse.entityId,
            sourceType: 'INVENTORY',
            sourceId: `${count.id}:GAIN`,
            postingDate: count.countDate.toISOString(),
            currency: 'NGN',
            description: `Inventory count gain ${count.id}`,
          },
          positiveVarianceValue,
          scope.userId,
          tx,
        );
      }

      if (negativeVarianceValue > 0) {

        await this.inventoryAccounting.postInventoryEvent(
          'ADJUSTMENT',
          {
            entityId: warehouse.entityId,
            sourceType: 'INVENTORY',
            sourceId: `${count.id}:LOSS`,
            postingDate: count.countDate.toISOString(),
            currency: 'NGN',
            description: `Inventory count loss ${count.id}`,
          },
          negativeVarianceValue,
          scope.userId,
          tx,
        );
      }

      return tx.stockCount.update({
        where: { id },
        data: { status: InventoryDocStatus.POSTED },
      });
    });
  }

  // --------------------------------------------------
  // Inventory authorization / integrity helpers
  // --------------------------------------------------

  private async assertWarehouseAccess(
    scope: SecurityScope,
    warehouseId: string,
    mode: 'view' | 'post',
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const warehouse = await client.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, entityId: true, isActive: true },
    });

    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found or inactive`);
    }

    const allowed = this.rowLevelSecurity.canAccess(
      scope,
      { entityId: warehouse.entityId },
      { dimensions: ['entity'], mode },
    );

    if (!allowed) {
      throw new ForbiddenException(
        `No ${mode === 'post' ? 'post' : 'view'} access to warehouse ${warehouseId}`,
      );
    }

    return warehouse;
  }

  private async assertStockItemsBelongToEntity(
    scope: SecurityScope,
    stockItemIds: string[],
    entityId: string,
    mode: 'view' | 'post',
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const uniqueIds = [...new Set(stockItemIds)];

    const stockItems = await client.stockItem.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, entityId: true, isActive: true },
    });

    const byId = new Map(stockItems.map((item) => [item.id, item]));

    for (const id of uniqueIds) {
      const item = byId.get(id);

      if (!item || !item.isActive) {
        throw new NotFoundException(`Stock item ${id} not found or inactive`);
      }

      if (item.entityId !== entityId) {
        throw new BadRequestException(
          `Stock item ${id} does not belong to entity ${entityId}`,
        );
      }

      const allowed = this.rowLevelSecurity.canAccess(
        scope,
        { entityId: item.entityId },
        { dimensions: ['entity'], mode },
      );

      if (!allowed) {
        throw new ForbiddenException(
          `No ${mode === 'post' ? 'post' : 'view'} access to stock item ${id}`,
        );
      }
    }
  }

  // --------------------------------------------------
  // Inventory read models
  // --------------------------------------------------

  async findGoodsReceipts(scope: SecurityScope, entityId?: string, limit = 100) {
    const warehouseIds = await this.getAccessibleWarehouseIds(scope, entityId);
    if (warehouseIds.length === 0) return [];

    return this.prisma.goodsReceipt.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findMaterialIssues(scope: SecurityScope, entityId?: string, limit = 100) {
    const warehouseIds = await this.getAccessibleWarehouseIds(scope, entityId);
    if (warehouseIds.length === 0) return [];

    return this.prisma.materialIssue.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findStockTransfers(scope: SecurityScope, entityId?: string, limit = 100) {
    const warehouseIds = await this.getAccessibleWarehouseIds(scope, entityId);
    if (warehouseIds.length === 0) return [];

    return this.prisma.stockTransfer.findMany({
      where: {
        OR: [
          { fromWarehouseId: { in: warehouseIds } },
          { toWarehouseId: { in: warehouseIds } },
        ],
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findStockCounts(scope: SecurityScope, entityId?: string, limit = 100) {
    const warehouseIds = await this.getAccessibleWarehouseIds(scope, entityId);
    if (warehouseIds.length === 0) return [];

    return this.prisma.stockCount.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findStockMovements(
    scope: SecurityScope,
    entityId?: string,
    stockItemId?: string,
    warehouseId?: string,
    limit = 200,
  ) {
    const warehouseIds = await this.getAccessibleWarehouseIds(scope, entityId);

    if (warehouseIds.length === 0) return [];

    if (warehouseId && !warehouseIds.includes(warehouseId)) {
      throw new ForbiddenException(`No view access to warehouse ${warehouseId}`);
    }

    return this.prisma.stockMovement.findMany({
      where: {
        warehouseId: warehouseId ? warehouseId : { in: warehouseIds },
        ...(stockItemId ? { stockItemId } : {}),
      },
      include: {
        stockItem: {
          select: {
            id: true,
            code: true,
            name: true,
            unitOfMeasure: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [
        { movementDate: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });
  }

  private async getAccessibleWarehouseIds(
    scope: SecurityScope,
    entityId?: string,
  ): Promise<string[]> {
    const warehouses = await this.findWarehouses(scope, entityId);
    return warehouses.map((warehouse) => warehouse.id);
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
    systemUserId?: string,
    postAccounting = false,
  ) {
    const run = async (client: Prisma.TransactionClient) => {
      const warehouse = await client.warehouse.findUnique({
        where: { id: params.warehouseId },
        select: { id: true, entityId: true, isActive: true },
      });

      if (!warehouse || !warehouse.isActive) {
        throw new NotFoundException(
          `Warehouse ${params.warehouseId} not found or inactive`,
        );
      }

      const result = await this.applyMovement(client, {
        stockItemId: params.stockItemId,
        warehouseId: params.warehouseId,
        movementType: StockMovementType.RECEIPT,
        quantity: params.quantity,
        unitCost: params.unitCost,
        movementDate: params.movementDate,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      });

      if (postAccounting && systemUserId) {
        await this.inventoryAccounting.postInventoryEvent(
          'RECEIPT',
          {
            entityId: warehouse.entityId,
            sourceType: 'INVENTORY',
            sourceId: params.referenceId,
            postingDate: params.movementDate.toISOString(),
            currency: 'NGN',
            description: `${params.referenceType} ${params.referenceId}`,
          },
          Math.abs(params.quantity * params.unitCost),
          systemUserId,
          client,
        );
      }

      return result;
    };

    if (tx) {
      return run(tx);
    }

    return this.prisma.$transaction((client) => run(client));
  }

  // -------------------------------------------------------------------
  // Internal: single point of truth for weighted-average recalculation.
  // A positive quantity increases stock (receipt/transfer-in/positive
  // count adjustment); negative decreases it (issue/transfer-out/negative
  // count adjustment). unitCost is the cost of THIS movement â€” for
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


