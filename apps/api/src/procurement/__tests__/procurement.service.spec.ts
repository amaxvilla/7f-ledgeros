import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { POStatus, PRStatus, VendorInvoiceStatus } from '@prisma/client';
import { ProcurementService } from '../procurement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
import { BudgetingService } from '../../budgeting/budgeting.service';
import { InventoryService } from '../../inventory/inventory.service';
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

function buildPrismaMock() {
  return {
    entity: { findUnique: jest.fn() },
    vendor: { findUnique: jest.fn() },
    purchaseRequisition: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    purchaseOrder: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    purchaseOrderLine: { update: jest.fn(), findMany: jest.fn() },
    procurementGRN: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    vendorInvoice: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    threeWayMatch: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
}

function buildBudgetingMock() {
  return {
    getAvailableForLine: jest.fn(),
    createCommitment: jest.fn(),
    releaseCommitment: jest.fn(),
  };
}

function buildInventoryMock() {
  return { receiveStockForReference: jest.fn() };
}

function buildPostingEngineMock() {
  return { postSystemEntry: jest.fn() };
}

describe('ProcurementService', () => {
  let service: ProcurementService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let budgeting: ReturnType<typeof buildBudgetingMock>;
  let inventory: ReturnType<typeof buildInventoryMock>;
  let postingEngine: ReturnType<typeof buildPostingEngineMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    budgeting = buildBudgetingMock();
    inventory = buildInventoryMock();
    postingEngine = buildPostingEngineMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProcurementService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: BudgetingService, useValue: budgeting },
        { provide: InventoryService, useValue: inventory },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = moduleRef.get(ProcurementService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createRequisition', () => {
    it('rejects an inactive or unknown entity', async () => {
      prisma.entity.findUnique.mockResolvedValue(null);
      await expect(
        service.createRequisition({ entityId: 'e1', prNumber: 'PR-1', lines: [] } as any, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate PR number for the same entity', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.purchaseRequisition.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.createRequisition(
          { entityId: 'e1', prNumber: 'PR-1', lines: [{ description: 'x', accountId: 'a1', quantity: 1, estimatedUnitCost: 10 }] } as any,
          'u1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a DRAFT requisition with lines', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.purchaseRequisition.findUnique.mockResolvedValue(null);
      prisma.purchaseRequisition.create.mockImplementation(({ data }: any) => ({ id: 'pr1', ...data }));

      const result: any = await service.createRequisition(
        { entityId: 'e1', prNumber: 'PR-1', lines: [{ description: 'Cement', accountId: 'a1', quantity: 100, estimatedUnitCost: 5 }] } as any,
        'u1',
      );

      expect(result.status).toBe(PRStatus.DRAFT);
      expect(result.requestedById).toBe('u1');
    });
  });

  describe('approveRequisition', () => {
    it('rejects the requester approving their own requisition', async () => {
      prisma.purchaseRequisition.findUnique.mockResolvedValue({ id: 'pr1', status: PRStatus.SUBMITTED, requestedById: 'u1' });
      await expect(service.approveRequisition('pr1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('rejects approving a requisition not in SUBMITTED status', async () => {
      prisma.purchaseRequisition.findUnique.mockResolvedValue({ id: 'pr1', status: PRStatus.DRAFT, requestedById: 'u1' });
      await expect(service.approveRequisition('pr1', 'u2')).rejects.toThrow(ConflictException);
    });
  });

  describe('createPurchaseOrder', () => {
    it('rejects a PO raised against a requisition that is not approved', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v1', isActive: true });
      prisma.purchaseRequisition.findUnique.mockResolvedValue({ id: 'pr1', status: PRStatus.DRAFT, entityId: 'e1' });

      await expect(
        service.createPurchaseOrder(
          {
            entityId: 'e1',
            poNumber: 'PO-1',
            requisitionId: 'pr1',
            vendorId: 'v1',
            orderDate: '2026-01-01',
            lines: [{ description: 'Cement', accountId: 'a1', budgetLineId: 'bl1', quantity: 100, unitCost: 5 }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approvePurchaseOrder', () => {
    const basePo = {
      id: 'po1',
      poNumber: 'PO-1',
      status: POStatus.DRAFT,
      createdById: 'u1',
      lines: [{ id: 'pol1', description: 'Cement', budgetLineId: 'bl1', quantity: 100, unitCost: 5 }],
    };

    it('rejects the preparer approving their own PO', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(basePo);
      await expect(service.approvePurchaseOrder('po1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('rejects approval when available budget is insufficient', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(basePo);
      budgeting.getAvailableForLine.mockResolvedValue(100); // required is 500

      await expect(service.approvePurchaseOrder('po1', 'u2')).rejects.toThrow(BadRequestException);
      expect(budgeting.createCommitment).not.toHaveBeenCalled();
    });

    it('raises a BudgetCommitment per line and approves the PO when budget is available', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(basePo);
      budgeting.getAvailableForLine.mockResolvedValue(1000);
      budgeting.createCommitment.mockResolvedValue({ id: 'commit1' });
      prisma.purchaseOrderLine.update.mockResolvedValue({});
      prisma.purchaseOrder.update.mockImplementation(({ data }: any) => ({ ...basePo, ...data }));

      const result: any = await service.approvePurchaseOrder('po1', 'u2');

      expect(budgeting.createCommitment).toHaveBeenCalledWith(
        expect.objectContaining({ budgetLineId: 'bl1', amount: 500, sourceId: 'pol1' }),
        'u2',
      );
      expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
        where: { id: 'pol1' },
        data: { budgetCommitmentId: 'commit1' },
      });
      expect(result.status).toBe(POStatus.APPROVED);
    });
  });

  describe('receiveGoods', () => {
    const po = {
      id: 'po1',
      poNumber: 'PO-1',
      vendorId: 'v1',
      status: POStatus.APPROVED,
      lines: [
        {
          id: 'pol1',
          description: 'Cement',
          accountId: 'inv-acct',
          stockItemId: 'stock1',
          budgetLineId: 'bl1',
          budgetCommitmentId: 'commit1',
          quantity: 100,
          unitCost: 5,
          quantityReceived: 0,
        },
      ],
    };

    it('rejects receiving more than the outstanding quantity on a PO line', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);

      await expect(
        service.receiveGoods(
          {
            entityId: 'e1',
            grnNumber: 'GRN-1',
            purchaseOrderId: 'po1',
            warehouseId: 'w1',
            receiptDate: '2026-01-05',
            grIrClearingAccountId: 'grir-acct',
            lines: [{ purchaseOrderLineId: 'pol1', quantityReceived: 150 }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('posts the GL entry, records the stock receipt, releases the commitment, and rolls up PO status', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(po);
      prisma.procurementGRN.findUnique.mockResolvedValue(null); // no duplicate GRN number
      prisma.procurementGRN.create.mockImplementation(({ data }: any) => ({
        id: 'grn1',
        ...data,
        lines: [{ id: 'grnl1', purchaseOrderLineId: 'pol1', quantityReceived: 100, unitCost: 5 }],
      }));
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je1', journalNumber: 'JE-1' });
      inventory.receiveStockForReference.mockResolvedValue({});
      budgeting.releaseCommitment.mockResolvedValue({});
      prisma.purchaseOrderLine.update.mockResolvedValue({});
      prisma.procurementGRN.update.mockResolvedValue({});
      prisma.purchaseOrderLine.findMany.mockResolvedValue([{ id: 'pol1', quantity: 100, quantityReceived: 100 }]);
      prisma.purchaseOrder.update.mockResolvedValue({});

      const result: any = await service.receiveGoods(
        {
          entityId: 'e1',
          grnNumber: 'GRN-1',
          purchaseOrderId: 'po1',
          warehouseId: 'w1',
          receiptDate: '2026-01-05',
          grIrClearingAccountId: 'grir-acct',
          lines: [{ purchaseOrderLineId: 'pol1', quantityReceived: 100 }],
        } as any,
        'u1',
      );

      expect(postingEngine.postSystemEntry).toHaveBeenCalled();
      expect(inventory.receiveStockForReference).toHaveBeenCalledWith(
        expect.objectContaining({ stockItemId: 'stock1', quantity: 100, unitCost: 5 }),
      );
      expect(budgeting.releaseCommitment).toHaveBeenCalledWith('commit1', 500);
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po1' },
        data: { status: POStatus.FULLY_RECEIVED },
      });
      expect(result.journalEntry).toEqual({ id: 'je1', journalNumber: 'JE-1' });
    });
  });

  describe('completeThreeWayMatch', () => {
    it('rejects completing a match whose invoice is already posted', async () => {
      prisma.threeWayMatch.findUnique.mockResolvedValue({
        id: 'twm1',
        vendorInvoiceId: 'vi1',
        purchaseOrder: { entityId: 'e1', vendorId: 'v1' },
        grn: { grIrClearingAccountId: 'grir-acct' },
        vendorInvoice: { status: VendorInvoiceStatus.POSTED, invoiceNumber: 'INV-1', lines: [] },
      });

      await expect(
        service.completeThreeWayMatch('twm1', { apControlAccountId: 'ap-acct' } as any, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('posts an AP voucher debiting GR/IR clearing and crediting AP control', async () => {
      prisma.threeWayMatch.findUnique.mockResolvedValue({
        id: 'twm1',
        status: 'MATCHED',
        purchaseOrderId: 'po1',
        vendorInvoiceId: 'vi1',
        purchaseOrder: { id: 'po1', entityId: 'e1', vendorId: 'v1' },
        grn: { grIrClearingAccountId: 'grir-acct' },
        vendorInvoice: {
          invoiceNumber: 'INV-1',
          status: VendorInvoiceStatus.PENDING_MATCH,
          lines: [{ purchaseOrderLineId: 'pol1', quantity: 100, unitCost: 5, accountId: 'freight-acct' }],
        },
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je2' });
      prisma.vendorInvoice.update.mockResolvedValue({});
      prisma.threeWayMatch.update.mockResolvedValue({});
      prisma.purchaseOrderLine.update.mockResolvedValue({});
      prisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po1',
        status: POStatus.FULLY_RECEIVED,
        lines: [{ id: 'pol1', quantity: 100, quantityInvoiced: 100 }],
      });
      prisma.purchaseOrder.update.mockResolvedValue({});

      await service.completeThreeWayMatch('twm1', { apControlAccountId: 'ap-acct' } as any, 'u2');

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'grir-acct', debit: 500, credit: 0 }),
          expect.objectContaining({ accountId: 'ap-acct', debit: 0, credit: 500 }),
        ]),
      );
      expect(prisma.vendorInvoice.update).toHaveBeenCalledWith({
        where: { id: 'vi1' },
        data: { status: VendorInvoiceStatus.POSTED, postedAt: expect.any(Date) },
      });
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('findAllRequisitions scopes to the caller\'s viewable entities/departments/cost-centres/projects', async () => {
      prisma.purchaseRequisition.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: ['ent-1'] },
      };

      await service.findAllRequisitions(scope, {});

      expect(prisma.purchaseRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ entityId: { in: ['ent-1'] } }, expect.any(Object)] },
        }),
      );
    });

    it('findRequisition 404s when the requisition is outside the caller\'s scope', async () => {
      prisma.purchaseRequisition.findUnique.mockResolvedValue({
        id: 'pr1',
        entityId: 'ent-2',
        departmentId: null,
        costCenterId: null,
        projectId: null,
      });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: ['ent-1'] },
      };

      await expect(service.findRequisition('pr1', scope)).rejects.toThrow(NotFoundException);
    });

    it('findPurchaseOrder 404s when the PO entity is outside the caller\'s scope', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po1', entityId: 'ent-2' });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: ['ent-1'] },
      };

      await expect(service.findPurchaseOrder('po1', scope)).rejects.toThrow(NotFoundException);
    });

    it('findPurchaseOrder succeeds when the PO entity is in the caller\'s viewable set', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po1', entityId: 'ent-1' });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      const result = await service.findPurchaseOrder('po1', scope);
      expect(result.id).toBe('po1');
    });
  });
});
