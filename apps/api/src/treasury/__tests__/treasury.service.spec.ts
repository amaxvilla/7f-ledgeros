import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LoanStatus, MaturityInstruction, PlacementStatus } from '@prisma/client';
import { TreasuryService } from '../treasury.service';
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

describe('TreasuryService', () => {
  let service: TreasuryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      bankAccount: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      cashAccount: { findMany: jest.fn(), create: jest.fn() },
      loanFacility: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      drawdown: { create: jest.fn() },
      repaymentLine: { createMany: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      interestAccrual: { create: jest.fn() },
      investmentPlacement: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [TreasuryService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(TreasuryService);
  });

  describe('createDrawdown', () => {
    it('refuses a drawdown that would exceed the facility amount', async () => {
      prisma.loanFacility.findUnique.mockResolvedValue({
        id: 'loan-1',
        facilityAmount: 1_000_000,
        status: LoanStatus.ACTIVE,
        drawdowns: [{ amount: 800_000 }],
      });

      await expect(
        service.createDrawdown({ loanFacilityId: 'loan-1', amount: 300_000, drawdownDate: '2026-07-01', createdById: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a drawdown within the undrawn balance', async () => {
      prisma.loanFacility.findUnique.mockResolvedValue({
        id: 'loan-1',
        facilityAmount: 1_000_000,
        status: LoanStatus.ACTIVE,
        drawdowns: [{ amount: 400_000 }],
      });
      prisma.drawdown.create.mockResolvedValue({ id: 'dd-1', amount: 500_000 });

      const result = await service.createDrawdown({
        loanFacilityId: 'loan-1',
        amount: 500_000,
        drawdownDate: '2026-07-01',
        createdById: 'u1',
      });
      expect(result.amount).toBe(500_000);
    });

    it('refuses a drawdown against a non-active facility', async () => {
      prisma.loanFacility.findUnique.mockResolvedValue({
        id: 'loan-1',
        facilityAmount: 1_000_000,
        status: LoanStatus.CLOSED,
        drawdowns: [],
      });
      await expect(
        service.createDrawdown({ loanFacilityId: 'loan-1', amount: 100_000, drawdownDate: '2026-07-01', createdById: 'u1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('generateRepaymentSchedule', () => {
    it('splits drawn principal evenly and computes flat interest per installment', async () => {
      prisma.loanFacility.findUnique.mockResolvedValue({
        id: 'loan-1',
        interestRatePercent: 12, // 12% annual
        drawdowns: [{ amount: 1_200_000 }],
        repaymentSchedule: [],
      });
      prisma.repaymentLine.createMany.mockResolvedValue({ count: 4 });
      prisma.repaymentLine.findMany.mockImplementation(() =>
        Promise.resolve(
          Array.from({ length: 4 }).map((_, i) => ({
            id: `line-${i}`,
            principalDue: 300_000,
            interestDue: 12_000, // 1,200,000 * (12%/12 months) = 12,000 monthly
          })),
        ),
      );

      const lines = await service.generateRepaymentSchedule({
        loanFacilityId: 'loan-1',
        numberOfInstallments: 4,
        firstDueDate: '2026-08-01',
        frequencyMonths: 1,
      });

      expect(lines).toHaveLength(4);
      expect(lines[0].principalDue).toBe(300_000);
      expect(lines[0].interestDue).toBe(12_000);
    });

    it('refuses to regenerate a schedule that already exists', async () => {
      prisma.loanFacility.findUnique.mockResolvedValue({
        id: 'loan-1',
        interestRatePercent: 12,
        drawdowns: [{ amount: 1_200_000 }],
        repaymentSchedule: [{ id: 'existing-line' }],
      });
      await expect(
        service.generateRepaymentSchedule({
          loanFacilityId: 'loan-1',
          numberOfInstallments: 4,
          firstDueDate: '2026-08-01',
          frequencyMonths: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses to schedule before any drawdown has occurred', async () => {
      prisma.loanFacility.findUnique.mockResolvedValue({
        id: 'loan-1',
        interestRatePercent: 12,
        drawdowns: [],
        repaymentSchedule: [],
      });
      await expect(
        service.generateRepaymentSchedule({
          loanFacilityId: 'loan-1',
          numberOfInstallments: 4,
          firstDueDate: '2026-08-01',
          frequencyMonths: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordRepayment', () => {
    it('marks an installment paidAt only once fully settled', async () => {
      prisma.repaymentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        principalDue: 300_000,
        interestDue: 12_000,
        principalPaid: 0,
        interestPaid: 0,
        paidAt: null,
      });
      prisma.repaymentLine.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'line-1', ...data }));

      const partial = await service.recordRepayment({
        repaymentLineId: 'line-1',
        principalPaid: 150_000,
        interestPaid: 6_000,
        paidAt: '2026-08-01',
      });
      expect(partial.paidAt).toBeNull();

      prisma.repaymentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        principalDue: 300_000,
        interestDue: 12_000,
        principalPaid: 150_000,
        interestPaid: 6_000,
        paidAt: null,
      });
      const full = await service.recordRepayment({
        repaymentLineId: 'line-1',
        principalPaid: 150_000,
        interestPaid: 6_000,
        paidAt: '2026-08-01',
      });
      expect(full.paidAt).not.toBeNull();
    });

    it('rejects a payment exceeding the amount due', async () => {
      prisma.repaymentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        principalDue: 300_000,
        interestDue: 12_000,
        principalPaid: 0,
        interestPaid: 0,
        paidAt: null,
      });
      await expect(
        service.recordRepayment({ repaymentLineId: 'line-1', principalPaid: 400_000, interestPaid: 0, paidAt: '2026-08-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to record a payment on an already-settled installment', async () => {
      prisma.repaymentLine.findUnique.mockResolvedValue({
        id: 'line-1',
        principalDue: 300_000,
        interestDue: 12_000,
        principalPaid: 300_000,
        interestPaid: 12_000,
        paidAt: new Date('2026-08-01'),
      });
      await expect(
        service.recordRepayment({ repaymentLineId: 'line-1', principalPaid: 1, interestPaid: 0, paidAt: '2026-08-01' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('processMaturity', () => {
    it('closes a PAYOUT placement to MATURED with no rollover', async () => {
      prisma.investmentPlacement.findUnique.mockResolvedValue({
        id: 'pl-1',
        status: PlacementStatus.ACTIVE,
        maturityInstruction: MaturityInstruction.PAYOUT,
      });
      prisma.investmentPlacement.update.mockResolvedValue({ id: 'pl-1', status: PlacementStatus.MATURED });

      const result = await service.processMaturity('pl-1', 50_000);
      expect(result.status).toBe(PlacementStatus.MATURED);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rolls principal + interest into a new placement on ROLLOVER_PRINCIPAL_AND_INTEREST', async () => {
      prisma.investmentPlacement.findUnique.mockResolvedValue({
        id: 'pl-1',
        entityId: 'entity-1',
        institutionName: 'Bank A',
        principalAmount: 1_000_000,
        interestRatePercent: 8,
        placementDate: new Date('2026-01-01'),
        maturityDate: new Date('2026-07-01'),
        maturityInstruction: MaturityInstruction.ROLLOVER_PRINCIPAL_AND_INTEREST,
        status: PlacementStatus.ACTIVE,
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'pl-1', status: PlacementStatus.MATURED },
        { id: 'pl-2', principalAmount: 1_050_000, status: PlacementStatus.ACTIVE },
      ]);

      const result = await service.processMaturity('pl-1', 50_000);
      expect(result.principalAmount).toBe(1_050_000);
    });

    it('refuses to mature an already-matured placement', async () => {
      prisma.investmentPlacement.findUnique.mockResolvedValue({ id: 'pl-1', status: PlacementStatus.MATURED });
      await expect(service.processMaturity('pl-1', 0)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for a missing placement', async () => {
      prisma.investmentPlacement.findUnique.mockResolvedValue(null);
      await expect(service.processMaturity('missing', 0)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('findBankAccounts scopes results to the caller\'s viewable entities', async () => {
      prisma.bankAccount.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.findBankAccounts(scope, undefined);

      expect(prisma.bankAccount.findMany).toHaveBeenCalledWith({
        where: { AND: [{ entityId: { in: ['ent-1'] } }, { entityId: undefined }] },
      });
    });

    it('findLoanFacilities scopes results to the caller\'s viewable entities', async () => {
      prisma.loanFacility.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.findLoanFacilities(scope, undefined);

      expect(prisma.loanFacility.findMany).toHaveBeenCalledWith({
        where: { AND: [{ entityId: { in: ['ent-1'] } }, { entityId: undefined }] },
        include: { drawdowns: true, repaymentSchedule: true },
      });
    });
  });
});
