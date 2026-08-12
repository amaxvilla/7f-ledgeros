import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommissionCalculationStatus } from '@prisma/client';
import { CommissionReportingService } from '../commission-reporting.service';
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
    commissionCalculation: { groupBy: jest.fn(), findMany: jest.fn() },
    agent: { findUnique: jest.fn() },
  };
}

const unit = {
  code: 'A-3-12',
  floor: { block: { phase: { project: { id: 'proj-1', code: 'PRJ-1' } } } },
};

describe('CommissionReportingService', () => {
  let service: CommissionReportingService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommissionReportingService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CommissionReportingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSummary', () => {
    it('derives earned/approved/payable/paid/outstanding from a single groupBy', async () => {
      prisma.commissionCalculation.groupBy.mockResolvedValue([
        { status: CommissionCalculationStatus.APPROVED, _sum: { netCommission: 1000, grossCommission: 1100 }, _count: 2 },
        { status: CommissionCalculationStatus.PAYABLE, _sum: { netCommission: 500, grossCommission: 550 }, _count: 1 },
        { status: CommissionCalculationStatus.PAID, _sum: { netCommission: 2000, grossCommission: 2200 }, _count: 3 },
        { status: CommissionCalculationStatus.REJECTED, _sum: { netCommission: 300, grossCommission: 330 }, _count: 1 },
      ]);

      const result = await service.getSummary(buildUnrestrictedScope(), 'e1');

      expect(result.approved).toBe(1000);
      expect(result.payable).toBe(500);
      expect(result.paid).toBe(2000);
      expect(result.outstanding).toBe(1500); // approved + payable
      // earned = CALCULATED+PENDING+APPROVED+PAYABLE+PAID, REJECTED excluded
      expect(result.earned).toBe(1000 + 500 + 2000);
    });

    it('returns zeros when there are no calculations at all', async () => {
      prisma.commissionCalculation.groupBy.mockResolvedValue([]);
      const result = await service.getSummary(buildUnrestrictedScope());
      expect(result).toMatchObject({ earned: 0, approved: 0, payable: 0, paid: 0, outstanding: 0 });
    });
  });

  describe('getByAgent', () => {
    it('aggregates earned/paid/outstanding per agent, sorted by earned descending', async () => {
      prisma.commissionCalculation.findMany.mockResolvedValue([
        { agentId: 'agent-1', status: CommissionCalculationStatus.PAID, netCommission: 100, agent: { code: 'AG-1', displayName: 'Agent One' } },
        { agentId: 'agent-1', status: CommissionCalculationStatus.APPROVED, netCommission: 50, agent: { code: 'AG-1', displayName: 'Agent One' } },
        { agentId: 'agent-2', status: CommissionCalculationStatus.PAYABLE, netCommission: 400, agent: { code: 'AG-2', displayName: 'Agent Two' } },
      ]);

      const result = await service.getByAgent(buildUnrestrictedScope(), 'e1');

      expect(result).toEqual([
        { agentId: 'agent-2', agentCode: 'AG-2', agentName: 'Agent Two', earned: 400, paid: 0, outstanding: 400, count: 1 },
        { agentId: 'agent-1', agentCode: 'AG-1', agentName: 'Agent One', earned: 150, paid: 100, outstanding: 50, count: 2 },
      ]);
    });
  });

  describe('getByProject', () => {
    it('rolls up through the allocation -> unit -> floor -> block -> phase -> project chain, nesting per-unit totals', async () => {
      prisma.commissionCalculation.findMany.mockResolvedValue([
        { status: CommissionCalculationStatus.PAID, netCommission: 100, allocation: { unitId: 'unit-1', unit } },
        { status: CommissionCalculationStatus.PAYABLE, netCommission: 50, allocation: { unitId: 'unit-1', unit } },
      ]);

      const result = await service.getByProject(buildUnrestrictedScope(), 'e1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ projectId: 'proj-1', projectCode: 'PRJ-1', earned: 150, paid: 100, outstanding: 50, count: 2 });
      expect(result[0].units).toEqual([{ unitId: 'unit-1', unitCode: 'A-3-12', earned: 150, paid: 100, outstanding: 50, count: 2 }]);
    });
  });

  describe('getAging', () => {
    it('buckets PAYABLE calculations by days since markedPayableAt', async () => {
      const now = Date.now();
      prisma.commissionCalculation.findMany.mockResolvedValue([
        { id: 'c1', agentId: 'agent-1', netCommission: 100, markedPayableAt: new Date(now - 5 * 86_400_000), agent: { code: 'AG-1', displayName: 'Agent One' } },
        { id: 'c2', agentId: 'agent-1', netCommission: 200, markedPayableAt: new Date(now - 95 * 86_400_000), agent: { code: 'AG-1', displayName: 'Agent One' } },
      ]);

      const result = await service.getAging(buildUnrestrictedScope(), 'e1');

      expect(result.rows[0].bucket).toBe('1-30');
      expect(result.rows[1].bucket).toBe('90+');
      expect(result.totals['1-30']).toBe(100);
      expect(result.totals['90+']).toBe(200);
    });
  });

  describe('getForecast', () => {
    it('groups the unpaid pipeline by lifecycle stage, nearest-to-payment first', async () => {
      prisma.commissionCalculation.groupBy.mockResolvedValue([
        { status: CommissionCalculationStatus.PAYABLE, _sum: { netCommission: 500 }, _count: 1 },
        { status: CommissionCalculationStatus.PENDING, _sum: { netCommission: 200 }, _count: 2 },
      ]);

      const result = await service.getForecast(buildUnrestrictedScope(), 'e1');

      expect(result.pipeline.map((p) => p.status)).toEqual([
        CommissionCalculationStatus.PAYABLE,
        CommissionCalculationStatus.APPROVED,
        CommissionCalculationStatus.PENDING,
        CommissionCalculationStatus.CALCULATED,
      ]);
      expect(result.pipeline[0].amount).toBe(500);
      expect(result.pipeline[1].amount).toBe(0);
      expect(result.totalUnpaid).toBe(700);
    });
  });

  describe('getAgentStatement', () => {
    it('throws NotFound when the agent does not exist', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);
      await expect(service.getAgentStatement(buildUnrestrictedScope(), 'agent-x')).rejects.toThrow(NotFoundException);
    });

    it('returns the agent, its summary totals, and its calculations newest-first', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', code: 'AG-1', displayName: 'Agent One', entityId: 'e1' });
      prisma.commissionCalculation.findMany.mockResolvedValue([
        { id: 'c2', status: CommissionCalculationStatus.PAID, netCommission: 100, calculatedAt: new Date('2026-02-01') },
        { id: 'c1', status: CommissionCalculationStatus.APPROVED, netCommission: 50, calculatedAt: new Date('2026-01-01') },
        { id: 'c0', status: CommissionCalculationStatus.REJECTED, netCommission: 999, calculatedAt: new Date('2025-01-01') },
      ]);

      const result = await service.getAgentStatement(buildUnrestrictedScope(), 'agent-1');

      expect(result.agent.code).toBe('AG-1');
      expect(result.summary).toEqual({ earned: 150, approved: 50, payable: 0, paid: 100, outstanding: 50 });
      expect(result.calculations).toHaveLength(3); // REJECTED still listed in the statement itself, just excluded from summary totals
    });
  });
});
