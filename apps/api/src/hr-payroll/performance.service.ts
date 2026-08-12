import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, PerformanceCycleStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateCycleDto {
  entityId: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface CreateGoalDto {
  employeeId: string;
  cycleId?: string;
  title: string;
  description?: string;
  weight?: number;
  targetDate?: string;
}

interface CreateKpiDto {
  employeeId: string;
  cycleId?: string;
  name: string;
  targetValue: number;
  unit?: string;
  weight?: number;
}

interface AssessCompetencyDto {
  employeeId: string;
  competencyId: string;
  cycleId?: string;
  rating: number;
  comments?: string;
}

interface SubmitSelfAssessmentDto {
  employeeId: string;
  cycleId: string;
  selfRating: number;
  selfComments?: string;
}

interface SubmitManagerReviewDto {
  managerRating: number;
  managerComments?: string;
  promotionRecommended?: boolean;
  incrementRecommended?: number;
  bonusRecommended?: number;
  pipRequired?: boolean;
}

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // CYCLES
  // -------------------------------------------------------------------

  async createCycle(dto: CreateCycleDto) {
    const existing = await this.prisma.performanceCycle.findUnique({
      where: { entityId_name: { entityId: dto.entityId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Performance cycle "${dto.name}" already exists for this entity`);
    return this.prisma.performanceCycle.create({
      data: { ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) },
    });
  }

  findCycles(entityId?: string) {
    return this.prisma.performanceCycle.findMany({ where: entityId ? { entityId } : undefined, orderBy: { startDate: 'desc' } });
  }

  /** Moves a cycle to CALIBRATION — reviews should be locked from further self/manager edits from here on (enforced in submitManagerReview/submitSelfAssessment via cycle status). */
  async startCalibration(cycleId: string) {
    const cycle = await this.getCycleOrThrow(cycleId);
    if (cycle.status !== PerformanceCycleStatus.OPEN) throw new ConflictException(`Cycle must be OPEN to start calibration (currently ${cycle.status})`);
    return this.prisma.performanceCycle.update({ where: { id: cycleId }, data: { status: PerformanceCycleStatus.CALIBRATION } });
  }

  async closeCycle(cycleId: string) {
    const cycle = await this.getCycleOrThrow(cycleId);
    if (cycle.status !== PerformanceCycleStatus.CALIBRATION) throw new ConflictException(`Cycle must be in CALIBRATION to close (currently ${cycle.status})`);
    const incomplete = await this.prisma.performanceReview.count({
      where: { cycleId, status: { not: ReviewStatus.COMPLETED } },
    });
    if (incomplete > 0) throw new ConflictException(`${incomplete} review(s) are not yet COMPLETED`);
    return this.prisma.performanceCycle.update({ where: { id: cycleId }, data: { status: PerformanceCycleStatus.CLOSED } });
  }

  // -------------------------------------------------------------------
  // GOALS / OKRs
  // -------------------------------------------------------------------

  createGoal(dto: CreateGoalDto) {
    return this.prisma.goal.create({
      data: { ...dto, targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined, status: GoalStatus.NOT_STARTED },
    });
  }

  updateGoalProgress(id: string, progressPercent: number) {
    if (progressPercent < 0 || progressPercent > 100) throw new BadRequestException('progressPercent must be 0-100');
    const status = progressPercent >= 100 ? GoalStatus.COMPLETED : progressPercent > 0 ? GoalStatus.IN_PROGRESS : GoalStatus.NOT_STARTED;
    return this.prisma.goal.update({ where: { id }, data: { progressPercent, status } });
  }

  findGoals(employeeId: string, cycleId?: string) {
    return this.prisma.goal.findMany({ where: { employeeId, cycleId } });
  }

  // -------------------------------------------------------------------
  // KPIs
  // -------------------------------------------------------------------

  createKpi(dto: CreateKpiDto) {
    return this.prisma.kpi.create({ data: { ...dto, weight: dto.weight ?? 0 } });
  }

  updateKpiActual(id: string, actualValue: number) {
    return this.prisma.kpi.update({ where: { id }, data: { actualValue } });
  }

  findKpis(employeeId: string, cycleId?: string) {
    return this.prisma.kpi.findMany({ where: { employeeId, cycleId } });
  }

  // -------------------------------------------------------------------
  // COMPETENCIES
  // -------------------------------------------------------------------

  createCompetency(name: string, description?: string) {
    return this.prisma.competency.create({ data: { name, description } });
  }

  findCompetencies() {
    return this.prisma.competency.findMany();
  }

  assessCompetency(dto: AssessCompetencyDto, assessedById: string) {
    if (dto.rating < 1 || dto.rating > 5) throw new BadRequestException('rating must be between 1 and 5');
    return this.prisma.competencyAssessment.create({ data: { ...dto, assessedById } });
  }

  findCompetencyAssessments(employeeId: string, cycleId?: string) {
    return this.prisma.competencyAssessment.findMany({ where: { employeeId, cycleId }, include: { competency: true } });
  }

  // -------------------------------------------------------------------
  // REVIEWS (self -> manager -> peer -> calibration -> completed)
  // -------------------------------------------------------------------

  async submitSelfAssessment(dto: SubmitSelfAssessmentDto) {
    if (dto.selfRating < 1 || dto.selfRating > 5) throw new BadRequestException('selfRating must be between 1 and 5');
    return this.prisma.performanceReview.upsert({
      where: { employeeId_cycleId: { employeeId: dto.employeeId, cycleId: dto.cycleId } },
      create: {
        employeeId: dto.employeeId,
        cycleId: dto.cycleId,
        reviewerId: await this.resolveReviewerId(dto.employeeId),
        selfRating: dto.selfRating,
        selfComments: dto.selfComments,
        status: ReviewStatus.SELF_ASSESSMENT,
      },
      update: { selfRating: dto.selfRating, selfComments: dto.selfComments, status: ReviewStatus.SELF_ASSESSMENT },
    });
  }

  async submitManagerReview(reviewId: string, dto: SubmitManagerReviewDto) {
    if (dto.managerRating < 1 || dto.managerRating > 5) throw new BadRequestException('managerRating must be between 1 and 5');
    await this.getReviewOrThrow(reviewId);
    return this.prisma.performanceReview.update({
      where: { id: reviewId },
      data: {
        managerRating: dto.managerRating,
        managerComments: dto.managerComments,
        promotionRecommended: dto.promotionRecommended ?? false,
        incrementRecommended: dto.incrementRecommended,
        bonusRecommended: dto.bonusRecommended,
        pipRequired: dto.pipRequired ?? false,
        status: ReviewStatus.MANAGER_REVIEW,
      },
    });
  }

  async addPeerFeedback(reviewId: string, peerComments: string) {
    const review = await this.getReviewOrThrow(reviewId);
    const merged = review.peerComments ? `${review.peerComments}\n---\n${peerComments}` : peerComments;
    return this.prisma.performanceReview.update({ where: { id: reviewId }, data: { peerComments: merged, status: ReviewStatus.PEER_REVIEW } });
  }

  /** Calibration sets the final agreed rating, which may differ from the raw manager rating. */
  async calibrateReview(reviewId: string, calibratedRating: number) {
    if (calibratedRating < 1 || calibratedRating > 5) throw new BadRequestException('calibratedRating must be between 1 and 5');
    const review = await this.getReviewOrThrow(reviewId);
    if (!review.managerRating) throw new ConflictException('Cannot calibrate a review before the manager review is submitted');
    return this.prisma.performanceReview.update({
      where: { id: reviewId },
      data: { calibratedRating, status: ReviewStatus.CALIBRATED },
    });
  }

  async completeReview(reviewId: string) {
    const review = await this.getReviewOrThrow(reviewId);
    if (!review.calibratedRating) throw new ConflictException('Cannot complete a review before calibration');
    return this.prisma.performanceReview.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.COMPLETED, completedAt: new Date() },
    });
  }

  findReviews(employeeId?: string, cycleId?: string) {
    return this.prisma.performanceReview.findMany({ where: { employeeId, cycleId }, orderBy: { createdAt: 'desc' } });
  }

  /** Performance history for one employee across every cycle they've been reviewed in. */
  findPerformanceHistory(employeeId: string) {
    return this.prisma.performanceReview.findMany({
      where: { employeeId, status: ReviewStatus.COMPLETED },
      include: { cycle: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async resolveReviewerId(employeeId: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    if (!employee.reportsToId) throw new ConflictException('This employee has no manager (reportsToId) set, so no reviewer can be assigned');
    return employee.reportsToId;
  }

  private async getCycleOrThrow(id: string) {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id } });
    if (!cycle) throw new NotFoundException(`Performance cycle ${id} not found`);
    return cycle;
  }

  private async getReviewOrThrow(id: string) {
    const review = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Performance review ${id} not found`);
    return review;
  }
}
