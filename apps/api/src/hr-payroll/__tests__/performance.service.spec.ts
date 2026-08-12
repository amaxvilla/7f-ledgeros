import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PerformanceService } from '../performance.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    performanceCycle: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    performanceReview: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    employee: { findUnique: jest.fn() },
  };
}

describe('PerformanceService', () => {
  let service: PerformanceService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [PerformanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PerformanceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('calibrateReview', () => {
    it('refuses out-of-range ratings', async () => {
      await expect(service.calibrateReview('r1', 6)).rejects.toThrow(BadRequestException);
    });

    it('refuses to calibrate before a manager rating exists', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue({ id: 'r1', managerRating: null });
      await expect(service.calibrateReview('r1', 4)).rejects.toThrow(ConflictException);
    });

    it('calibrates once a manager rating exists', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue({ id: 'r1', managerRating: 3.5 });
      prisma.performanceReview.update.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));
      const result: any = await service.calibrateReview('r1', 4);
      expect(result.status).toBe('CALIBRATED');
    });
  });

  describe('completeReview', () => {
    it('refuses to complete before calibration', async () => {
      prisma.performanceReview.findUnique.mockResolvedValue({ id: 'r1', calibratedRating: null });
      await expect(service.completeReview('r1')).rejects.toThrow(ConflictException);
    });
  });

  describe('closeCycle', () => {
    it('refuses to close while reviews remain incomplete', async () => {
      prisma.performanceCycle.findUnique.mockResolvedValue({ id: 'c1', status: 'CALIBRATION' });
      prisma.performanceReview.count.mockResolvedValue(2);
      await expect(service.closeCycle('c1')).rejects.toThrow(ConflictException);
    });

    it('closes once every review is COMPLETED', async () => {
      prisma.performanceCycle.findUnique.mockResolvedValue({ id: 'c1', status: 'CALIBRATION' });
      prisma.performanceReview.count.mockResolvedValue(0);
      prisma.performanceCycle.update.mockImplementation(({ data }: any) => ({ id: 'c1', ...data }));
      const result: any = await service.closeCycle('c1');
      expect(result.status).toBe('CLOSED');
    });
  });

  describe('submitSelfAssessment', () => {
    it('refuses when the employee has no manager set', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1', reportsToId: null });
      await expect(
        service.submitSelfAssessment({ employeeId: 'e1', cycleId: 'c1', selfRating: 4 }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
