import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SuccessionCriticality, SuccessionReadiness } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreatePlanDto {
  entityId: string;
  positionTitle: string;
  incumbentEmployeeId?: string;
  criticality?: SuccessionCriticality;
  notes?: string;
}

interface AddCandidateDto {
  successionPlanId: string;
  employeeId: string;
  readiness?: SuccessionReadiness;
  isHighPotential?: boolean;
  developmentNotes?: string;
}

@Injectable()
export class SuccessionService {
  constructor(private readonly prisma: PrismaService) {}

  createPlan(dto: CreatePlanDto) {
    return this.prisma.successionPlan.create({ data: dto });
  }

  findPlans(entityId?: string, criticality?: SuccessionCriticality) {
    return this.prisma.successionPlan.findMany({
      where: { entityId, criticality },
      include: { incumbent: { select: { id: true, firstName: true, lastName: true } }, candidates: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } } },
    });
  }

  async addCandidate(dto: AddCandidateDto) {
    const existing = await this.prisma.successionCandidate.findUnique({
      where: { successionPlanId_employeeId: { successionPlanId: dto.successionPlanId, employeeId: dto.employeeId } },
    });
    if (existing) throw new ConflictException('This employee is already mapped as a candidate for this plan');
    return this.prisma.successionCandidate.create({ data: dto });
  }

  updateReadiness(candidateId: string, readiness: SuccessionReadiness, developmentNotes?: string) {
    return this.prisma.successionCandidate.update({ where: { id: candidateId }, data: { readiness, developmentNotes } });
  }

  /** High-potential employees across every plan — the leadership pipeline view. */
  findHighPotentials(entityId?: string) {
    return this.prisma.successionCandidate.findMany({
      where: { isHighPotential: true, successionPlan: entityId ? { entityId } : undefined },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
        successionPlan: { select: { positionTitle: true, criticality: true } },
      },
    });
  }

  /** Critical/high-criticality roles with no READY_NOW candidate — the coverage gap view. */
  async findCoverageGaps(entityId: string) {
    const plans = await this.prisma.successionPlan.findMany({
      where: { entityId, criticality: { in: [SuccessionCriticality.HIGH, SuccessionCriticality.CRITICAL] } },
      include: { candidates: true },
    });
    return plans
      .filter((p) => !p.candidates.some((c) => c.readiness === SuccessionReadiness.READY_NOW))
      .map((p) => ({ successionPlanId: p.id, positionTitle: p.positionTitle, criticality: p.criticality, candidateCount: p.candidates.length }));
  }

  async findPlanOrThrow(id: string) {
    const plan = await this.prisma.successionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Succession plan ${id} not found`);
    return plan;
  }
}
