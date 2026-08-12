import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface StartBackgroundCheckDto {
  jobApplicationId: string;
  checkType: string;
}

/**
 * Background checks (incl. medical clearance as a checkType), ported from
 * ZIP A's recruitment implementation onto the canonical JobApplication /
 * Candidate model. CandidateService.hire() gates on this check's status:
 * a FLAGGED or still-PENDING/IN_PROGRESS check blocks hiring the same way
 * it did in the original implementation.
 */
@Injectable()
export class BackgroundCheckService {
  constructor(private readonly prisma: PrismaService) {}

  async start(dto: StartBackgroundCheckDto, initiatedById: string) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id: dto.jobApplicationId } });
    if (!app) throw new NotFoundException(`Application ${dto.jobApplicationId} not found`);

    const existing = await this.prisma.backgroundCheck.findUnique({ where: { jobApplicationId: dto.jobApplicationId } });
    if (existing) throw new ConflictException('A background check already exists for this application');

    return this.prisma.backgroundCheck.create({
      data: {
        jobApplicationId: dto.jobApplicationId,
        checkType: dto.checkType,
        status: BackgroundCheckStatus.IN_PROGRESS,
        initiatedById,
      },
    });
  }

  async complete(id: string, cleared: boolean, notes?: string) {
    await this.getOrThrow(id);
    return this.prisma.backgroundCheck.update({
      where: { id },
      data: {
        status: cleared ? BackgroundCheckStatus.CLEARED : BackgroundCheckStatus.FLAGGED,
        completedAt: new Date(),
        notes,
      },
    });
  }

  findForApplication(jobApplicationId: string) {
    return this.prisma.backgroundCheck.findUnique({ where: { jobApplicationId } });
  }

  private async getOrThrow(id: string) {
    const check = await this.prisma.backgroundCheck.findUnique({ where: { id } });
    if (!check) throw new NotFoundException(`Background check ${id} not found`);
    return check;
  }
}
