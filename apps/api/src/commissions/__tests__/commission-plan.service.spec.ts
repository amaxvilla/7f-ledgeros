import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommissionPlanScope, CommissionPlanStatus, CommissionPlanType } from '@prisma/client';
import { CommissionPlanService } from '../commission-plan.service';
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
    commissionPlan: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    commissionPlanTier: { deleteMany: jest.fn() },
    $transaction: jest.fn((cb: any) => cb({ commissionPlanTier: { deleteMany: jest.fn() }, commissionPlan: { update: jest.fn().mockResolvedValue({ id: 'p1' }) } })),
  };
}

const baseDto = {
  entityId: 'e1',
  code: 'CP-001',
  name: 'Standard Percentage Plan',
  type: CommissionPlanType.PERCENTAGE,
  scope: CommissionPlanScope.GLOBAL,
  effectiveFrom: '2026-01-01',
};

describe('CommissionPlanService', () => {
  let service: CommissionPlanService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [CommissionPlanService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CommissionPlanService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create — scope/target validation', () => {
    it('rejects a duplicate code with a 409', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create({ ...baseDto, rate: 2.5 }, 'creator-1')).rejects.toThrow(ConflictException);
      expect(prisma.commissionPlan.create).not.toHaveBeenCalled();
    });

    it('rejects GLOBAL scope with a target field populated', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, rate: 2.5, projectId: 'proj-1' }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects PROJECT scope with no projectId set', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, rate: 2.5, scope: CommissionPlanScope.PROJECT }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects PROJECT scope with unitId set instead of projectId', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, rate: 2.5, scope: CommissionPlanScope.PROJECT, unitId: 'u1' }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts PROJECT scope with only projectId set', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      prisma.commissionPlan.create.mockResolvedValue({ id: 'p1' });
      await service.create({ ...baseDto, rate: 2.5, scope: CommissionPlanScope.PROJECT, projectId: 'proj-1' }, 'creator-1');
      expect(prisma.commissionPlan.create).toHaveBeenCalled();
    });
  });

  describe('create — flat rate shape validation', () => {
    it('rejects a PERCENTAGE plan with fixedAmount set instead of rate', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(service.create({ ...baseDto, fixedAmount: 1000 }, 'creator-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a PERCENTAGE plan with both rate and fixedAmount set', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(service.create({ ...baseDto, rate: 2.5, fixedAmount: 1000 }, 'creator-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a FIXED plan with rate set instead of fixedAmount', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, type: CommissionPlanType.FIXED, rate: 2.5 }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-tiered plan with tiers supplied', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, rate: 2.5, tiers: [{ tierOrder: 1, minAmount: 0, rate: 1 }] }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid flat PERCENTAGE plan', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      prisma.commissionPlan.create.mockResolvedValue({ id: 'p1' });
      await service.create({ ...baseDto, rate: 2.5 }, 'creator-1');
      expect(prisma.commissionPlan.create).toHaveBeenCalled();
    });
  });

  describe('create — tiered rate shape validation', () => {
    const tieredBase = { ...baseDto, isTiered: true };

    it('rejects a tiered plan with rate set at the plan level', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...tieredBase, rate: 2.5, tiers: [{ tierOrder: 1, minAmount: 0, rate: 1 }] }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a tiered plan with no tiers', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(service.create({ ...tieredBase }, 'creator-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects tiers whose first tier does not start at minAmount 0', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ ...tieredBase, tiers: [{ tierOrder: 1, minAmount: 100, rate: 1 }] }, 'creator-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects tiers with a gap between bands', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          {
            ...tieredBase,
            tiers: [
              { tierOrder: 1, minAmount: 0, maxAmount: 100000, rate: 1 },
              { tierOrder: 2, minAmount: 150000, rate: 2 },
            ],
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-final tier with an open-ended maxAmount', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          {
            ...tieredBase,
            tiers: [
              { tierOrder: 1, minAmount: 0, rate: 1 },
              { tierOrder: 2, minAmount: 100000, rate: 2 },
            ],
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid gapless tiered PERCENTAGE schedule with an open final tier', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue(null);
      prisma.commissionPlan.create.mockResolvedValue({ id: 'p1' });
      await service.create(
        {
          ...tieredBase,
          tiers: [
            { tierOrder: 1, minAmount: 0, maxAmount: 100000, rate: 1 },
            { tierOrder: 2, minAmount: 100000, rate: 2 },
          ],
        },
        'creator-1',
      );
      expect(prisma.commissionPlan.create).toHaveBeenCalled();
    });
  });

  describe('resolvePlan', () => {
    it('checks scopes in precedence order and stops at the first match', async () => {
      prisma.commissionPlan.findFirst
        .mockResolvedValueOnce(null) // UNIT
        .mockResolvedValueOnce({ id: 'project-plan', scope: CommissionPlanScope.PROJECT }); // PROJECT

      const result = await service.resolvePlan(buildUnrestrictedScope(), {
        entityId: 'e1',
        unitId: 'u1',
        projectId: 'proj-1',
      });

      expect(result).toEqual({ id: 'project-plan', scope: CommissionPlanScope.PROJECT });
      expect(prisma.commissionPlan.findFirst).toHaveBeenCalledTimes(2);
    });

    it('returns null when nothing matches, even GLOBAL', async () => {
      prisma.commissionPlan.findFirst.mockResolvedValue(null);
      const result = await service.resolvePlan(buildUnrestrictedScope(), { entityId: 'e1' });
      expect(result).toBeNull();
      // Only GLOBAL is a candidate when no other target ids are given.
      expect(prisma.commissionPlan.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivate', () => {
    it('rejects deactivating an already-INACTIVE plan with a 409', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue({
        id: 'p1',
        status: CommissionPlanStatus.INACTIVE,
        tiers: [],
      });
      await expect(
        service.deactivate(buildUnrestrictedScope(), 'p1', { reason: 'superseded' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.commissionPlan.update).not.toHaveBeenCalled();
    });

    it('deactivates an ACTIVE plan', async () => {
      prisma.commissionPlan.findUnique.mockResolvedValue({
        id: 'p1',
        status: CommissionPlanStatus.ACTIVE,
        tiers: [],
      });
      prisma.commissionPlan.update.mockResolvedValue({ id: 'p1', status: CommissionPlanStatus.INACTIVE });
      await service.deactivate(buildUnrestrictedScope(), 'p1', { reason: 'superseded' }, 'user-1');
      expect(prisma.commissionPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ status: CommissionPlanStatus.INACTIVE, deactivatedById: 'user-1' }),
        }),
      );
    });
  });
});
