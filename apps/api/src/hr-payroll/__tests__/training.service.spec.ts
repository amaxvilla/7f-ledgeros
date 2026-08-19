import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  TrainingEnrollmentStatus,
  TrainingSessionStatus,
} from '@prisma/client';
import { TrainingService } from '../training.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    trainingCourse: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    trainingSession: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    trainingEnrollment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    certification: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
    },
  };
}

describe('TrainingService', () => {
  let service: TrainingService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TrainingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TrainingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createCourse', () => {
    it('rejects a duplicate course code within the entity', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'course-1' });

      await expect(
        service.createCourse({
          entityId: 'entity-1',
          code: 'SAFETY',
          name: 'Safety',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.trainingCourse.create).not.toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('rejects a missing course', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue(null);

      await expect(
        service.createSession({
          courseId: 'course-1',
          startDate: '2026-08-20',
          endDate: '2026-08-19',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an end date before the start date', async () => {
      prisma.trainingCourse.findUnique.mockResolvedValue({ id: 'course-1' });

      await expect(
        service.createSession({
          courseId: 'course-1',
          startDate: '2026-08-20',
          endDate: '2026-08-19',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.trainingSession.create).not.toHaveBeenCalled();
    });
  });

  describe('enrol', () => {
    it('rejects enrolment into a cancelled session', async () => {
      prisma.trainingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: TrainingSessionStatus.CANCELLED,
      });

      await expect(
        service.enrol('session-1', 'employee-1'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.trainingEnrollment.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate enrolment', async () => {
      prisma.trainingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: TrainingSessionStatus.SCHEDULED,
      });
      prisma.trainingEnrollment.findUnique.mockResolvedValue({
        id: 'enrol-1',
      });

      await expect(
        service.enrol('session-1', 'employee-1'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.trainingEnrollment.create).not.toHaveBeenCalled();
    });
  });

  describe('evaluateTraining', () => {
    it('rejects ratings outside 1 to 5', async () => {
      await expect(
        service.evaluateTraining('enrol-1', {
          evaluationRating: 6,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires the enrollment to be attended', async () => {
      prisma.trainingEnrollment.findUnique.mockResolvedValue({
        id: 'enrol-1',
        status: TrainingEnrollmentStatus.ENROLLED,
      });

      await expect(
        service.evaluateTraining('enrol-1', {
          evaluationRating: 4,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('issueCertification', () => {
    it('rejects a second certification for the same enrollment', async () => {
      prisma.certification.findUnique.mockResolvedValue({ id: 'cert-1' });

      await expect(
        service.issueCertification({
          employeeId: 'employee-1',
          trainingEnrollmentId: 'enrol-1',
          name: 'Safety Certificate',
          issueDate: '2026-08-19',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.certification.create).not.toHaveBeenCalled();
    });
  });

  describe('skillsMatrix', () => {
    it('maps active employees to their certification skills', async () => {
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'employee-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          certifications: [
            {
              name: 'First Aid',
              expiryDate: new Date('2027-08-19'),
            },
            {
              name: 'Fire Safety',
              expiryDate: null,
            },
          ],
        },
      ]);

      await expect(
        service.skillsMatrix('entity-1'),
      ).resolves.toEqual([
        {
          employeeId: 'employee-1',
          name: 'Ada Lovelace',
          skills: [
            {
              name: 'First Aid',
              expiryDate: new Date('2027-08-19'),
            },
            {
              name: 'Fire Safety',
              expiryDate: null,
            },
          ],
        },
      ]);

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: {
          entityId: 'entity-1',
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          certifications: {
            select: {
              name: true,
              expiryDate: true,
            },
          },
        },
      });
    });
  });

  describe('query methods', () => {
    it('lists active courses for an entity', async () => {
      prisma.trainingCourse.findMany.mockResolvedValue([{ id: 'course-1' }]);

      await expect(service.findCourses('entity-1')).resolves.toEqual([
        { id: 'course-1' },
      ]);

      expect(prisma.trainingCourse.findMany).toHaveBeenCalledWith({
        where: { entityId: 'entity-1', isActive: true },
      });
    });

    it('lists sessions with optional filters', async () => {
      prisma.trainingSession.findMany.mockResolvedValue([]);

      await service.findSessions(
        'course-1',
        TrainingSessionStatus.SCHEDULED,
      );

      expect(prisma.trainingSession.findMany).toHaveBeenCalledWith({
        where: {
          courseId: 'course-1',
          status: TrainingSessionStatus.SCHEDULED,
        },
        include: { course: true },
        orderBy: { startDate: 'asc' },
      });
    });

    it('lists employee certifications newest first', async () => {
      prisma.certification.findMany.mockResolvedValue([]);

      await service.findCertifications('employee-1');

      expect(prisma.certification.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'employee-1' },
        orderBy: { issueDate: 'desc' },
      });
    });

    it('finds certifications expiring within the requested window', async () => {
      prisma.certification.findMany.mockResolvedValue([]);

      await service.findExpiringCertifications(30);

      expect(prisma.certification.findMany).toHaveBeenCalledWith({
        where: {
          expiryDate: {
            lte: expect.any(Date),
            gte: expect.any(Date),
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
      });
    });

    it('loads overlapping training sessions for the calendar', async () => {
      prisma.trainingSession.findMany.mockResolvedValue([]);

      await service.findCalendar(
        'entity-1',
        '2026-08-01',
        '2026-08-31',
      );

      expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: { lte: new Date('2026-08-31') },
            endDate: { gte: new Date('2026-08-01') },
          }),
        }),
      );
    });
  });
});
