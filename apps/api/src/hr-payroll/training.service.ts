import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TrainingEnrollmentStatus, TrainingSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateCourseDto {
  entityId: string;
  code: string;
  name: string;
  description?: string;
  durationHours?: number;
  provider?: string;
  isExternal?: boolean;
  cost?: number;
}

interface CreateSessionDto {
  courseId: string;
  startDate: string;
  endDate: string;
  location?: string;
  cost?: number;
}

interface EvaluateTrainingDto {
  evaluationRating: number;
  evaluationComments?: string;
  completionScore?: number;
}

interface IssueCertificationDto {
  employeeId: string;
  trainingEnrollmentId?: string;
  name: string;
  issuedBy?: string;
  issueDate: string;
  expiryDate?: string;
  certificateUrl?: string;
}

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // COURSE CATALOGUE
  // -------------------------------------------------------------------

  async createCourse(dto: CreateCourseDto) {
    const existing = await this.prisma.trainingCourse.findUnique({
      where: { entityId_code: { entityId: dto.entityId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Course code "${dto.code}" already exists for this entity`);
    return this.prisma.trainingCourse.create({ data: dto });
  }

  findCourses(entityId?: string) {
    return this.prisma.trainingCourse.findMany({ where: { entityId, isActive: true } });
  }

  // -------------------------------------------------------------------
  // TRAINING CALENDAR (sessions)
  // -------------------------------------------------------------------

  async createSession(dto: CreateSessionDto) {
    const course = await this.prisma.trainingCourse.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException(`Training course ${dto.courseId} not found`);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('endDate cannot be before startDate');
    return this.prisma.trainingSession.create({ data: { ...dto, startDate, endDate } });
  }

  findSessions(courseId?: string, status?: TrainingSessionStatus) {
    return this.prisma.trainingSession.findMany({ where: { courseId, status }, include: { course: true }, orderBy: { startDate: 'asc' } });
  }

  findCalendar(entityId: string, from: string, to: string) {
    return this.prisma.trainingSession.findMany({
      where: {
        course: { entityId },
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      include: { course: true },
      orderBy: { startDate: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // ENROLMENT
  // -------------------------------------------------------------------

  async enrol(sessionId: string, employeeId: string) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Training session ${sessionId} not found`);
    if (session.status === TrainingSessionStatus.CANCELLED) throw new ConflictException('Cannot enrol in a cancelled session');

    const existing = await this.prisma.trainingEnrollment.findUnique({
      where: { sessionId_employeeId: { sessionId, employeeId } },
    });
    if (existing) throw new ConflictException('This employee is already enrolled in this session');

    return this.prisma.trainingEnrollment.create({ data: { sessionId, employeeId } });
  }

  async markAttended(enrollmentId: string) {
    return this.prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: { status: TrainingEnrollmentStatus.ATTENDED },
    });
  }

  async cancelEnrollment(enrollmentId: string) {
    return this.prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: { status: TrainingEnrollmentStatus.CANCELLED },
    });
  }

  /** Post-training evaluation, and (if certifying) issue the certificate in one call. */
  async evaluateTraining(enrollmentId: string, dto: EvaluateTrainingDto) {
    if (dto.evaluationRating < 1 || dto.evaluationRating > 5) throw new BadRequestException('evaluationRating must be between 1 and 5');
    const enrollment = await this.prisma.trainingEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    if (enrollment.status !== TrainingEnrollmentStatus.ATTENDED) {
      throw new ConflictException('Can only evaluate an enrollment marked ATTENDED');
    }
    return this.prisma.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        evaluationRating: dto.evaluationRating,
        evaluationComments: dto.evaluationComments,
        completionScore: dto.completionScore,
      },
    });
  }

  findEnrollments(employeeId?: string, sessionId?: string) {
    return this.prisma.trainingEnrollment.findMany({
      where: { employeeId, sessionId },
      include: { session: { include: { course: true } }, certification: true },
    });
  }

  // -------------------------------------------------------------------
  // CERTIFICATION
  // -------------------------------------------------------------------

  async issueCertification(dto: IssueCertificationDto) {
    if (dto.trainingEnrollmentId) {
      const existing = await this.prisma.certification.findUnique({ where: { trainingEnrollmentId: dto.trainingEnrollmentId } });
      if (existing) throw new ConflictException('A certification already exists for this enrollment');
    }
    return this.prisma.certification.create({
      data: {
        ...dto,
        issueDate: new Date(dto.issueDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      },
    });
  }

  findCertifications(employeeId: string) {
    return this.prisma.certification.findMany({ where: { employeeId }, orderBy: { issueDate: 'desc' } });
  }

  /** Certifications expiring within `daysAhead` — feeds renewal reminders. */
  async findExpiringCertifications(daysAhead: number) {
    const cutoff = new Date(Date.now() + daysAhead * 86_400_000);
    return this.prisma.certification.findMany({
      where: { expiryDate: { lte: cutoff, gte: new Date() } },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // -------------------------------------------------------------------
  // SKILLS / COMPETENCY MATRIX (derived, no separate storage)
  // -------------------------------------------------------------------

  /** Cross-tab of employees vs their held certifications — the "skills matrix" view. */
  async skillsMatrix(entityId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { entityId, isActive: true },
      select: { id: true, firstName: true, lastName: true, certifications: { select: { name: true, expiryDate: true } } },
    });
    return employees.map((e) => ({
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`,
      skills: e.certifications.map((c) => ({ name: c.name, expiryDate: c.expiryDate })),
    }));
  }
}
