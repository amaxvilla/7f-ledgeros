import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReconciliationSessionStatus } from '@prisma/client';
import { BankReconciliationService } from '../bank-reconciliation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';

function buildPrismaMock() {
  return {
    bankAccount: { findUnique: jest.fn() },
    bankStatement: { findUnique: jest.fn(), create: jest.fn() },
    bankStatementLine: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    reconciliationSession: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    reconciliationMatch: { findMany: jest.fn(), create: jest.fn() },
    journalLine: { findMany: jest.fn(), findUnique: jest.fn() },
  };
}

describe('BankReconciliationService', () => {
  let service: BankReconciliationService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let postingEngine: { postSystemEntry: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    postingEngine = { postSystemEntry: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BankReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = moduleRef.get(BankReconciliationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('autoMatch', () => {
    it('matches a deposit statement line to a same-amount journal debit within the date window', async () => {
      prisma.reconciliationSession.findUnique.mockResolvedValue({
        id: 's1',
        status: ReconciliationSessionStatus.DRAFT,
        statementId: 'stmt1',
        entityId: 'e1',
        bankGlAccountId: 'bank-gl',
      });
      prisma.bankStatementLine.findMany.mockResolvedValue([
        { id: 'line1', transactionDate: new Date('2026-02-05'), amount: 1000, isMatched: false },
      ]);
      prisma.journalLine.findMany.mockResolvedValue([
        {
          id: 'jl1',
          debit: 1000,
          credit: 0,
          journalEntry: { entryDate: new Date('2026-02-06') },
        },
      ]);
      prisma.reconciliationMatch.findMany.mockResolvedValue([]);
      prisma.reconciliationMatch.create.mockResolvedValue({});
      prisma.bankStatementLine.update.mockResolvedValue({});

      const result = await service.autoMatch('s1', 'u1');

      expect(result.matchedCount).toBe(1);
      expect(prisma.reconciliationMatch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ bankStatementLineId: 'line1', journalLineId: 'jl1' }) }),
      );
      expect(prisma.bankStatementLine.update).toHaveBeenCalledWith({ where: { id: 'line1' }, data: { isMatched: true } });
    });

    it('leaves a line unmatched when no journal line falls within the date window', async () => {
      prisma.reconciliationSession.findUnique.mockResolvedValue({
        id: 's1',
        status: ReconciliationSessionStatus.DRAFT,
        statementId: 'stmt1',
        entityId: 'e1',
        bankGlAccountId: 'bank-gl',
      });
      prisma.bankStatementLine.findMany.mockResolvedValue([
        { id: 'line1', transactionDate: new Date('2026-02-05'), amount: 1000, isMatched: false },
      ]);
      prisma.journalLine.findMany.mockResolvedValue([
        { id: 'jl1', debit: 1000, credit: 0, journalEntry: { entryDate: new Date('2026-03-01') } },
      ]);
      prisma.reconciliationMatch.findMany.mockResolvedValue([]);

      const result = await service.autoMatch('s1', 'u1');
      expect(result.matchedCount).toBe(0);
      expect(prisma.reconciliationMatch.create).not.toHaveBeenCalled();
    });
  });

  describe('recordAdjustment', () => {
    it('rejects a bank-charge adjustment against a deposit (positive) line', async () => {
      prisma.reconciliationSession.findUnique.mockResolvedValue({
        id: 's1',
        status: ReconciliationSessionStatus.DRAFT,
        entityId: 'e1',
        statementId: 'stmt1',
        bankGlAccountId: 'bank-gl',
      });
      prisma.bankStatementLine.findUnique.mockResolvedValue({
        id: 'line1',
        statementId: 'stmt1',
        amount: 1000,
        isMatched: false,
        description: 'Deposit',
        transactionDate: new Date('2026-02-05'),
      });

      await expect(
        service.recordAdjustment(
          's1',
          { bankStatementLineId: 'line1', adjustmentType: 'BANK_CHARGE', contraAccountId: 'expense-acct' } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('posts Dr bank / Cr income for an interest-income adjustment and matches the line', async () => {
      prisma.reconciliationSession.findUnique.mockResolvedValue({
        id: 's1',
        status: ReconciliationSessionStatus.DRAFT,
        entityId: 'e1',
        statementId: 'stmt1',
        bankGlAccountId: 'bank-gl',
      });
      prisma.bankStatementLine.findUnique.mockResolvedValue({
        id: 'line1',
        statementId: 'stmt1',
        amount: 50,
        isMatched: false,
        description: 'Interest',
        transactionDate: new Date('2026-02-05'),
      });
      postingEngine.postSystemEntry.mockResolvedValue({
        id: 'je1',
        lines: [
          { id: 'jl-bank', accountId: 'bank-gl' },
          { id: 'jl-income', accountId: 'income-acct' },
        ],
      });
      prisma.reconciliationMatch.create.mockResolvedValue({ id: 'match1' });
      prisma.bankStatementLine.update.mockResolvedValue({});

      await service.recordAdjustment(
        's1',
        { bankStatementLineId: 'line1', adjustmentType: 'INTEREST_INCOME', contraAccountId: 'income-acct' } as any,
        'u1',
      );

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual([
        { accountId: 'bank-gl', debit: 50, credit: 0 },
        { accountId: 'income-acct', debit: 0, credit: 50 },
      ]);
      expect(prisma.reconciliationMatch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ journalLineId: 'jl-bank' }) }),
      );
    });
  });

  describe('approveSession', () => {
    it('rejects approval while unmatched statement lines remain', async () => {
      prisma.reconciliationSession.findUnique.mockResolvedValue({
        id: 's1',
        status: ReconciliationSessionStatus.DRAFT,
        createdById: 'u1',
        statement: { lines: [{ isMatched: false }] },
      });
      await expect(service.approveSession('s1', 'u2')).rejects.toThrow(BadRequestException);
    });

    it('rejects the preparer approving their own session', async () => {
      prisma.reconciliationSession.findUnique.mockResolvedValue({
        id: 's1',
        status: ReconciliationSessionStatus.DRAFT,
        createdById: 'u1',
        statement: { lines: [] },
      });
      await expect(service.approveSession('s1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });
});
