import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryDocStatus, StockMovementType } from '@prisma/client';
import { InventoryService } from '../inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

/**
 * A minimal in-memory stand-in for the Prisma transaction client, just
 * enough to exercise the weighted-average math in applyMovement() without
 * a live database. Keyed by `${stockItemId}:${warehouseId}`.
 */
function buildTxMock(prisma: {
  goodsReceipt: any;
  materialIssue: any;
  stockTransfer: any;
  stockCount: any;
}) {
  const balances = new Map<string, { quantityOnHand: number; averageUnitCost: number; totalValue: number }>();
  const movements: any[] = [];

  const key = (stockItemId: string, warehouseId: string) => `${stockItemId}:${warehouseId}`;

  return {
    balances,
    movements,
    // Document-header models are looked up via `tx` in the service, so the
    // tx mock must delegate to the same jest.fn()s the tests configure on
    // the outer `prisma` mock — otherwise mockResolvedValue() on `prisma.*`
    // never reaches the code path that actually runs inside $transaction.
    goodsReceipt: prisma.goodsReceipt,
    materialIssue: prisma.materialIssue,
    stockTransfer: prisma.stockTransfer,
    stockCount: prisma.stockCount,
    stockBalance: {
      findUnique: jest.fn(({ where }: any) => {
        const { stockItemId, warehouseId } = where.stockItemId_warehouseId;
        const b = balances.get(key(stockItemId, warehouseId));
        return Promise.resolve(b ? { ...b } : null);
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        const { stockItemId, warehouseId } = where.stockItemId_warehouseId;
        const k = key(stockItemId, warehouseId);
        const data = balances.has(k) ? update : create;
        balances.set(k, {
          quantityOnHand: data.quantityOnHand,
          averageUnitCost: data.averageUnitCost,
          totalValue: data.totalValue,
        });
        return Promise.resolve({ stockItemId, warehouseId, ...balances.get(k) });
      }),
    },
    stockMovement: {
      create: jest.fn(({ data }: any) => {
        movements.push(data);
        return Promise.resolve(data);
      }),
    },
  };
}

