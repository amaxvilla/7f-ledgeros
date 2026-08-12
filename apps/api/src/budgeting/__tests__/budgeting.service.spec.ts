import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountType, BudgetCommitmentStatus, BudgetStatus } from '@prisma/client';
import { BudgetingService } from '../budgeting.service';
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

function buildPrismaMock() {
  return {
    entity: { findUnique: jest.fn() },
    entityAccount: { findMany: jest.fn() },
    budget: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    budgetLine: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    budgetRevision: { findFirst: jest.fn(), create: jest.fn() },
    budgetTransfer: { create: jest.fn() },
    budgetApproval: { create: jest.fn() },
    budgetCommitment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    journalLine: { aggregate: jest.fn() },
    account: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('BudgetingService', () => {
  let service: BudgetingService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [BudgetingService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BudgetingService);
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  afterEach(() => jest.clearAllMocks());

  describe('createBudget', () => {
    it('rejects a budget referencing an inactive or unknown entity', async () => {
      prisma.entity.findUnique.mockResolvedValue(null);
      await expect(
        service.createBudget(
          { entityId: 'e1', code: 'FY26', name: 'FY26 Budget', fiscalYear: 2026, lines: [{ accountId: 'a1', period: 1, amount: 100 }] } as any,
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects lines that reference accounts not activated for the entity', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.budget.findUnique.mockResolvedValue(null);
      prisma.entityAccount.findMany.mockResolvedValue([]); // none activated

      await expect(
        service.createBudget(
          { entityId: 'e1', code: 'FY26', name: 'FY26 Budget', fiscalYear: 2026, lines: [{ accountId: 'a1', period: 1, amount: 100 }] } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a budget with lines seeded at originalAmount = revisedAmount', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.budget.findUnique.mockResolvedValue(null);
      prisma.entityAccount.findMany.mockResolvedValue([{ entityId: 'e1', accountId: 'a1', isActive: true }]);
      prisma.budget.create.mockImplementation(({ data }: any) => ({ id: 'b1', ...data }));

      const result: any = await service.createBudget(
        {
          entityId: 'e1',
          code: 'FY26',
          name: 'FY26 Budget',
          fiscalYear: 2026,
          lines: [{ accountId: 'a1', period: 1, amount: 500_000 }],
        } as any,
        'u1',
      );

      expect(result.status).toBe(BudgetStatus.DRAFT);
      expect(prisma.budget.create).toHaveBeenCalled();
    });
  });

  describe('workflow transitions', () => {
    it('refuses to submit an already-approved budget', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', status: BudgetStatus.APPROVED });
      await expect(service.submit('b1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('refuses self-approval by the preparer', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', status: BudgetStatus.SUBMITTED, createdById: 'u1' });
      await expect(service.approve('b1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('approves a submitted budget created by someone else and stamps frozenAt', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', status: BudgetStatus.SUBMITTED, createdById: 'preparer' });
      prisma.budget.update.mockImplementation(({ data }: any) => ({ id: 'b1', ...data }));

      const result: any = await service.approve('b1', 'approver');
      expect(result.status).toBe(BudgetStatus.APPROVED);
      expect(result.frozenAt).toBeInstanceOf(Date);
      expect(prisma.budgetApproval.create).toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('refuses a transfer that exceeds the source line\'s available budget', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', status: BudgetStatus.APPROVED });
      prisma.budgetLine.findFirst
        .mockResolvedValueOnce({ id: 'line-from', budgetId: 'b1' })
        .mockResolvedValueOnce({ id: 'line-to', budgetId: 'b1' });
      // getAvailableForLine internals:
      prisma.budgetLine.findUnique.mockResolvedValue({
        id: 'line-from',
        revisedAmount: 100_000,
        budget: { entityId: 'e1', fiscalYear: 2026 },
        account: { accountType: AccountType.EXPENSE },
        period: 1,
        projectId: null,
        phaseId: null,
        departmentId: null,
        costCenterId: null,
        fundingSourceId: null,
        accountId: 'a1',
      });
      prisma.journalLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 0 } });
      prisma.budgetCommitment.findMany.mockResolvedValue([]);

      await expect(
        service.transfer('b1', { fromLineId: 'line-from', toLineId: 'line-to', amount: 200_000, reason: 'test' }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('commitments', () => {
    it('refuses a commitment against a non-approved budget', async () => {
      prisma.budgetLine.findUnique.mockResolvedValue({ id: 'line-1', budget: { status: BudgetStatus.DRAFT } });
      await expect(
        service.createCommitment({ budgetLineId: 'line-1', amount: 1000 } as any, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses to release more than remains open on a commitment', async () => {
      prisma.budgetCommitment.findUnique.mockResolvedValue({
        id: 'c1',
        amount: 1000,
        releasedAmount: 800,
        status: BudgetCommitmentStatus.PARTIALLY_RELEASED,
      });
      await expect(service.releaseCommitment('c1', 500)).rejects.toThrow(BadRequestException);
    });

    it('marks a commitment fully RELEASED once the released amount reaches its total', async () => {
      prisma.budgetCommitment.findUnique.mockResolvedValue({
        id: 'c1',
        amount: 1000,
        releasedAmount: 800,
        status: BudgetCommitmentStatus.PARTIALLY_RELEASED,
      });
      prisma.budgetCommitment.update.mockImplementation(({ data }: any) => ({ id: 'c1', ...data }));

      const result: any = await service.releaseCommitment('c1', 200);
      expect(result.status).toBe(BudgetCommitmentStatus.RELEASED);
    });
  });

  describe('variance — actual sign convention', () => {
    it('computes actual as debit-minus-credit for an EXPENSE account', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'b1',
        entityId: 'e1',
        fiscalYear: 2026,
        lines: [
          {
            id: 'line-1',
            accountId: 'a1',
            projectId: null,
            phaseId: null,
            departmentId: null,
            costCenterId: null,
            fundingSourceId: null,
            period: 3,
            originalAmount: 100_000,
            revisedAmount: 100_000,
            account: { id: 'a1', code: '5000', name: 'Office Rent', accountType: AccountType.EXPENSE },
            project: null,
            phase: null,
            department: null,
            costCenter: null,
            fundingSource: null,
          },
        ],
      });
      prisma.journalLine.aggregate.mockResolvedValue({ _sum: { debit: 60_000, credit: 0 } });
      prisma.budgetCommitment.findMany.mockResolvedValue([{ amount: 10_000, releasedAmount: 0 }]);

      const result = await service.variance('b1');
      expect(result.lines[0].actual).toBe(60_000);
      expect(result.lines[0].committed).toBe(10_000);
      expect(result.lines[0].available).toBe(30_000); // 100,000 - 60,000 - 10,000
    });

    it('computes actual as credit-minus-debit for a REVENUE account', async () => {
      prisma.budget.findUnique.mockResolvedValue({
        id: 'b1',
        entityId: 'e1',
        fiscalYear: 2026,
        lines: [
          {
            id: 'line-2',
            accountId: 'a2',
            projectId: null,
            phaseId: null,
            departmentId: null,
            costCenterId: null,
            fundingSourceId: null,
            period: 3,
            originalAmount: 500_000,
            revisedAmount: 500_000,
            account: { id: 'a2', code: '4000', name: 'Unit Sales Revenue', accountType: AccountType.REVENUE },
            project: null,
            phase: null,
            department: null,
            costCenter: null,
            fundingSource: null,
          },
        ],
      });
      prisma.journalLine.aggregate.mockResolvedValue({ _sum: { debit: 0, credit: 300_000 } });
      prisma.budgetCommitment.findMany.mockResolvedValue([]);

      const result = await service.variance('b1');
      expect(result.lines[0].actual).toBe(300_000);
      expect(result.lines[0].available).toBe(200_000);
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('findAll scopes results to the caller\'s viewable entities', async () => {
      prisma.budget.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: ['ent-1'] },
      };

      await service.findAll(scope, {});

      expect(prisma.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ entityId: { in: ['ent-1'] } }, expect.any(Object)] },
        }),
      );
    });

    it('findOne 404s (rather than 403s, to avoid confirming existence) when the budget is outside the caller\'s entity scope', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', entityId: 'ent-2', lines: [] });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: ['ent-1'] },
      };

      await expect(service.findOne('b1', scope)).rejects.toThrow(NotFoundException);
    });

    it('findOne succeeds when the budget entity is in the caller\'s viewable set', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', entityId: 'ent-1', lines: [] });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      const result = await service.findOne('b1', scope);
      expect(result.id).toBe('b1');
    });
  });
});
