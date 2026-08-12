import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UnitStatus } from '@prisma/client';
import { RevenueRecognitionService } from '../revenue-recognition.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

const unrestrictedScope = { unrestricted: true, viewableIds: [], postableIds: [] };
const fakeScope = {
  userId: 'u1',
  isSystemAdmin: false,
  entity: unrestrictedScope,
  department: unrestrictedScope,
  costCenter: unrestrictedScope,
  project: unrestrictedScope,
  businessUnit: unrestrictedScope,
} as unknown as SecurityScope;

describe('RevenueRecognitionService', () => {
  let service: RevenueRecognitionService;
  let prisma: {
    installmentLine: { findUnique: jest.Mock; update: jest.Mock };
    unit: { findUnique: jest.Mock; update: jest.Mock };
    unitSaleAllocation: { updateMany: jest.Mock };
  };
  let postingEngine: { postSystemEntry: jest.Mock };
  let rowLevelSecurity: { canAccess: jest.Mock };

  beforeEach(async () => {
    prisma = {
      installmentLine: { findUnique: jest.fn(), update: jest.fn() },
      unit: { findUnique: jest.fn(), update: jest.fn() },
      unitSaleAllocation: { updateMany: jest.fn() },
    };
    postingEngine = { postSystemEntry: jest.fn() };
    rowLevelSecurity = { canAccess: jest.fn().mockReturnValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RevenueRecognitionService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
        { provide: RowLevelSecurityService, useValue: rowLevelSecurity },
      ],
    }).compile();

    service = moduleRef.get(RevenueRecognitionService);
  });

  // Nested Unit → Floor → Block → Phase → Project chain
  // RevenueRecognitionService now resolves entityId from, instead of
  // trusting a client-supplied value (Release O follow-up fix).
  function withProjectChain(unit: { code: string }, entityId = 'entity-1') {
    return { ...unit, floor: { block: { phase: { project: { entityId } } } } };
  }

  describe('recordCustomerPayment', () => {
    const baseDto = {
      installmentLineId: 'line-1',
      amount: 1_000_000,
      entryDate: '2026-07-15',
      bankAccountGlId: 'acc-bank',
      deferredRevenueGlId: 'acc-deferred',
      systemUserId: 'system-user',
    };

    it('posts Dr Bank / Cr Deferred Revenue and updates the installment line', async () => {
      prisma.installmentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        amountDue: 1_000_000,
        amountPaid: 0,
        paidAt: null,
        schedule: {
          unitId: 'unit-1',
          customerId: 'cust-1',
          unit: withProjectChain({ code: 'A-3-12' }),
          customer: { name: 'Jane Doe' },
        },
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-1', journalNumber: '7FC-JE-2026-000010' });
      prisma.installmentLine.update.mockResolvedValue({});

      const result = await service.recordCustomerPayment(baseDto, fakeScope);

      expect(postingEngine.postSystemEntry).toHaveBeenCalledTimes(1);
      const [dto] = postingEngine.postSystemEntry.mock.calls[0];
      expect(dto.entityId).toBe('entity-1'); // derived, not client-supplied
      expect(dto.lines).toHaveLength(2);
      expect(dto.lines[0]).toMatchObject({ accountId: 'acc-bank', debit: 1_000_000, credit: 0 });
      expect(dto.lines[1]).toMatchObject({ accountId: 'acc-deferred', debit: 0, credit: 1_000_000 });

      expect(prisma.installmentLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amountPaid: 1_000_000 }),
        }),
      );
      expect(result.isFullyPaid).toBe(true);
    });

    it('rejects a payment larger than the remaining balance', async () => {
      prisma.installmentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        amountDue: 500_000,
        amountPaid: 400_000,
        schedule: {
          unitId: 'unit-1',
          customerId: 'cust-1',
          unit: withProjectChain({ code: 'A-3-12' }),
          customer: { name: 'Jane Doe' },
        },
      });

      await expect(
        service.recordCustomerPayment({ ...baseDto, amount: 200_000 }, fakeScope),
      ).rejects.toThrow(BadRequestException);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('throws if the installment line does not exist', async () => {
      prisma.installmentLine.findUnique.mockResolvedValue(null);
      await expect(service.recordCustomerPayment(baseDto, fakeScope)).rejects.toThrow(NotFoundException);
    });

    it('marks a partial payment as not fully paid', async () => {
      prisma.installmentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        amountDue: 1_000_000,
        amountPaid: 0,
        paidAt: null,
        schedule: {
          unitId: 'unit-1',
          customerId: 'cust-1',
          unit: withProjectChain({ code: 'A-3-12' }),
          customer: { name: 'Jane Doe' },
        },
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-1' });
      prisma.installmentLine.update.mockResolvedValue({});

      const result = await service.recordCustomerPayment({ ...baseDto, amount: 400_000 }, fakeScope);
      expect(result.isFullyPaid).toBe(false);
      expect(result.newAmountPaid).toBe(400_000);
    });

    // Release O follow-up — the actual defect this fix closes: a caller
    // without RLS access to the installment line's real entity must be
    // rejected (as NotFoundException, matching AR/AP/budgeting's existing
    // canAccess() convention, so as not to confirm the row's existence),
    // even though the request itself is otherwise well-formed.
    it('rejects with NotFoundException when the caller has no RLS access to the derived entity', async () => {
      prisma.installmentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        amountDue: 1_000_000,
        amountPaid: 0,
        paidAt: null,
        schedule: {
          unitId: 'unit-1',
          customerId: 'cust-1',
          unit: withProjectChain({ code: 'A-3-12' }, 'entity-forbidden'),
          customer: { name: 'Jane Doe' },
        },
      });
      rowLevelSecurity.canAccess.mockReturnValue(false);

      await expect(service.recordCustomerPayment(baseDto, fakeScope)).rejects.toThrow(NotFoundException);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });
  });

  describe('recognizeOnHandover', () => {
    const baseDto = {
      entityId: 'entity-1',
      unitId: 'unit-1',
      entryDate: '2026-07-20',
      salePrice: 250_000_000,
      costOfUnit: 150_000_000,
      deferredRevenueGlId: 'acc-deferred',
      propertySalesRevenueGlId: 'acc-revenue',
      costOfSalesGlId: 'acc-cos',
      propertyInventoryGlId: 'acc-inventory',
      systemUserId: 'system-user',
    };

    it('posts the four-line handover entry and moves the unit to HANDED_OVER', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'unit-1', code: 'A-3-12', status: UnitStatus.UNDER_CONTRACT });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-2', journalNumber: '7FC-JE-2026-000011' });
      prisma.unit.update.mockResolvedValue({});
      prisma.unitSaleAllocation.updateMany.mockResolvedValue({ count: 1 });

      await service.recognizeOnHandover(baseDto);

      const [dto] = postingEngine.postSystemEntry.mock.calls[0];
      expect(dto.lines).toHaveLength(4);
      const totalDebit = dto.lines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = dto.lines.reduce((s: number, l: any) => s + l.credit, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(prisma.unit.update).toHaveBeenCalledWith({
        where: { id: 'unit-1' },
        data: { status: UnitStatus.HANDED_OVER },
      });
    });

    it('refuses to recognize a unit that is already handed over', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'unit-1', code: 'A-3-12', status: UnitStatus.HANDED_OVER });
      await expect(service.recognizeOnHandover(baseDto)).rejects.toThrow(BadRequestException);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('throws if the unit does not exist', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);
      await expect(service.recognizeOnHandover(baseDto)).rejects.toThrow(NotFoundException);
    });
  });
});