describe('InventoryService — weighted-average valuation', () => {
  let service: InventoryService;
  let prisma: {
    $transaction: jest.Mock;
    goodsReceipt: any;
    materialIssue: any;
    stockTransfer: any;
    stockCount: any;
    warehouse: any;
    stockItem: any;
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      goodsReceipt: { findUnique: jest.fn(), update: jest.fn() },
      materialIssue: { findUnique: jest.fn(), update: jest.fn() },
      stockTransfer: { findUnique: jest.fn(), update: jest.fn() },
      stockCount: { findUnique: jest.fn(), update: jest.fn() },
      warehouse: { findMany: jest.fn() },
      stockItem: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [InventoryService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(InventoryService);
  });

  it('computes a weighted-average cost across two receipts at different prices', async () => {
    const tx = buildTxMock(prisma);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));
    prisma.goodsReceipt.findUnique.mockResolvedValueOnce({
      id: 'gr-1',
      warehouseId: 'wh-1',
      receiptDate: new Date('2026-07-01'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 100, unitCost: 10 }],
    });
    prisma.goodsReceipt.update.mockResolvedValue({});
    await service.postGoodsReceipt('gr-1');

    // Second receipt: 100 more units at 20 each.
    prisma.goodsReceipt.findUnique.mockResolvedValueOnce({
      id: 'gr-2',
      warehouseId: 'wh-1',
      receiptDate: new Date('2026-07-05'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 100, unitCost: 20 }],
    });
    await service.postGoodsReceipt('gr-2');

    const balance = tx.balances.get('item-1:wh-1')!;
    expect(balance.quantityOnHand).toBe(200);
    // (100*10 + 100*20) / 200 = 15
    expect(balance.averageUnitCost).toBe(15);
    expect(balance.totalValue).toBe(3000);
  });

  it('issues material at the current weighted-average cost, not the original receipt cost', async () => {
    const tx = buildTxMock(prisma);
    tx.balances.set('item-1:wh-1', { quantityOnHand: 200, averageUnitCost: 15, totalValue: 3000 });
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    prisma.materialIssue.findUnique.mockResolvedValue({
      id: 'mi-1',
      warehouseId: 'wh-1',
      issueDate: new Date('2026-07-10'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 50 }],
    });
    prisma.materialIssue.update.mockResolvedValue({});

    await service.postMaterialIssue('mi-1');

    const balance = tx.balances.get('item-1:wh-1')!;
    expect(balance.quantityOnHand).toBe(150);
    expect(balance.averageUnitCost).toBe(15); // unchanged — average cost doesn't move on issue
    expect(balance.totalValue).toBe(2250); // 150 * 15

    const issueMovement = tx.movements.find((m) => m.movementType === StockMovementType.ISSUE);
    expect(issueMovement.unitCost).toBe(15);
    expect(issueMovement.quantity).toBe(-50);
  });

  it('refuses to issue more than what is on hand', async () => {
    const tx = buildTxMock(prisma);
    tx.balances.set('item-1:wh-1', { quantityOnHand: 10, averageUnitCost: 15, totalValue: 150 });
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    prisma.materialIssue.findUnique.mockResolvedValue({
      id: 'mi-2',
      warehouseId: 'wh-1',
      issueDate: new Date('2026-07-10'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 50 }],
    });

    await expect(service.postMaterialIssue('mi-2')).rejects.toThrow(BadRequestException);
  });

  it('refuses to re-post an already-posted document', async () => {
    prisma.$transaction.mockImplementation((fn: any) => fn(buildTxMock(prisma)));
    prisma.goodsReceipt.findUnique.mockResolvedValue({
      id: 'gr-3',
      status: InventoryDocStatus.POSTED,
      lines: [],
    });
    await expect(service.postGoodsReceipt('gr-3')).rejects.toThrow(ConflictException);
  });

  it('carries the source average cost through a stock transfer', async () => {
    const tx = buildTxMock(prisma);
    tx.balances.set('item-1:wh-1', { quantityOnHand: 150, averageUnitCost: 15, totalValue: 2250 });
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    prisma.stockTransfer.findUnique.mockResolvedValue({
      id: 'st-1',
      fromWarehouseId: 'wh-1',
      toWarehouseId: 'wh-2',
      transferDate: new Date('2026-07-12'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 50 }],
    });
    prisma.stockTransfer.update.mockResolvedValue({});

    await service.postStockTransfer('st-1');

    const source = tx.balances.get('item-1:wh-1')!;
    const dest = tx.balances.get('item-1:wh-2')!;
    expect(source.quantityOnHand).toBe(100);
    expect(dest.quantityOnHand).toBe(50);
    expect(dest.averageUnitCost).toBe(15); // cost carried over from source
  });

  it('throws NotFoundException for a nonexistent goods receipt', async () => {
    prisma.$transaction.mockImplementation((fn: any) => fn(buildTxMock(prisma)));
    prisma.goodsReceipt.findUnique.mockResolvedValue(null);
    await expect(service.postGoodsReceipt('missing')).rejects.toThrow(NotFoundException);
  });

  describe('Row Level Security (Phase 2)', () => {
    it('findWarehouses scopes results to the caller\'s viewable entities', async () => {
      prisma.warehouse.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.findWarehouses(scope, undefined);

      expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
        where: { AND: [{ entityId: { in: ['ent-1'] } }, { entityId: undefined }] },
      });
    });

    it('findStockItems scopes results to the caller\'s viewable entities', async () => {
      prisma.stockItem.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.findStockItems(scope, undefined, undefined);

      expect(prisma.stockItem.findMany).toHaveBeenCalledWith({
        where: { AND: [{ entityId: { in: ['ent-1'] } }, { entityId: undefined, domain: undefined }] },
      });
    });
  });
});
