import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InventoryDocStatus, StockMovementType } from '@prisma/client';
import { InventoryService } from '../inventory.service';
import { InventoryAccountingService } from '../accounting/inventory-accounting.service';
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
  warehouse: any;
  stockItem: any;
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
    warehouse: prisma.warehouse,
    stockItem: prisma.stockItem,
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
      goodsReceipt: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      materialIssue: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockTransfer: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockCount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      warehouse: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve({
            id: where.id,
            entityId: 'ent-1',
            isActive: true,
          }),
        ),
      },
      stockItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'item-1', entityId: 'ent-1', isActive: true },
        ]),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: InventoryAccountingService,
          useValue: {
            resolveAccount: jest.fn().mockResolvedValue('account-inventory'),
            postInventoryEvent: jest.fn().mockResolvedValue({
              journalEntryId: 'je-test',
              totalDebit: 0,
              totalCredit: 0,
              balanced: true,
            }),
          },
        },
      ],
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
    await service.postGoodsReceipt('gr-1', buildUnrestrictedScope());

    // Second receipt: 100 more units at 20 each.
    prisma.goodsReceipt.findUnique.mockResolvedValueOnce({
      id: 'gr-2',
      warehouseId: 'wh-1',
      receiptDate: new Date('2026-07-05'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 100, unitCost: 20 }],
    });
    await service.postGoodsReceipt('gr-2', buildUnrestrictedScope());

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

    await service.postMaterialIssue('mi-1', buildUnrestrictedScope());

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

    await expect(service.postMaterialIssue('mi-2', buildUnrestrictedScope())).rejects.toThrow(BadRequestException);
  });

  it('refuses to re-post an already-posted document', async () => {
    prisma.$transaction.mockImplementation((fn: any) => fn(buildTxMock(prisma)));
    prisma.goodsReceipt.findUnique.mockResolvedValue({
      id: 'gr-3',
      status: InventoryDocStatus.POSTED,
      lines: [],
    });
    await expect(service.postGoodsReceipt('gr-3', buildUnrestrictedScope())).rejects.toThrow(ConflictException);
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

    await service.postStockTransfer('st-1', buildUnrestrictedScope());

    const source = tx.balances.get('item-1:wh-1')!;
    const dest = tx.balances.get('item-1:wh-2')!;
    expect(source.quantityOnHand).toBe(100);
    expect(dest.quantityOnHand).toBe(50);
    expect(dest.averageUnitCost).toBe(15); // cost carried over from source
  });

  it('throws NotFoundException for a nonexistent goods receipt', async () => {
    prisma.$transaction.mockImplementation((fn: any) => fn(buildTxMock(prisma)));
    prisma.goodsReceipt.findUnique.mockResolvedValue(null);
    await expect(service.postGoodsReceipt('missing', buildUnrestrictedScope())).rejects.toThrow(NotFoundException);
  });

  it('refuses to post a material issue for an entity the caller cannot post to', async () => {
    const tx = buildTxMock(prisma);
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));

    prisma.materialIssue.findUnique.mockResolvedValue({
      id: 'mi-sec-1',
      warehouseId: 'wh-2',
      issueDate: new Date('2026-07-10'),
      status: InventoryDocStatus.DRAFT,
      lines: [{ stockItemId: 'item-1', quantity: 1 }],
    });

    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'wh-2',
      entityId: 'ent-2',
      isActive: true,
    });

    const restrictedScope: SecurityScope = {
      ...buildUnrestrictedScope(),
      isSystemAdmin: false,
      entity: {
        unrestricted: false,
        viewableIds: ['ent-1'],
        postableIds: ['ent-1'],
      },
    };

    await expect(
      service.postMaterialIssue('mi-sec-1', restrictedScope),
    ).rejects.toThrow(ForbiddenException);
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

