import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InventoryExportRequest,
  InventoryExportResult,
} from './inventory-export.types';

@Injectable()
export class InventoryExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(
    request: InventoryExportRequest,
  ): Promise<InventoryExportResult> {
    const headers = [
      'id',
      'entityId',
      'warehouseId',
      'stockItemId',
      'date',
      'movementType',
      'quantity',
      'unitCost',
      'totalCost',
      'referenceType',
      'referenceId',
    ];

    let rows: string[][] = [];

    if (request.type === 'BALANCES') {
      const balances = await this.prisma.stockBalance.findMany({
        where: {
          warehouse: {
            entityId: request.entityId,
            ...(request.warehouseId
              ? { id: request.warehouseId }
              : {}),
          },
          ...(request.stockItemId
            ? { stockItemId: request.stockItemId }
            : {}),
        },
        orderBy: [{ warehouseId: 'asc' }, { stockItemId: 'asc' }],
      });

      rows = balances.map((b) => [
        '',
        request.entityId,
        b.warehouseId,
        b.stockItemId,
        b.updatedAt.toISOString(),
        'BALANCE',
        String(b.quantityOnHand),
        String(b.averageUnitCost),
        String(b.totalValue),
        '',
        '',
      ]);
    } else {
      const movements = await this.prisma.stockMovement.findMany({
        where: {
          warehouse: {
            entityId: request.entityId,
            ...(request.warehouseId
              ? { id: request.warehouseId }
              : {}),
          },
          ...(request.stockItemId
            ? { stockItemId: request.stockItemId }
            : {}),
          ...(request.fromDate || request.toDate
            ? {
                movementDate: {
                  ...(request.fromDate
                    ? { gte: new Date(request.fromDate) }
                    : {}),
                  ...(request.toDate
                    ? { lte: new Date(request.toDate) }
                    : {}),
                },
              }
            : {}),
        },
        orderBy: [{ movementDate: 'asc' }, { createdAt: 'asc' }],
      });

      rows = movements.map((m) => [
        m.id,
        request.entityId,
        m.warehouseId,
        m.stockItemId,
        m.movementDate.toISOString(),
        m.movementType,
        String(m.quantity),
        String(m.unitCost),
        String(m.totalCost),
        m.referenceType ?? '',
        m.referenceId ?? '',
      ]);
    }

    const csvEscape = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;

    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ].join('\r\n');

    return {
      filename: `inventory-${request.type.toLowerCase()}-${request.entityId}.csv`,
      contentType: 'text/csv',
      rowCount: rows.length,
      csv,
    };
  }
}