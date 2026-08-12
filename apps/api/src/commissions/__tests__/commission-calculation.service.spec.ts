import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AgentAssignmentRole,
  AgentAssignmentScope,
  AgentStatus,
  CommissionBasisType,
  CommissionCalculationStatus,
  CommissionCollectionBasis,
  CommissionPlanScope,
  CommissionPlanStatus,
  CommissionPlanType,
} from '@prisma/client';
import { CommissionCalculationService } from '../commission-calculation.service';
import { CommissionPlanService } from '../commission-plan.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
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

const baseUnit = {
  id: 'unit-1',
  floor: { block: { phase: { project: { id: 'proj-1', entityId: 'e1', estateId: 'estate-1' } } } },
};

function baseAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assign-1',
    entityId: 'e1',
    agentId: 'agent-1',
    scope: AgentAssignmentScope.SALE,
    role: AgentAssignmentRole.PRIMARY,
    isActive: true,
    allocationId: 'alloc-1',
    agent: { id: 'agent-1', status: AgentStatus.ACTIVE, withholdingTaxExempt: false },
    allocation: {
      id: 'alloc-1',
      unitId: 'unit-1',
      salePrice: 1_000_000,
      isCancelled: false,
      installmentSchedule: null,
      unit: baseUnit,
    },
    ...overrides,
  };
}

const flatPercentPlan = {
  id: 'plan-1',
  type: CommissionPlanType.PERCENTAGE,
  scope: CommissionPlanScope.GLOBAL,
  status: CommissionPlanStatus.ACTIVE,
  isTiered: false,
  rate: 2.5,
  fixedAmount: null,
  tiers: [],
};

