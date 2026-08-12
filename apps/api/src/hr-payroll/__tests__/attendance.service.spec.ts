import { Test } from '@nestjs/testing';
import { AttendanceSource, AttendanceStatus, BiometricEventType } from '@prisma/client';
import { AttendanceService } from '../attendance.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    shift: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    shiftAssignment: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    attendanceRecord: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
    employee: { findMany: jest.fn() },
    biometricDevice: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    biometricEventLog: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [AttendanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AttendanceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('clockIn', () => {
    it('marks LATE when clock-in is past the shift start plus grace period', async () => {
      prisma.shiftAssignment.findUnique.mockResolvedValue({ shift: { startTime: '08:00' } });
      prisma.attendanceRecord.upsert.mockImplementation(({ create }: any) => create);

      const result: any = await service.clockIn({ employeeId: 'e1', timestamp: '2026-06-01T08:30:00.000Z' });
      expect(result.status).toBe(AttendanceStatus.LATE);
    });

    it('marks PRESENT within the grace period', async () => {
      prisma.shiftAssignment.findUnique.mockResolvedValue({ shift: { startTime: '08:00' } });
      prisma.attendanceRecord.upsert.mockImplementation(({ create }: any) => create);

      const result: any = await service.clockIn({ employeeId: 'e1', timestamp: '2026-06-01T08:10:00.000Z' });
      expect(result.status).toBe(AttendanceStatus.PRESENT);
    });
  });

  describe('reconcileBiometricEvents', () => {
    it('matches raw employee codes, folds earliest/latest punches per day, and flags unmatched codes', async () => {
      prisma.biometricEventLog.findMany.mockResolvedValue([
        { id: 'ev1', rawEmployeeCode: 'EMP-001', eventType: BiometricEventType.CLOCK_IN, eventTime: new Date('2026-06-01T08:05:00.000Z') },
        { id: 'ev2', rawEmployeeCode: 'EMP-001', eventType: BiometricEventType.CLOCK_OUT, eventTime: new Date('2026-06-01T17:10:00.000Z') },
        { id: 'ev3', rawEmployeeCode: 'UNKNOWN-CODE', eventType: BiometricEventType.CLOCK_IN, eventTime: new Date('2026-06-01T08:00:00.000Z') },
      ]);
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1', employeeCode: 'EMP-001' }]);
      prisma.shiftAssignment.findUnique.mockResolvedValue(null);

      const result = await service.reconcileBiometricEvents('entity1');

      expect(result.reconciled).toBe(1);
      expect(result.unmatched).toBe(1);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = prisma.attendanceRecord.upsert.mock.calls[0][0];
      expect(upsertArg.create.source).toBe(AttendanceSource.BIOMETRIC);
      expect(prisma.biometricEventLog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['ev1', 'ev2'] } } }),
      );
    });

    it('returns zero counts when there are no unprocessed events', async () => {
      prisma.biometricEventLog.findMany.mockResolvedValue([]);
      const result = await service.reconcileBiometricEvents('entity1');
      expect(result).toEqual({ reconciled: 0, unmatched: 0 });
    });
  });
});
