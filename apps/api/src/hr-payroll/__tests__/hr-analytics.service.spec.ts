import { HrAnalyticsService } from '../hr-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Test } from '@nestjs/testing';

function buildPrismaMock() {
  return {
    employee: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employeeExit: {
      count: jest.fn(),
    },
    leaveBalance: {
      findMany: jest.fn(),
    },
    attendanceRecord: {
      findMany: jest.fn(),
    },
    jobApplication: {
      findMany: jest.fn(),
    },
    vacancy: {
      findMany: jest.fn(),
    },
    trainingEnrollment: {
      findMany: jest.fn(),
    },
  };
}

describe('HrAnalyticsService', () => {
  let service: HrAnalyticsService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        HrAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(HrAnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('headcountReport', () => {
    it('groups active employees by department, type and gender', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          departmentId: 'd1',
          employmentType: 'FULL_TIME',
          employmentStatus: 'CONFIRMED',
          gender: 'MALE',
          department: { name: 'Finance' },
        },
        {
          departmentId: 'd2',
          employmentType: 'CONTRACT',
          employmentStatus: 'CONFIRMED',
          gender: null,
          department: null,
        },
      ]);

      await expect(service.headcountReport('entity-1')).resolves.toEqual({
        totalHeadcount: 2,
        byDepartment: {
          Finance: 1,
          Unassigned: 1,
        },
        byEmploymentType: {
          FULL_TIME: 1,
          CONTRACT: 1,
        },
        byGender: {
          MALE: 1,
          UNSPECIFIED: 1,
        },
      });
    });
  });

  describe('turnoverReport', () => {
    it('calculates turnover from exits and average headcount', async () => {
      prisma.employeeExit.count.mockResolvedValue(3);
      prisma.employee.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(30);

      const result = await service.turnoverReport(
        'entity-1',
        '2026-01-01',
        '2026-12-31',
      );

      expect(result.exits).toBe(3);
      expect(result.averageHeadcount).toBe(25);
      expect(result.turnoverRatePercent).toBe(12);
    });
  });

  describe('leaveUtilizationReport', () => {
    it('aggregates entitlement and usage by leave type', async () => {
      prisma.leaveBalance.findMany.mockResolvedValue([
        {
          leaveType: { name: 'Annual Leave' },
          entitledDays: 20,
          carriedForwardDays: 5,
          usedDays: 10,
        },
        {
          leaveType: { name: 'Annual Leave' },
          entitledDays: 10,
          carriedForwardDays: 0,
          usedDays: 5,
        },
      ]);

      await expect(
        service.leaveUtilizationReport('entity-1', 2026),
      ).resolves.toEqual([
        {
          leaveType: 'Annual Leave',
          entitledDays: 35,
          usedDays: 15,
          utilizationPercent: 42.86,
        },
      ]);
    });
  });

  describe('attendanceSummaryReport', () => {
    it('calculates present, late and absent rates', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { status: 'PRESENT' },
        { status: 'PRESENT' },
        { status: 'LATE' },
        { status: 'ABSENT' },
      ]);

      const result = await service.attendanceSummaryReport(
        'entity-1',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totalRecords).toBe(4);
      expect(result.counts.PRESENT).toBe(2);
      expect(result.counts.LATE).toBe(1);
      expect(result.counts.ABSENT).toBe(1);
      expect(result.presentRatePercent).toBe(50);
      expect(result.lateRatePercent).toBe(25);
      expect(result.absentRatePercent).toBe(25);
    });
  });

  describe('hiringFunnelReport', () => {
    it('counts applications by stage and calculates hire rate', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([
        { stage: 'APPLIED' },
        { stage: 'SCREENING' },
        { stage: 'HIRED' },
        { stage: 'REJECTED' },
      ]);

      const result = await service.hiringFunnelReport('entity-1');

      expect(result.totalApplications).toBe(4);
      expect(result.byStage.APPLIED).toBe(1);
      expect(result.byStage.SCREENING).toBe(1);
      expect(result.byStage.HIRED).toBe(1);
      expect(result.byStage.REJECTED).toBe(1);
      expect(result.hireRatePercent).toBe(25);
    });
  });

  describe('payrollCostReport', () => {
    it('sums salary structure components by department', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          salaryStructure: {
            basicSalary: 100000,
            housingAllowance: 20000,
            transportAllowance: 10000,
            otherAllowances: 5000,
          },
          department: { name: 'Finance' },
        },
        {
          salaryStructure: {
            basicSalary: 200000,
            housingAllowance: 30000,
            transportAllowance: 15000,
            otherAllowances: 5000,
          },
          department: { name: 'HR' },
        },
        {
          salaryStructure: null,
          department: null,
        },
      ]);

      await expect(service.payrollCostReport('entity-1')).resolves.toEqual({
        headcountCosted: 3,
        totalMonthlyPayrollCost: 385000,
        byDepartment: {
          Finance: 135000,
          HR: 250000,
          Unassigned: 0,
        },
      });
    });
  });

  describe('trainingCompletionReport', () => {
    it('calculates attended completion rate', async () => {
      prisma.trainingEnrollment.findMany.mockResolvedValue([
        { status: 'ATTENDED' },
        { status: 'ATTENDED' },
        { status: 'ENROLLED' },
        { status: 'CANCELLED' },
      ]);

      await expect(
        service.trainingCompletionReport('entity-1'),
      ).resolves.toEqual({
        totalEnrollments: 4,
        attended: 2,
        completionRatePercent: 50,
      });
    });
  });

  describe('zero-data handling', () => {
    it('returns zero rates when there are no attendance records', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([]);

      const result = await service.attendanceSummaryReport(
        'entity-1',
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totalRecords).toBe(0);
      expect(result.presentRatePercent).toBe(0);
      expect(result.lateRatePercent).toBe(0);
      expect(result.absentRatePercent).toBe(0);
    });

    it('returns zero training completion when there are no enrollments', async () => {
      prisma.trainingEnrollment.findMany.mockResolvedValue([]);

      await expect(
        service.trainingCompletionReport('entity-1'),
      ).resolves.toEqual({
        totalEnrollments: 0,
        attended: 0,
        completionRatePercent: 0,
      });
    });
  });
});