describe('InventoryService — read models', () => {
  let service: InventoryService;
  let prisma: {
    $transaction: jest.Mock;
    goodsReceipt: any;
    materialIssue: any;
    stockTransfer: any;
    stockCount: any;
    warehouse: any;
    stockItem: any;
    stockMovement: any;
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      goodsReceipt: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      materialIssue: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockTransfer: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockCount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'wh-1', entityId: 'ent-1', code: 'MAIN', name: 'Main Warehouse', isActive: true },
          { id: 'wh-2', entityId: 'ent-1', code: 'SITE', name: 'Site Warehouse', isActive: true },
        ]),
        findUnique: jest.fn(),
      },
      stockItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'item-1', entityId: 'ent-1', isActive: true },
        ]),
      },
      stockMovement: {
        findMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: InventoryAccountingService,
          useValue: {
            resolveAccount: jest.fn().mockResolvedValue('account-inventory'),
            postInventoryEvent: jest.fn().mockResolvedValue({
              journalEntryId: 'je-test',
              totalDebit: 0,
              totalCredit: 0,
              balanced: true,
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(InventoryService);
  });

  it('lists goods receipts through accessible warehouses with lines and limit', async () => {
    const rows = [
      {
        id: 'gr-1',
        warehouseId: 'wh-1',
        createdAt: new Date('2026-08-20T10:00:00Z'),
        lines: [{ id: 'grl-1' }],
      },
    ];

    prisma.goodsReceipt.findMany.mockResolvedValue(rows);

    const result = await service.findGoodsReceipts(
      buildUnrestrictedScope(),
      'ent-1',
      25,
    );

    expect(result).toEqual(rows);
    expect(prisma.goodsReceipt.findMany).toHaveBeenCalledWith({
      where: { warehouseId: { in: ['wh-1', 'wh-2'] } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  });

  it('lists material issues through accessible warehouses with lines and limit', async () => {
    const rows = [
      {
        id: 'mi-1',
        warehouseId: 'wh-1',
        createdAt: new Date('2026-08-20T09:00:00Z'),
        lines: [{ id: 'mil-1' }],
      },
    ];

    prisma.materialIssue.findMany.mockResolvedValue(rows);

    const result = await service.findMaterialIssues(
      buildUnrestrictedScope(),
      'ent-1',
      30,
    );

    expect(result).toEqual(rows);
    expect(prisma.materialIssue.findMany).toHaveBeenCalledWith({
      where: { warehouseId: { in: ['wh-1', 'wh-2'] } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  });

  it('lists transfers visible from either accessible side with lines', async () => {
    const rows = [
      {
        id: 'st-1',
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        createdAt: new Date('2026-08-20T08:00:00Z'),
        lines: [{ id: 'stl-1' }],
      },
    ];

    prisma.stockTransfer.findMany.mockResolvedValue(rows);

    const result = await service.findStockTransfers(
      buildUnrestrictedScope(),
      'ent-1',
      40,
    );

    expect(result).toEqual(rows);
    expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { fromWarehouseId: { in: ['wh-1', 'wh-2'] } },
          { toWarehouseId: { in: ['wh-1', 'wh-2'] } },
        ],
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  });

  it('lists stock counts through accessible warehouses with lines', async () => {
    const rows = [
      {
        id: 'sc-1',
        warehouseId: 'wh-2',
        createdAt: new Date('2026-08-20T07:00:00Z'),
        lines: [{ id: 'scl-1', varianceQuantity: '2' }],
      },
    ];

    prisma.stockCount.findMany.mockResolvedValue(rows);

    const result = await service.findStockCounts(
      buildUnrestrictedScope(),
      'ent-1',
      50,
    );

    expect(result).toEqual(rows);
    expect(prisma.stockCount.findMany).toHaveBeenCalledWith({
      where: { warehouseId: { in: ['wh-1', 'wh-2'] } },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('lists stock movements with item and warehouse details', async () => {
    const rows = [
      {
        id: 'mv-1',
        stockItemId: 'item-1',
        warehouseId: 'wh-1',
        movementType: StockMovementType.RECEIPT,
        quantity: '100',
        unitCost: '10',
        totalCost: '1000',
      },
    ];

    prisma.stockMovement.findMany.mockResolvedValue(rows);

    const result = await service.findStockMovements(
      buildUnrestrictedScope(),
      'ent-1',
      'item-1',
      'wh-1',
      75,
    );

    expect(result).toEqual(rows);
    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith({
      where: {
        warehouseId: 'wh-1',
        stockItemId: 'item-1',
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
      take: 75,
    });
  });

  it('returns no read rows when the caller has no accessible warehouses', async () => {
    prisma.warehouse.findMany.mockResolvedValue([]);

    expect(
      await service.findGoodsReceipts(buildUnrestrictedScope(), 'ent-1'),
    ).toEqual([]);

    expect(
      await service.findMaterialIssues(buildUnrestrictedScope(), 'ent-1'),
    ).toEqual([]);

    expect(
      await service.findStockTransfers(buildUnrestrictedScope(), 'ent-1'),
    ).toEqual([]);

    expect(
      await service.findStockCounts(buildUnrestrictedScope(), 'ent-1'),
    ).toEqual([]);

    expect(
      await service.findStockMovements(buildUnrestrictedScope(), 'ent-1'),
    ).toEqual([]);

    expect(prisma.goodsReceipt.findMany).not.toHaveBeenCalled();
    expect(prisma.materialIssue.findMany).not.toHaveBeenCalled();
    expect(prisma.stockTransfer.findMany).not.toHaveBeenCalled();
    expect(prisma.stockCount.findMany).not.toHaveBeenCalled();
    expect(prisma.stockMovement.findMany).not.toHaveBeenCalled();
  });

  it('rejects a movement query for an inaccessible warehouse', async () => {
    prisma.warehouse.findMany.mockResolvedValue([
      { id: 'wh-1', entityId: 'ent-1', code: 'MAIN', name: 'Main Warehouse', isActive: true },
    ]);

    await expect(
      service.findStockMovements(
        buildUnrestrictedScope(),
        'ent-1',
        undefined,
        'wh-forbidden',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.stockMovement.findMany).not.toHaveBeenCalled();
  });
});
