import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { SuccessionCriticality, SuccessionReadiness } from '@prisma/client';
import { SuccessionService } from '../succession.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    successionPlan: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    successionCandidate: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  };
}

describe('SuccessionService', () => {
  let service: SuccessionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [SuccessionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SuccessionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('addCandidate', () => {
    it('refuses to map the same employee twice onto one plan', async () => {
      prisma.successionCandidate.findUnique.mockResolvedValue({ id: 'c1' });
      await expect(
        service.addCandidate({ successionPlanId: 'p1', employeeId: 'e1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findCoverageGaps', () => {
    it('flags CRITICAL/HIGH plans with no READY_NOW candidate', async () => {
      prisma.successionPlan.findMany.mockResolvedValue([
        {
          id: 'p1',
          positionTitle: 'CFO',
          criticality: SuccessionCriticality.CRITICAL,
          candidates: [{ readiness: SuccessionReadiness.READY_1_2_YEARS }],
        },
        {
          id: 'p2',
          positionTitle: 'CTO',
          criticality: SuccessionCriticality.HIGH,
          candidates: [{ readiness: SuccessionReadiness.READY_NOW }],
        },
      ]);

      const gaps = await service.findCoverageGaps('entity1');
      expect(gaps).toHaveLength(1);
      expect(gaps[0].positionTitle).toBe('CFO');
    });
  });
});
