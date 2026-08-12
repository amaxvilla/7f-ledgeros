import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AssetAssignmentStatus, ExitClearanceItemStatus } from '@prisma/client';
import { EmployeeLifecycleService } from '../employee-lifecycle.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    employee: { findUnique: jest.fn(), update: jest.fn() },
    onboardingTask: { findMany: jest.fn(), createMany: jest.fn(), create: jest.fn() },
    employeeAssetAssignment: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    employeeExit: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
    exitClearanceItem: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('EmployeeLifecycleService', () => {
  let service: EmployeeLifecycleService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [EmployeeLifecycleService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EmployeeLifecycleService);
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  afterEach(() => jest.clearAllMocks());

  describe('startOnboarding', () => {
    it('refuses to re-seed a checklist that already exists', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.onboardingTask.findMany.mockResolvedValue([{ id: 't1' }]);
      await expect(service.startOnboarding('e1')).rejects.toThrow(ConflictException);
    });

    it('seeds the standard checklist for a new employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.onboardingTask.findMany.mockResolvedValue([]);
      await service.startOnboarding('e1');
      expect(prisma.onboardingTask.createMany).toHaveBeenCalled();
      const call = prisma.onboardingTask.createMany.mock.calls[0][0];
      expect(call.data.length).toBeGreaterThan(3);
    });
  });

  describe('clearExitItem', () => {
    it('blocks IT asset clearance while assets are still assigned', async () => {
      prisma.exitClearanceItem.findUnique.mockResolvedValue({
        id: 'item1',
        employeeExitId: 'exit1',
        department: 'IT',
        item: 'Return company asset',
        status: ExitClearanceItemStatus.PENDING,
      });
      prisma.employeeExit.findUniqueOrThrow.mockResolvedValue({ id: 'exit1', employeeId: 'e1' });
      prisma.employeeAssetAssignment.findMany.mockResolvedValue([
        { id: 'a1', status: AssetAssignmentStatus.ASSIGNED },
      ]);

      await expect(service.clearExitItem('item1', 'clearer1')).rejects.toThrow(ConflictException);
      expect(prisma.exitClearanceItem.update).not.toHaveBeenCalled();
    });

    it('clears the item once no outstanding assets remain, and marks the exit COMPLETED when all items are cleared', async () => {
      prisma.exitClearanceItem.findUnique.mockResolvedValue({
        id: 'item1',
        employeeExitId: 'exit1',
        department: 'IT',
        item: 'Return company asset',
        status: ExitClearanceItemStatus.PENDING,
      });
      prisma.employeeExit.findUniqueOrThrow.mockResolvedValue({ id: 'exit1', employeeId: 'e1' });
      prisma.employeeAssetAssignment.findMany.mockResolvedValue([]);
      prisma.exitClearanceItem.findMany.mockResolvedValue([
        { id: 'item1', status: ExitClearanceItemStatus.CLEARED },
      ]);
      prisma.employeeExit.update.mockImplementation(({ data }: any) => ({ id: 'exit1', ...data }));

      const result: any = await service.clearExitItem('item1', 'clearer1');

      expect(prisma.exitClearanceItem.update).toHaveBeenCalled();
      expect(result.clearanceStatus).toBe('COMPLETED');
    });
  });

  describe('updateProfile', () => {
    it('refuses to let an employee report to themselves', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1' });
      await expect(service.updateProfile('e1', { reportsToId: 'e1' })).rejects.toThrow();
    });
  });
});
