import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeaveRequestStatus } from '@prisma/client';
import { LeaveService } from '../leave.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    leaveType: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    leaveBalance: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    leaveRequest: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    attendanceRecord: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [LeaveService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LeaveService);
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  afterEach(() => jest.clearAllMocks());

  describe('requestLeave', () => {
    it('rejects an end date before the start date', async () => {
      await expect(
        service.requestLeave({ employeeId: 'e1', leaveTypeId: 'lt1', startDate: '2026-06-10', endDate: '2026-06-05' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a request that exceeds the available balance', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue({ entitledDays: 5, usedDays: 3, carriedForwardDays: 0 });
      await expect(
        service.requestLeave({ employeeId: 'e1', leaveTypeId: 'lt1', startDate: '2026-06-01', endDate: '2026-06-05' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a SUBMITTED request when balance covers it', async () => {
      prisma.leaveBalance.findUnique.mockResolvedValue({ entitledDays: 21, usedDays: 0, carriedForwardDays: 0 });
      prisma.leaveRequest.create.mockImplementation(({ data }: any) => ({ id: 'lr1', ...data }));

      const result: any = await service.requestLeave({
        employeeId: 'e1',
        leaveTypeId: 'lt1',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      });

      expect(result.daysRequested).toBe(3);
      expect(result.status).toBe(LeaveRequestStatus.SUBMITTED);
    });
  });

  describe('approveLeaveRequest', () => {
    it('deducts the balance and marks each day ON_LEAVE in attendance', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr1',
        employeeId: 'e1',
        leaveTypeId: 'lt1',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-02'),
        daysRequested: 2,
        status: LeaveRequestStatus.SUBMITTED,
      });
      prisma.leaveBalance.findUnique.mockResolvedValue({ id: 'bal1', entitledDays: 21, usedDays: 0, carriedForwardDays: 0 });
      prisma.leaveRequest.update.mockImplementation(({ data }: any) => ({ id: 'lr1', ...data }));

      const result: any = await service.approveLeaveRequest('lr1', 'approver');

      expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ usedDays: { increment: 2 } }) }),
      );
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
    });

    it('refuses to approve when the balance has since been exhausted', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        id: 'lr1',
        employeeId: 'e1',
        leaveTypeId: 'lt1',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
        daysRequested: 5,
        status: LeaveRequestStatus.SUBMITTED,
      });
      prisma.leaveBalance.findUnique.mockResolvedValue({ id: 'bal1', entitledDays: 21, usedDays: 20, carriedForwardDays: 0 });

      await expect(service.approveLeaveRequest('lr1', 'approver')).rejects.toThrow(ConflictException);
    });
  });
});
