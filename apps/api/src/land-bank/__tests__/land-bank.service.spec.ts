import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  LandAcquisitionStatus,
  LandParcelStatus,
  MasterPlanStatus,
  PlotStatus,
  SurveyPlanStatus,
  TitleStatus,
  TitleType,
} from '@prisma/client';
import { LandBankService } from '../land-bank.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';

describe('LandBankService', () => {
  let service: LandBankService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      landParcel: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      landAcquisition: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      titleDeed: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      surveyPlan: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      plot: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      estate: { findUnique: jest.fn() },
      project: { findUnique: jest.fn() },
      estateMasterPlan: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      plotProjectRelease: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((fn: any) =>
        typeof fn === 'function' ? fn(prisma) : Promise.all(fn),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LandBankService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(LandBankService);
  });

  describe('getParcel', () => {
    it('includes each plot\'s release relation, not just the plot itself (FE-4.5)', async () => {
      const parcel = { id: 'p1', code: 'LB-001', plots: [{ id: 'plot-1', release: { id: 'rel-1', projectId: 'proj-1' } }] };
      prisma.landParcel.findUnique.mockResolvedValue(parcel);

      const result = await service.getParcel('p1');

      expect(prisma.landParcel.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        include: { acquisitions: true, titleDeeds: true, surveyPlans: true, plots: { include: { release: true } } },
      });
      expect(result).toEqual(parcel);
    });

    it('throws NotFoundException when the parcel does not exist', async () => {
      prisma.landParcel.findUnique.mockResolvedValue(null);

      await expect(service.getParcel('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createParcel', () => {
    it('rejects a duplicate entity/code combination', async () => {
      prisma.landParcel.findUnique.mockResolvedValue({ id: 'p1' });

      await expect(
        service.createParcel({
          entityId: 'e1',
          code: 'LB-001',
          name: 'Parcel 1',
          areaSqm: 5000,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a parcel when the code is unique', async () => {
      prisma.landParcel.findUnique.mockResolvedValue(null);
      prisma.landParcel.create.mockResolvedValue({ id: 'p1', code: 'LB-001' });

      const result = await service.createParcel({
        entityId: 'e1',
        code: 'LB-001',
        name: 'Parcel 1',
        areaSqm: 5000,
      } as any, 'user-1');

      expect(prisma.landParcel.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'LB-001', createdById: 'user-1' }) }),
      );
      expect(result).toEqual({ id: 'p1', code: 'LB-001' });
    });
  });

  describe('completeAcquisition', () => {
    it('moves the parcel to ACQUIRED and stamps completedAt', async () => {
      prisma.landAcquisition.findUnique.mockResolvedValue({
        id: 'a1',
        parcelId: 'p1',
        status: LandAcquisitionStatus.AGREED,
      });
      prisma.landAcquisition.update.mockResolvedValue({ id: 'a1', status: LandAcquisitionStatus.COMPLETED });
      prisma.landParcel.update.mockResolvedValue({ id: 'p1', status: LandParcelStatus.ACQUIRED });

      await service.completeAcquisition('a1', '2026-07-01');

      expect(prisma.landAcquisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: LandAcquisitionStatus.COMPLETED }),
        }),
      );
      expect(prisma.landParcel.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: LandParcelStatus.ACQUIRED },
      });
    });

    it('refuses to re-complete an already-completed acquisition', async () => {
      prisma.landAcquisition.findUnique.mockResolvedValue({
        id: 'a1',
        parcelId: 'p1',
        status: LandAcquisitionStatus.COMPLETED,
      });

      await expect(service.completeAcquisition('a1', '2026-07-01')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown acquisition', async () => {
      prisma.landAcquisition.findUnique.mockResolvedValue(null);
      await expect(service.completeAcquisition('missing', '2026-07-01')).rejects.toThrow(NotFoundException);
    });
  });

  describe('perfectTitleDeed', () => {
    it('marks the title PERFECTED and the parcel TITLED', async () => {
      prisma.titleDeed.findUnique.mockResolvedValue({
        id: 't1',
        parcelId: 'p1',
        status: TitleStatus.IN_PROGRESS,
        titleNumber: null,
        titleType: TitleType.CERTIFICATE_OF_OCCUPANCY,
      });
      prisma.titleDeed.update.mockResolvedValue({ id: 't1', status: TitleStatus.PERFECTED });
      prisma.landParcel.update.mockResolvedValue({ id: 'p1', status: LandParcelStatus.TITLED });

      await service.perfectTitleDeed('t1', '2026-07-10');

      expect(prisma.landParcel.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: LandParcelStatus.TITLED },
      });
    });
  });

  describe('approveSurveyPlan', () => {
    it('marks the plan APPROVED and the parcel SURVEYED', async () => {
      prisma.surveyPlan.findUnique.mockResolvedValue({ id: 's1', parcelId: 'p1', status: SurveyPlanStatus.SUBMITTED });
      prisma.surveyPlan.update.mockResolvedValue({ id: 's1', status: SurveyPlanStatus.APPROVED });
      prisma.landParcel.update.mockResolvedValue({ id: 'p1', status: LandParcelStatus.SURVEYED });

      await service.approveSurveyPlan('s1');

      expect(prisma.landParcel.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: LandParcelStatus.SURVEYED },
      });
    });
  });

  describe('subdivideParcel', () => {
    it('rejects subdivision against a non-approved survey plan', async () => {
      prisma.landParcel.findUnique.mockResolvedValue({ id: 'p1', areaSqm: 5000 });
      prisma.surveyPlan.findUnique.mockResolvedValue({ id: 's1', parcelId: 'p1', status: SurveyPlanStatus.SUBMITTED });

      await expect(
        service.subdivideParcel('p1', 's1', [{ plotNumber: 'PL-01', areaSqm: 500 } as any]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects plots whose combined area exceeds the parcel area', async () => {
      prisma.landParcel.findUnique.mockResolvedValue({ id: 'p1', areaSqm: 1000 });
      prisma.surveyPlan.findUnique.mockResolvedValue({ id: 's1', parcelId: 'p1', status: SurveyPlanStatus.APPROVED });

      await expect(
        service.subdivideParcel('p1', 's1', [
          { plotNumber: 'PL-01', areaSqm: 600 } as any,
          { plotNumber: 'PL-02', areaSqm: 600 } as any,
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates plots and moves the parcel to SUBDIVIDED', async () => {
      prisma.landParcel.findUnique.mockResolvedValue({ id: 'p1', areaSqm: 1000 });
      prisma.surveyPlan.findUnique.mockResolvedValue({ id: 's1', parcelId: 'p1', status: SurveyPlanStatus.APPROVED });
      prisma.plot.create
        .mockResolvedValueOnce({ id: 'pl1', plotNumber: 'PL-01', status: PlotStatus.AVAILABLE })
        .mockResolvedValueOnce({ id: 'pl2', plotNumber: 'PL-02', status: PlotStatus.AVAILABLE });
      prisma.landParcel.update.mockResolvedValue({ id: 'p1', status: LandParcelStatus.SUBDIVIDED });

      const result = await service.subdivideParcel('p1', 's1', [
        { plotNumber: 'PL-01', areaSqm: 400 } as any,
        { plotNumber: 'PL-02', areaSqm: 400 } as any,
      ]);

      expect(result).toHaveLength(2);
      expect(prisma.landParcel.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: LandParcelStatus.SUBDIVIDED },
      });
    });
  });

  describe('createMasterPlan', () => {
    it('rejects an unknown estate', async () => {
      prisma.estate.findUnique.mockResolvedValue(null);
      await expect(
        service.createMasterPlan({ estateId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('versions plans sequentially per estate', async () => {
      prisma.estate.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.estateMasterPlan.findFirst.mockResolvedValue({ version: 2 });
      prisma.estateMasterPlan.create.mockResolvedValue({ id: 'mp1', version: 3 });

      const result = await service.createMasterPlan({ estateId: 'e1', zones: [] } as any, 'user-1');

      expect(prisma.estateMasterPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estateId: 'e1', version: 3 }) }),
      );
      expect(result).toEqual({ id: 'mp1', version: 3 });
    });
  });

  describe('approveMasterPlan', () => {
    it('supersedes the previously approved plan for the same estate', async () => {
      prisma.estateMasterPlan.findUnique.mockResolvedValue({ id: 'mp2', estateId: 'e1', status: MasterPlanStatus.DRAFT });
      prisma.estateMasterPlan.updateMany.mockResolvedValue({ count: 1 });
      prisma.estateMasterPlan.update.mockResolvedValue({ id: 'mp2', status: MasterPlanStatus.APPROVED });

      await service.approveMasterPlan('mp2');

      expect(prisma.estateMasterPlan.updateMany).toHaveBeenCalledWith({
        where: { estateId: 'e1', status: MasterPlanStatus.APPROVED },
        data: { status: MasterPlanStatus.SUPERSEDED },
      });
      expect(prisma.estateMasterPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mp2' }, data: expect.objectContaining({ status: MasterPlanStatus.APPROVED }) }),
      );
    });

    it('refuses to approve an already-superseded plan', async () => {
      prisma.estateMasterPlan.findUnique.mockResolvedValue({ id: 'mp1', estateId: 'e1', status: MasterPlanStatus.SUPERSEDED });
      await expect(service.approveMasterPlan('mp1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('releasePlotToProject', () => {
    it('rejects releasing a plot that is not AVAILABLE', async () => {
      prisma.plot.findUnique.mockResolvedValue({ id: 'pl1', status: PlotStatus.ALLOCATED });
      await expect(service.releasePlotToProject('pl1', 'proj1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a plot that already has an active release', async () => {
      prisma.plot.findUnique.mockResolvedValue({ id: 'pl1', status: PlotStatus.AVAILABLE });
      prisma.project.findUnique.mockResolvedValue({ id: 'proj1' });
      prisma.plotProjectRelease.findUnique.mockResolvedValue({ plotId: 'pl1', cancelledAt: null });

      await expect(service.releasePlotToProject('pl1', 'proj1')).rejects.toThrow(ConflictException);
    });

    it('creates a release and moves the plot to ALLOCATED', async () => {
      prisma.plot.findUnique.mockResolvedValue({ id: 'pl1', status: PlotStatus.AVAILABLE });
      prisma.project.findUnique.mockResolvedValue({ id: 'proj1' });
      prisma.plotProjectRelease.findUnique.mockResolvedValue(null);
      prisma.plotProjectRelease.create.mockResolvedValue({ plotId: 'pl1', projectId: 'proj1' });
      prisma.plot.update.mockResolvedValue({ id: 'pl1', status: PlotStatus.ALLOCATED });

      await service.releasePlotToProject('pl1', 'proj1', 'handoff note', 'user-1');

      expect(prisma.plotProjectRelease.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ plotId: 'pl1', projectId: 'proj1' }) }),
      );
      expect(prisma.plot.update).toHaveBeenCalledWith({
        where: { id: 'pl1' },
        data: { status: PlotStatus.ALLOCATED },
      });
    });
  });

  describe('cancelPlotRelease', () => {
    it('reverts the plot to AVAILABLE', async () => {
      prisma.plotProjectRelease.findUnique.mockResolvedValue({ plotId: 'pl1', cancelledAt: null });
      prisma.plotProjectRelease.update.mockResolvedValue({ plotId: 'pl1', cancelledAt: new Date() });
      prisma.plot.update.mockResolvedValue({ id: 'pl1', status: PlotStatus.AVAILABLE });

      await service.cancelPlotRelease('pl1', 'buyer withdrew');

      expect(prisma.plot.update).toHaveBeenCalledWith({
        where: { id: 'pl1' },
        data: { status: PlotStatus.AVAILABLE },
      });
    });

    it('throws NotFoundException when there is no active release', async () => {
      prisma.plotProjectRelease.findUnique.mockResolvedValue(null);
      await expect(service.cancelPlotRelease('pl1', 'reason')).rejects.toThrow(NotFoundException);
    });
  });
});
