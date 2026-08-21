import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory.service';
import {
  InventoryImportError,
  InventoryImportPreview,
  InventoryImportResult,
  InventoryImportRow,
} from './inventory-import.types';
import { SecurityScope } from '../../security/security.types';

@Injectable()
export class InventoryImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  private parseRow(
    row: Record<string, unknown>,
    rowNumber: number,
  ): {
    parsed?: InventoryImportRow;
    errors: InventoryImportError[];
  } {
    const errors: InventoryImportError[] = [];

    const entityId = String(row.entityId ?? '').trim();
    const warehouseCode = String(row.warehouseCode ?? '').trim();
    const stockItemCode = String(row.stockItemCode ?? '').trim();
    const quantity = Number(row.quantity);
    const unitCost = Number(row.unitCost);
    const movementDate = String(row.movementDate ?? '').trim();
    const reference =
      row.reference == null ? undefined : String(row.reference);

    if (!entityId)
      errors.push({
        rowNumber,
        field: 'entityId',
        message: 'Entity is required',
      });

    if (!warehouseCode)
      errors.push({
        rowNumber,
        field: 'warehouseCode',
        message: 'Warehouse code is required',
      });

    if (!stockItemCode)
      errors.push({
        rowNumber,
        field: 'stockItemCode',
        message: 'Stock item code is required',
      });

    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({
        rowNumber,
        field: 'quantity',
        message: 'Quantity must be greater than zero',
      });
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      errors.push({
        rowNumber,
        field: 'unitCost',
        message: 'Unit cost must be zero or greater',
      });
    }

    if (!movementDate || Number.isNaN(Date.parse(movementDate))) {
      errors.push({
        rowNumber,
        field: 'movementDate',
        message: 'Valid movement date is required',
      });
    }

    if (errors.length > 0) {
      return { errors };
    }

    return {
      errors: [],
      parsed: {
        rowNumber,
        entityId,
        warehouseCode,
        stockItemCode,
        quantity,
        unitCost,
        movementDate,
        reference,
      },
    };
  }

  preview(rows: Record<string, unknown>[]): InventoryImportPreview {
    if (!Array.isArray(rows)) {
      throw new BadRequestException(
        'Import payload must contain an array of rows',
      );
    }

    const validRows: InventoryImportRow[] = [];
    const errors: InventoryImportError[] = [];

    rows.forEach((row, index) => {
      const parsed = this.parseRow(row, index + 2);

      if (parsed.parsed) {
        validRows.push(parsed.parsed);
      }

      errors.push(...parsed.errors);
    });

    return {
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      errors,
      rows: validRows,
    };
  }

  async importValidated(
    preview: InventoryImportPreview,
    scope: SecurityScope,
  ): Promise<InventoryImportResult> {
    if (preview.invalidRows > 0) {
      throw new BadRequestException(
        'Import contains validation errors. Resolve all errors before committing inventory changes.',
      );
    }

    const importId = crypto.randomUUID();

    let importedRows = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of preview.rows) {
        const warehouse = await tx.warehouse.findFirst({
          where: {
            entityId: row.entityId,
            code: row.warehouseCode,
            isActive: true,
          },
        });

        if (!warehouse) {
          throw new BadRequestException(
            `Row ${row.rowNumber}: warehouse ${row.warehouseCode} was not found for entity ${row.entityId}`,
          );
        }

        const stockItem = await tx.stockItem.findFirst({
          where: {
            entityId: row.entityId,
            code: row.stockItemCode,
            isActive: true,
          },
        });

        if (!stockItem) {
          throw new BadRequestException(
            `Row ${row.rowNumber}: stock item ${row.stockItemCode} was not found for entity ${row.entityId}`,
          );
        }

        if (
          !scope.isSystemAdmin &&
          !scope.entity.unrestricted &&
          !scope.entity.postableIds.includes(row.entityId)
        ) {
          throw new ForbiddenException(
            `No post access to entity ${row.entityId}`,
          );
        }

        await this.inventory.receiveStockForReference(
          {
            stockItemId: stockItem.id,
            warehouseId: warehouse.id,
            quantity: row.quantity,
            unitCost: row.unitCost,
            movementDate: new Date(row.movementDate),
            referenceType: 'InventoryImport',
            referenceId: importId,
          },
          tx,
          scope.userId,
          true,
        );

        importedRows += 1;
      }
    });

    return {
      importId,
      status: 'IMPORTED',
      totalRows: preview.totalRows,
      importedRows,
      failedRows: 0,
      errors: [],
    };
  }
}