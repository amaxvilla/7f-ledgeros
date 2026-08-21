import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryReconciliationRequest,
  InventoryReconciliationResult,
} from './inventory-reconciliation.types';

@Injectable()
export class InventoryReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcile(
    request: InventoryReconciliationRequest,
  ): Promise<InventoryReconciliationResult> {
    const asOf = new Date(request.asOfDate);

    if (Number.isNaN(asOf.getTime())) {
      throw new BadRequestException('Invalid reconciliation date');
    }

    const inventoryRows = await this.prisma.stockBalance.findMany({
      where: {
        warehouse: {
          entityId: request.entityId,
          ...(request.warehouseId ? { id: request.warehouseId } : {}),
        },
        ...(request.stockItemId
          ? { stockItemId: request.stockItemId }
          : {}),
      },
      select: {
        stockItemId: true,
        warehouseId: true,
        totalValue: true,
      },
    });

    const subledgerValue = inventoryRows.reduce(
      (sum, row) => sum + Number(row.totalValue),
      0,
    );

    const config = await this.prisma.inventoryAccountingConfig.findUnique({
      where: { entityId: request.entityId },
    });

    if (!config) {
      throw new BadRequestException(
        `Inventory accounting configuration is not active for entity ${request.entityId}`,
      );
    }

    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: config.inventoryAssetAccountId,
        entityId: request.entityId,
        journalEntry: {
          status: 'POSTED',
          entryDate: { lte: asOf },
        },
      },
      select: {
        debit: true,
        credit: true,
      },
    });

    const glControlValue = journalLines.reduce(
      (sum, line) =>
        sum + Number(line.debit) - Number(line.credit),
      0,
    );

    const variance = Number(
      (subledgerValue - glControlValue).toFixed(2),
    );

    return {
      entityId: request.entityId,
      asOfDate: request.asOfDate,
      subledgerValue,
      glControlValue,
      variance,
      reconciled: Math.abs(variance) < 0.01,
      differences: Math.abs(variance) < 0.01
        ? []
        : inventoryRows.map((row) => ({
            stockItemId: row.stockItemId,
            warehouseId: row.warehouseId,
            subledgerAmount: Number(row.totalValue),
            glAmount: 0,
            variance: Number(row.totalValue),
            reason: 'Inventory subledger differs from GL control total',
          })),
    };
  }
}