import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SelfServiceService } from '../self-service.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveService } from '../leave.service';
import { TrainingService } from '../training.service';
import { EmployeeLifecycleService } from '../employee-lifecycle.service';

function buildPrismaMock() {
  return {
    employee: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payslip: { findMany: jest.fn() },
    attendanceRecord: { findMany: jest.fn() },
    performanceReview: { findMany: jest.fn() },
    goal: { findMany: jest.fn() },
  };
}

describe('SelfServiceService', () => {
  let service: SelfServiceService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let leave: { findBalances: jest.Mock; requestLeave: jest.Mock; findLeaveRequests: jest.Mock };
  let training: { findEnrollments: jest.Mock; enrol: jest.Mock; findCertifications: jest.Mock };
  let lifecycle: { findOneEmployee: jest.Mock; addDocument: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    leave = {
      findBalances: jest.fn(),
      requestLeave: jest.fn(),
      findLeaveRequests: jest.fn(),
    };
    training = {
      findEnrollments: jest.fn(),
      enrol: jest.fn(),
      findCertifications: jest.fn(),
    };
    lifecycle = {
      findOneEmployee: jest.fn(),
      addDocument: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SelfServiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: LeaveService, useValue: leave },
        { provide: TrainingService, useValue: training },
        { provide: EmployeeLifecycleService, useValue: lifecycle },
      ],
    }).compile();

    service = moduleRef.get(SelfServiceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('employee resolution', () => {
    it('rejects an account with no linked employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.myProfile('user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('profile', () => {
    it('resolves the caller to their own employee before reading the profile', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      lifecycle.findOneEmployee.mockResolvedValue({ id: 'employee-1' });

      await expect(service.myProfile('user-1')).resolves.toEqual({
        id: 'employee-1',
      });

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(lifecycle.findOneEmployee).toHaveBeenCalledWith('employee-1');
    });

    it('only updates the permitted self-service fields', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      prisma.employee.update.mockResolvedValue({ id: 'employee-1' });

      await service.updateMyProfile('user-1', {
        phone: '08000000000',
        personalEmail: 'user@example.com',
        residentialAddress: 'Abuja',
      });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'employee-1' },
        data: {
          phone: '08000000000',
          personalEmail: 'user@example.com',
          residentialAddress: 'Abuja',
        },
      });
    });
  });

  describe('leave balances', () => {
    it('defaults to the current UTC year', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      leave.findBalances.mockResolvedValue([]);

      await service.myLeaveBalances('user-1');

      expect(leave.findBalances).toHaveBeenCalledWith(
        'employee-1',
        new Date().getUTCFullYear(),
      );
    });

    it('passes an explicit year through unchanged', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      leave.findBalances.mockResolvedValue([]);

      await service.myLeaveBalances('user-1', 2027);

      expect(leave.findBalances).toHaveBeenCalledWith('employee-1', 2027);
    });
  });

  describe('leave application', () => {
    it('never accepts an employee id from the caller', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      leave.requestLeave.mockResolvedValue({ id: 'leave-1' });

      await service.applyMyLeave('user-1', {
        leaveTypeId: 'type-1',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        reason: 'Annual leave',
      });

      expect(leave.requestLeave).toHaveBeenCalledWith({
        employeeId: 'employee-1',
        leaveTypeId: 'type-1',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        reason: 'Annual leave',
      });
    });
  });

  describe('training', () => {
    it('enrols the caller against the resolved employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      training.enrol.mockResolvedValue({ id: 'enrol-1' });

      await service.enrolMyselfInTraining('user-1', 'session-1');

      expect(training.enrol).toHaveBeenCalledWith('session-1', 'employee-1');
    });
  });

  describe('documents', () => {
    it('records a document against the caller employee', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'employee-1' });
      lifecycle.addDocument.mockResolvedValue({ id: 'doc-1' });

      await service.uploadMyDocument(
        'user-1',
        'Passport',
        'https://example.com/passport.pdf',
        'Identity document',
      );

      expect(lifecycle.addDocument).toHaveBeenCalledWith(
        {
          employeeId: 'employee-1',
          documentType: 'Passport',
          fileUrl: 'https://example.com/passport.pdf',
          description: 'Identity document',
        },
        'user-1',
      );
    });
  });
});
