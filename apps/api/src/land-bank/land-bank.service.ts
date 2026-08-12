import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LandAcquisitionStatus,
  LandParcelStatus,
  MasterPlanStatus,
  PlotStatus,
  SurveyPlanStatus,
  TitleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  AddTitleDeedDto,
  CreateLandParcelDto,
  CreateMasterPlanDto,
  CreateSurveyPlanDto,
  PlotDefinitionDto,
  RecordLandAcquisitionDto,
} from './dto/land-bank.dto';

@Injectable()
export class LandBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // ---- Land Parcels ----

  async createParcel(dto: CreateLandParcelDto, createdById?: string) {
    const existing = await this.prisma.landParcel.findUnique({
      where: { entityId_code: { entityId: dto.entityId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Parcel code "${dto.code}" already exists for this entity`);

    return this.prisma.landParcel.create({
      data: {
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        location: dto.location,
        stateProvince: dto.stateProvince,
        localGovernmentArea: dto.localGovernmentArea,
        areaSqm: dto.areaSqm,
        acquisitionCostBudget: dto.acquisitionCostBudget,
        createdById,
      },
    });
  }

  findParcels(scope: SecurityScope, entityId?: string, status?: LandParcelStatus) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.landParcel.findMany({
      where: { AND: [rls, { entityId, status }] },
      include: { acquisitions: true, titleDeeds: true, surveyPlans: true, plots: true },
      orderBy: { code: 'asc' },
    });
  }

  async getParcel(parcelId: string) {
    const parcel = await this.prisma.landParcel.findUnique({
      where: { id: parcelId },
      include: { acquisitions: true, titleDeeds: true, surveyPlans: true, plots: { include: { release: true } } },
    });
    if (!parcel) throw new NotFoundException('Land parcel not found');
    return parcel;
  }

  private async requireParcel(parcelId: string) {
    const parcel = await this.prisma.landParcel.findUnique({ where: { id: parcelId } });
    if (!parcel) throw new NotFoundException('Land parcel not found');
    return parcel;
  }

  // ---- Land Acquisitions ----

  async recordAcquisition(dto: RecordLandAcquisitionDto, createdById?: string) {
    await this.requireParcel(dto.parcelId);

    return this.prisma.$transaction(async (tx) => {
      const acquisition = await tx.landAcquisition.create({
        data: {
          parcelId: dto.parcelId,
          vendorName: dto.vendorName,
          vendorContact: dto.vendorContact,
          agreedPrice: dto.agreedPrice,
          currency: dto.currency ?? 'NGN',
          paymentTerms: dto.paymentTerms,
          dueDiligenceNotes: dto.dueDiligenceNotes,
          createdById,
        },
      });
      await tx.landParcel.update({
        where: { id: dto.parcelId },
        data: { status: LandParcelStatus.UNDER_ACQUISITION },
      });
      return acquisition;
    });
  }

  async updateAcquisitionStatus(acquisitionId: string, status: LandAcquisitionStatus) {
    const acquisition = await this.prisma.landAcquisition.findUnique({ where: { id: acquisitionId } });
    if (!acquisition) throw new NotFoundException('Land acquisition not found');
    if (acquisition.status === LandAcquisitionStatus.COMPLETED) {
      throw new BadRequestException('Cannot change status of a completed acquisition');
    }
    return this.prisma.landAcquisition.update({ where: { id: acquisitionId }, data: { status } });
  }

  async completeAcquisition(acquisitionId: string, acquisitionDate: string) {
    const acquisition = await this.prisma.landAcquisition.findUnique({ where: { id: acquisitionId } });
    if (!acquisition) throw new NotFoundException('Land acquisition not found');
    if (acquisition.status === LandAcquisitionStatus.COMPLETED) {
      throw new ConflictException('Acquisition is already completed');
    }
    if (acquisition.status === LandAcquisitionStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled acquisition');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.landAcquisition.update({
        where: { id: acquisitionId },
        data: {
          status: LandAcquisitionStatus.COMPLETED,
          acquisitionDate: new Date(acquisitionDate),
          completedAt: new Date(),
        },
      });
      await tx.landParcel.update({
        where: { id: acquisition.parcelId },
        data: { status: LandParcelStatus.ACQUIRED },
      });
      return updated;
    });

    // NOTE (deferred): capitalizing the acquisition cost via
    // PostingEngineService (e.g. Dr Land Bank Asset / Cr AP or Cash) is
    // intentionally out of scope for this slice — it belongs with Fixed
    // Assets (Phase 5C, Construction in Progress) once that module exists.
  }

  // ---- Titles ----

  async addTitleDeed(dto: AddTitleDeedDto, createdById?: string) {
    await this.requireParcel(dto.parcelId);

    return this.prisma.$transaction(async (tx) => {
      const title = await tx.titleDeed.create({
        data: {
          parcelId: dto.parcelId,
          titleType: dto.titleType,
          titleNumber: dto.titleNumber,
          issuingAuthority: dto.issuingAuthority,
          applicationDate: dto.applicationDate ? new Date(dto.applicationDate) : undefined,
          documentRef: dto.documentRef,
          notes: dto.notes,
          status: TitleStatus.IN_PROGRESS,
          createdById,
        },
      });
      const parcel = await tx.landParcel.findUnique({ where: { id: dto.parcelId } });
      if (parcel && parcel.status !== LandParcelStatus.TITLED) {
        await tx.landParcel.update({ where: { id: dto.parcelId }, data: { status: LandParcelStatus.IN_TITLING } });
      }
      return title;
    });
  }

  async perfectTitleDeed(titleId: string, issuedDate: string, expiryDate?: string, titleNumber?: string) {
    const title = await this.prisma.titleDeed.findUnique({ where: { id: titleId } });
    if (!title) throw new NotFoundException('Title deed not found');
    if (title.status === TitleStatus.PERFECTED) throw new ConflictException('Title is already perfected');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.titleDeed.update({
        where: { id: titleId },
        data: {
          status: TitleStatus.PERFECTED,
          issuedDate: new Date(issuedDate),
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          titleNumber: titleNumber ?? title.titleNumber,
        },
      });
      await tx.landParcel.update({ where: { id: title.parcelId }, data: { status: LandParcelStatus.TITLED } });
      return updated;
    });
  }

  async rejectTitleDeed(titleId: string, reason: string) {
    const title = await this.prisma.titleDeed.findUnique({ where: { id: titleId } });
    if (!title) throw new NotFoundException('Title deed not found');
    return this.prisma.titleDeed.update({
      where: { id: titleId },
      data: { status: TitleStatus.REJECTED, notes: [title.notes, `Rejected: ${reason}`].filter(Boolean).join(' | ') },
    });
  }

  findTitleDeeds(parcelId: string) {
    return this.prisma.titleDeed.findMany({ where: { parcelId }, orderBy: { createdAt: 'desc' } });
  }

  // ---- Survey Plans ----

  async createSurveyPlan(dto: CreateSurveyPlanDto, createdById?: string) {
    await this.requireParcel(dto.parcelId);
    const existing = await this.prisma.surveyPlan.findUnique({
      where: { parcelId_planNumber: { parcelId: dto.parcelId, planNumber: dto.planNumber } },
    });
    if (existing) throw new ConflictException(`Survey plan "${dto.planNumber}" already exists for this parcel`);

    return this.prisma.surveyPlan.create({
      data: {
        parcelId: dto.parcelId,
        planNumber: dto.planNumber,
        surveyorName: dto.surveyorName,
        surveyDate: dto.surveyDate ? new Date(dto.surveyDate) : undefined,
        areaSqm: dto.areaSqm,
        coordinates: dto.coordinates as any,
        documentRef: dto.documentRef,
        status: SurveyPlanStatus.SUBMITTED,
        createdById,
      },
    });
  }

  async approveSurveyPlan(surveyPlanId: string) {
    const plan = await this.prisma.surveyPlan.findUnique({ where: { id: surveyPlanId } });
    if (!plan) throw new NotFoundException('Survey plan not found');
    if (plan.status === SurveyPlanStatus.APPROVED) throw new ConflictException('Survey plan is already approved');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surveyPlan.update({
        where: { id: surveyPlanId },
        data: { status: SurveyPlanStatus.APPROVED },
      });
      await tx.landParcel.update({ where: { id: plan.parcelId }, data: { status: LandParcelStatus.SURVEYED } });
      return updated;
    });
  }

  async rejectSurveyPlan(surveyPlanId: string, _reason: string) {
    const plan = await this.prisma.surveyPlan.findUnique({ where: { id: surveyPlanId } });
    if (!plan) throw new NotFoundException('Survey plan not found');
    return this.prisma.surveyPlan.update({
      where: { id: surveyPlanId },
      data: { status: SurveyPlanStatus.REJECTED },
      // reason is intentionally not persisted on a dedicated column in this
      // slice; it's captured via the automatic audit trail (AuditInterceptor)
      // on the mutating request. Revisit if a queryable rejection reason is needed.
    });
  }

  findSurveyPlans(parcelId: string) {
    return this.prisma.surveyPlan.findMany({ where: { parcelId }, orderBy: { createdAt: 'desc' } });
  }

  // ---- Plots ----

  async subdivideParcel(parcelId: string, surveyPlanId: string, plotDefs: PlotDefinitionDto[]) {
    if (!plotDefs?.length) throw new BadRequestException('At least one plot must be provided');

    const parcel = await this.requireParcel(parcelId);
    const surveyPlan = await this.prisma.surveyPlan.findUnique({ where: { id: surveyPlanId } });
    if (!surveyPlan || surveyPlan.parcelId !== parcelId) {
      throw new NotFoundException('Survey plan not found for this parcel');
    }
    if (surveyPlan.status !== SurveyPlanStatus.APPROVED) {
      throw new BadRequestException('Parcel can only be subdivided against an approved survey plan');
    }

    const totalPlotArea = plotDefs.reduce((sum, p) => sum + Number(p.areaSqm), 0);
    if (totalPlotArea > Number(parcel.areaSqm)) {
      throw new BadRequestException('Total plot area exceeds the parcel area');
    }

    return this.prisma.$transaction(async (tx) => {
      const plots = await Promise.all(
        plotDefs.map((p) =>
          tx.plot.create({
            data: {
              parcelId,
              surveyPlanId,
              plotNumber: p.plotNumber,
              areaSqm: p.areaSqm,
              useType: p.useType,
              notes: p.notes,
              status: PlotStatus.AVAILABLE,
            },
          }),
        ),
      );
      await tx.landParcel.update({ where: { id: parcelId }, data: { status: LandParcelStatus.SUBDIVIDED } });
      return plots;
    });
  }

  findPlots(parcelId: string, status?: PlotStatus) {
    return this.prisma.plot.findMany({ where: { parcelId, status }, orderBy: { plotNumber: 'asc' } });
  }

  async updatePlotStatus(plotId: string, status: PlotStatus) {
    const plot = await this.prisma.plot.findUnique({ where: { id: plotId } });
    if (!plot) throw new NotFoundException('Plot not found');
    return this.prisma.plot.update({ where: { id: plotId }, data: { status } });
  }

  // ---- Estate Master Planning ----

  async createMasterPlan(dto: CreateMasterPlanDto, createdById?: string) {
    const estate = await this.prisma.estate.findUnique({ where: { id: dto.estateId } });
    if (!estate) throw new NotFoundException('Estate not found');

    const latest = await this.prisma.estateMasterPlan.findFirst({
      where: { estateId: dto.estateId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    return this.prisma.estateMasterPlan.create({
      data: {
        estateId: dto.estateId,
        version: nextVersion,
        summary: dto.summary,
        totalPlannedUnits: dto.totalPlannedUnits,
        createdById,
        zones: dto.zones?.length
          ? {
              create: dto.zones.map((z) => ({
                code: z.code,
                name: z.name,
                useType: z.useType,
                plannedAreaSqm: z.plannedAreaSqm,
                plannedUnitCount: z.plannedUnitCount,
              })),
            }
          : undefined,
      },
      include: { zones: true },
    });
  }

  findMasterPlans(estateId: string) {
    return this.prisma.estateMasterPlan.findMany({
      where: { estateId },
      include: { zones: true },
      orderBy: { version: 'desc' },
    });
  }

  async getMasterPlan(masterPlanId: string) {
    const plan = await this.prisma.estateMasterPlan.findUnique({
      where: { id: masterPlanId },
      include: { zones: true },
    });
    if (!plan) throw new NotFoundException('Master plan not found');
    return plan;
  }

  async approveMasterPlan(masterPlanId: string) {
    const plan = await this.prisma.estateMasterPlan.findUnique({ where: { id: masterPlanId } });
    if (!plan) throw new NotFoundException('Master plan not found');
    if (plan.status === MasterPlanStatus.APPROVED) throw new ConflictException('Master plan is already approved');
    if (plan.status === MasterPlanStatus.SUPERSEDED) {
      throw new BadRequestException('Cannot approve a superseded master plan');
    }

    return this.prisma.$transaction(async (tx) => {
      // Supersede whichever plan for this estate is currently approved, if any.
      await tx.estateMasterPlan.updateMany({
        where: { estateId: plan.estateId, status: MasterPlanStatus.APPROVED },
        data: { status: MasterPlanStatus.SUPERSEDED },
      });
      return tx.estateMasterPlan.update({
        where: { id: masterPlanId },
        data: { status: MasterPlanStatus.APPROVED, approvedAt: new Date() },
      });
    });
  }

  // ---- Plot -> Project Release (Land Bank -> Real Estate hand-off) ----

  async releasePlotToProject(plotId: string, projectId: string, notes?: string, createdById?: string) {
    const plot = await this.prisma.plot.findUnique({ where: { id: plotId } });
    if (!plot) throw new NotFoundException('Plot not found');
    if (plot.status !== PlotStatus.AVAILABLE) {
      throw new BadRequestException('Only an AVAILABLE plot can be released to a project');
    }
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const existingRelease = await this.prisma.plotProjectRelease.findUnique({ where: { plotId } });
    if (existingRelease && !existingRelease.cancelledAt) {
      throw new ConflictException('Plot already has an active release');
    }

    return this.prisma.$transaction(async (tx) => {
      const release = existingRelease
        ? await tx.plotProjectRelease.update({
            where: { plotId },
            data: {
              projectId,
              notes,
              releaseDate: new Date(),
              cancelledAt: null,
              cancelReason: null,
              createdById,
            },
          })
        : await tx.plotProjectRelease.create({
            data: { plotId, projectId, notes, createdById },
          });
      await tx.plot.update({ where: { id: plotId }, data: { status: PlotStatus.ALLOCATED } });
      return release;
    });
  }

  async cancelPlotRelease(plotId: string, reason: string) {
    const release = await this.prisma.plotProjectRelease.findUnique({ where: { plotId } });
    if (!release || release.cancelledAt) throw new NotFoundException('No active release found for this plot');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.plotProjectRelease.update({
        where: { plotId },
        data: { cancelledAt: new Date(), cancelReason: reason },
      });
      await tx.plot.update({ where: { id: plotId }, data: { status: PlotStatus.AVAILABLE } });
      return updated;
    });
  }

  findReleasesForProject(projectId: string) {
    return this.prisma.plotProjectRelease.findMany({
      where: { projectId, cancelledAt: null },
      include: { plot: true },
      orderBy: { releaseDate: 'desc' },
    });
  }
}