function buildPrismaMock() {
  return {
    agentAssignment: { findUnique: jest.fn() },
    commissionCalculation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taxCode: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('CommissionCalculationService', () => {
  let service: CommissionCalculationService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let plans: { resolvePlan: jest.Mock };
  let postingEngine: { postSystemEntry: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    plans = { resolvePlan: jest.fn() };
    postingEngine = { postSystemEntry: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommissionCalculationService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommissionPlanService, useValue: plans },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();
    service = moduleRef.get(CommissionCalculationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('resolveInputs validation', () => {
    it('rejects when the assignment is not found', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue(null);
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'x', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a PROJECT-scope assignment (no confirmed sale)', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue(
        baseAssignment({ scope: AgentAssignmentScope.PROJECT, allocationId: null, allocation: null }),
      );
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an ended assignment', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment({ isActive: false }));
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-ACTIVE agent', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue(
        baseAssignment({ agent: { id: 'agent-1', status: AgentStatus.SUSPENDED, withholdingTaxExempt: false } }),
      );
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a cancelled sale allocation', async () => {
      const a = baseAssignment();
      (a.allocation as any).isCancelled = true;
      prisma.agentAssignment.findUnique.mockResolvedValue(a);
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects whtTaxCodeId supplied for a withholding-tax-exempt agent', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue(
        baseAssignment({ agent: { id: 'agent-1', status: AgentStatus.ACTIVE, withholdingTaxExempt: true } }),
      );
      await expect(
        service.calculate(
          buildUnrestrictedScope(),
          { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS, whtTaxCodeId: 'tc-1' },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects no ACTIVE plan resolving for the target', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(null);
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate active calculation for the same assignment with a 409', async () => {
      prisma.commissionCalculation.findFirst.mockResolvedValue({ id: 'existing-calc', status: CommissionCalculationStatus.APPROVED });
      await expect(
        service.calculate(buildUnrestrictedScope(), { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.agentAssignment.findUnique).not.toHaveBeenCalled();
      // Widened by RE-COMM.3: not just CALCULATED — any non-terminal status blocks a second active calculation.
      expect(prisma.commissionCalculation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            agentAssignmentId: 'assign-1',
            status: {
              in: [
                CommissionCalculationStatus.CALCULATED,
                CommissionCalculationStatus.PENDING,
                CommissionCalculationStatus.APPROVED,
                CommissionCalculationStatus.PAYABLE,
                CommissionCalculationStatus.PAID,
              ],
            },
          },
        }),
      );
    });
  });

  describe('flat-rate GROSS calculation', () => {
    it('computes 2.5% of a 1,000,000 gross sale with no WHT', async () => {
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      prisma.commissionCalculation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'calc-1', ...data }));

      const result = await service.calculate(
        buildUnrestrictedScope(),
        { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS },
        'u1',
      );

      expect(result.grossCommission).toBe(25000);
      expect(result.netCommission).toBe(25000);
      expect(result.whtApplied).toBe(false);
      expect(plans.resolvePlan).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityId: 'e1', projectId: 'proj-1', estateId: 'estate-1', unitId: 'unit-1', agentId: 'agent-1', isReferral: false }),
      );
    });

    it('applies discount when basisType is NET', async () => {
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      prisma.commissionCalculation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'calc-1', ...data }));

      const result = await service.calculate(
        buildUnrestrictedScope(),
        { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.NET, discountAmount: 100000 },
        'u1',
      );

      // net sale value = 900,000; 2.5% of that = 22,500
      expect(result.netSaleValue).toBe(900000);
      expect(result.grossCommission).toBe(22500);
    });

    it('rejects a discount larger than the gross sale value', async () => {
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      await expect(
        service.calculate(
          buildUnrestrictedScope(),
          { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.NET, discountAmount: 2_000_000 },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies WHT when a tax code is supplied', async () => {
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      prisma.taxCode.findUnique.mockResolvedValue({
        id: 'tc-1',
        taxType: 'WHT',
        isActive: true,
        rate: 5,
        taxAuthorityAccountId: 'acct-authority-1',
      });
      prisma.commissionCalculation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'calc-1', ...data }));

      const result = await service.calculate(
        buildUnrestrictedScope(),
        { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS, whtTaxCodeId: 'tc-1' },
        'u1',
      );

      // gross commission 25,000; 5% WHT = 1,250; net = 23,750
      expect(result.whtApplied).toBe(true);
      expect(result.whtAmount).toBe(1250);
      expect(result.netCommission).toBe(23750);
    });
  });

  describe('tiered PERCENTAGE calculation', () => {
    it('applies each band progressively across a two-tier schedule', async () => {
      const tieredPlan = {
        ...flatPercentPlan,
        isTiered: true,
        rate: null,
        tiers: [
          { tierOrder: 1, minAmount: 0, maxAmount: 500000, rate: 1, fixedAmount: null },
          { tierOrder: 2, minAmount: 500000, maxAmount: null, rate: 2, fixedAmount: null },
        ],
      };
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(tieredPlan);
      prisma.commissionCalculation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'calc-1', ...data }));

      const result = await service.calculate(
        buildUnrestrictedScope(),
        { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS },
        'u1',
      );

      // Band 1: 500,000 * 1% = 5,000. Band 2: 500,000 * 2% = 10,000. Total = 15,000.
      expect(result.grossCommission).toBe(15000);
      expect(result.tierOrderApplied).toBe(2);
    });
  });

  describe('partial-payment (COLLECTED) proration', () => {
    it('rejects COLLECTED for a sale with no installment schedule', async () => {
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      await expect(
        service.calculate(
          buildUnrestrictedScope(),
          { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS, collectionBasis: CommissionCollectionBasis.COLLECTED },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('prorates the commission basis to the percentage actually collected', async () => {
      const a = baseAssignment();
      (a.allocation as any).installmentSchedule = {
        totalAmount: 1_000_000,
        lines: [{ amountPaid: 400000 }, { amountPaid: 200000 }],
      };
      prisma.commissionCalculation.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.findUnique.mockResolvedValue(a);
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      prisma.commissionCalculation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'calc-1', ...data }));

      const result = await service.calculate(
        buildUnrestrictedScope(),
        { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS, collectionBasis: CommissionCollectionBasis.COLLECTED },
        'u1',
      );

      // 60% collected of 1,000,000 = 600,000 prorated basis; 2.5% of that = 15,000
      expect(result.collectedPercent).toBe(0.6);
      expect(result.proratedBasisAmount).toBe(600000);
      expect(result.grossCommission).toBe(15000);
    });
  });

  describe('cancel / reverse', () => {
    it('rejects cancelling an already-REVERSED calculation with a 409', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.REVERSED,
        entityId: 'e1',
      });
      await expect(
        service.cancel(buildUnrestrictedScope(), 'calc-1', { reason: 'duplicate' }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.commissionCalculation.update).not.toHaveBeenCalled();
    });

    it('cancels a CALCULATED row', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.CALCULATED,
        entityId: 'e1',
      });
      prisma.commissionCalculation.update.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.CANCELLED });
      await service.cancel(buildUnrestrictedScope(), 'calc-1', { reason: 'duplicate' }, 'u1');
      expect(prisma.commissionCalculation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'calc-1' },
          data: expect.objectContaining({ status: CommissionCalculationStatus.CANCELLED, cancelledById: 'u1' }),
        }),
      );
    });

    it('reverses a CALCULATED row', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.CALCULATED,
        entityId: 'e1',
      });
      prisma.commissionCalculation.update.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.REVERSED });
      await service.reverse(buildUnrestrictedScope(), 'calc-1', { reason: 'sale reversed' }, 'u1');
      expect(prisma.commissionCalculation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'calc-1' },
          data: expect.objectContaining({ status: CommissionCalculationStatus.REVERSED, reversedById: 'u1' }),
        }),
      );
    });

    it('rejects reversing an already-CANCELLED calculation with a 409', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.CANCELLED,
        entityId: 'e1',
      });
      await expect(
        service.reverse(buildUnrestrictedScope(), 'calc-1', { reason: 'x' }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('cancel() also accepts PENDING (RE-COMM.3 widening) — not just CALCULATED', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.PENDING,
        entityId: 'e1',
      });
      prisma.commissionCalculation.update.mockResolvedValue({});
      await service.cancel(buildUnrestrictedScope(), 'calc-1', { reason: 'duplicate submission' }, 'u1');
      expect(prisma.commissionCalculation.update).toHaveBeenCalled();
    });

    it('cancel() rejects APPROVED — once approved, reverse is the only path out, not cancel', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.APPROVED,
        entityId: 'e1',
      });
      await expect(
        service.cancel(buildUnrestrictedScope(), 'calc-1', { reason: 'x' }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.commissionCalculation.update).not.toHaveBeenCalled();
    });

    it('reverse() allows a clawback from PAID (RE-COMM.3 widening)', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.PAID,
        entityId: 'e1',
      });
      prisma.commissionCalculation.update.mockResolvedValue({});
      await service.reverse(buildUnrestrictedScope(), 'calc-1', { reason: 'agent overpaid' }, 'u1');
      expect(prisma.commissionCalculation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: CommissionCalculationStatus.REVERSED }) }),
      );
    });
  });

  describe('RE-COMM.3 lifecycle: submit / approve / reject / markPayable / markPaid', () => {
    const scope = buildUnrestrictedScope();

    it('submit() only succeeds from CALCULATED', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.PENDING, entityId: 'e1' });
      await expect(service.submit(scope, 'calc-1', {}, 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.commissionCalculation.update).not.toHaveBeenCalled();
    });

    it('submit() moves CALCULATED -> PENDING and stamps submittedById/At', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.CALCULATED, entityId: 'e1', notes: null });
      prisma.commissionCalculation.update.mockResolvedValue({});
      await service.submit(scope, 'calc-1', {}, 'submitter-1');
      const data = prisma.commissionCalculation.update.mock.calls[0][0].data;
      expect(data.status).toBe(CommissionCalculationStatus.PENDING);
      expect(data.submittedById).toBe('submitter-1');
      expect(data.submittedAt).toBeInstanceOf(Date);
    });

    it('approve() only succeeds from PENDING', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.CALCULATED, entityId: 'e1' });
      await expect(service.approve(scope, 'calc-1', {}, 'u1')).rejects.toThrow(ConflictException);
    });

    it('approve() moves PENDING -> APPROVED and stamps approvedById/At', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.PENDING, entityId: 'e1', notes: null });
      prisma.commissionCalculation.update.mockResolvedValue({});
      await service.approve(scope, 'calc-1', {}, 'approver-1');
      const data = prisma.commissionCalculation.update.mock.calls[0][0].data;
      expect(data.status).toBe(CommissionCalculationStatus.APPROVED);
      expect(data.approvedById).toBe('approver-1');
    });

    it('reject() only succeeds from PENDING and is terminal', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.APPROVED, entityId: 'e1' });
      await expect(service.reject(scope, 'calc-1', { reason: 'x' }, 'u1')).rejects.toThrow(ConflictException);
    });

    it('reject() moves PENDING -> REJECTED with a reason', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.PENDING, entityId: 'e1' });
      prisma.commissionCalculation.update.mockResolvedValue({});
      await service.reject(scope, 'calc-1', { reason: 'wrong plan resolved' }, 'rejector-1');
      const data = prisma.commissionCalculation.update.mock.calls[0][0].data;
      expect(data.status).toBe(CommissionCalculationStatus.REJECTED);
      expect(data.rejectReason).toBe('wrong plan resolved');
      expect(data.rejectedById).toBe('rejector-1');
    });

    it('markPayable() only succeeds from APPROVED', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.PENDING, entityId: 'e1' });
      await expect(
        service.markPayable(scope, 'calc-1', { commissionExpenseAccountId: 'acc-exp', commissionPayableAccountId: 'acc-pay' }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('markPayable() posts Dr expense / Cr payable (no WHT) and records payableAccountId + payableJournalEntryId', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.APPROVED,
        entityId: 'e1',
        notes: null,
        grossCommission: 15000,
        netCommission: 15000,
        whtApplied: false,
        whtAmount: 0,
        whtAuthorityAccountId: null,
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-1' });
      prisma.commissionCalculation.update.mockResolvedValue({});

      await service.markPayable(scope, 'calc-1', { commissionExpenseAccountId: 'acc-exp', commissionPayableAccountId: 'acc-pay' }, 'u1');

      expect(postingEngine.postSystemEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'e1',
          sourceType: 'COMMISSION',
          sourceReference: 'calc-1',
          lines: [
            { accountId: 'acc-exp', debit: 15000, credit: 0 },
            { accountId: 'acc-pay', debit: 0, credit: 15000 },
          ],
        }),
        'u1',
      );
      const data = prisma.commissionCalculation.update.mock.calls[0][0].data;
      expect(data.status).toBe(CommissionCalculationStatus.PAYABLE);
      expect(data.payableAccountId).toBe('acc-pay');
      expect(data.payableJournalEntryId).toBe('je-1');
    });

    it('markPayable() adds a WHT credit line when the calculation has whtApplied', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.APPROVED,
        entityId: 'e1',
        notes: null,
        grossCommission: 15000,
        netCommission: 13500,
        whtApplied: true,
        whtAmount: 1500,
        whtAuthorityAccountId: 'acc-wht',
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-2' });
      prisma.commissionCalculation.update.mockResolvedValue({});

      await service.markPayable(scope, 'calc-1', { commissionExpenseAccountId: 'acc-exp', commissionPayableAccountId: 'acc-pay' }, 'u1');

      expect(postingEngine.postSystemEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            { accountId: 'acc-exp', debit: 15000, credit: 0 },
            { accountId: 'acc-wht', debit: 0, credit: 1500 },
            { accountId: 'acc-pay', debit: 0, credit: 13500 },
          ],
        }),
        'u1',
      );
    });

    it('markPaid() only succeeds from PAYABLE', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.APPROVED, entityId: 'e1' });
      await expect(
        service.markPaid(scope, 'calc-1', { cashAccountId: 'acc-cash', paymentReference: 'TXN-1' }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('markPaid() rejects if the row somehow has no payableAccountId on record (defensive guard)', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.PAYABLE,
        entityId: 'e1',
        payableAccountId: null,
      });
      await expect(
        service.markPaid(scope, 'calc-1', { cashAccountId: 'acc-cash', paymentReference: 'TXN-1' }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('markPaid() posts Dr the recorded payable account / Cr cash, and moves PAYABLE -> PAID', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({
        id: 'calc-1',
        status: CommissionCalculationStatus.PAYABLE,
        entityId: 'e1',
        netCommission: 13500,
        payableAccountId: 'acc-pay',
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-3' });
      prisma.commissionCalculation.update.mockResolvedValue({});

      await service.markPaid(scope, 'calc-1', { cashAccountId: 'acc-cash', paymentReference: 'TXN-42' }, 'payer-1');

      expect(postingEngine.postSystemEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            { accountId: 'acc-pay', debit: 13500, credit: 0 },
            { accountId: 'acc-cash', debit: 0, credit: 13500 },
          ],
        }),
        'payer-1',
      );
      const data = prisma.commissionCalculation.update.mock.calls[0][0].data;
      expect(data.status).toBe(CommissionCalculationStatus.PAID);
      expect(data.paymentReference).toBe('TXN-42');
      expect(data.paidById).toBe('payer-1');
      expect(data.paymentJournalEntryId).toBe('je-3');
    });
  });

  describe('RE-COMM.3 adjust (reverse-and-recalculate)', () => {
    const scope = buildUnrestrictedScope();

    it('rejects adjusting an already-terminal calculation', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.CANCELLED, entityId: 'e1' });
      await expect(
        service.adjust(scope, 'calc-1', { reason: 'x', recalculate: { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS } }, 'u1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reverses the old row and creates a new one linked via supersedesCalculationId, atomically', async () => {
      prisma.commissionCalculation.findUnique.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.APPROVED, entityId: 'e1' });
      prisma.agentAssignment.findUnique.mockResolvedValue(baseAssignment());
      plans.resolvePlan.mockResolvedValue(flatPercentPlan);
      prisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
      prisma.commissionCalculation.update.mockResolvedValue({ id: 'calc-1', status: CommissionCalculationStatus.REVERSED });
      prisma.commissionCalculation.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'calc-2', ...data }));

      const result = await service.adjust(
        scope,
        'calc-1',
        { reason: 'wrong discount applied originally', recalculate: { agentAssignmentId: 'assign-1', basisType: CommissionBasisType.GROSS } },
        'adjuster-1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.commissionCalculation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'calc-1' },
          data: expect.objectContaining({ status: CommissionCalculationStatus.REVERSED, reverseReason: 'wrong discount applied originally' }),
        }),
      );
      expect(result.supersedesCalculationId).toBe('calc-1');
      expect(result.calculatedById).toBe('adjuster-1');
    });
  });
});
