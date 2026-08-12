import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IssueStatus, RiskImpact, RiskProbability, RiskStatus } from '@prisma/client';
import { RiskIssueService } from '../risk-issue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('RiskIssueService', () => {
  let service: RiskIssueService;
  let prisma: any;
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      projectRisk: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      projectIssue: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      $transaction: jest.fn((ops: any) => Promise.all(ops)),
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RiskIssueService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(RiskIssueService);
  });

  describe('createRisk', () => {
    it('computes riskScore from the probability x impact matrix', async () => {
      prisma.projectRisk.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data }));

      const result = await service.createRisk(
        { projectId: 'p1', entityId: 'e1', title: 'Rebar shortage', probability: RiskProbability.HIGH, impact: RiskImpact.MEDIUM } as any,
        'u1',
      );

      expect(result.riskScore).toBe(6); // HIGH(3) x MEDIUM(2)
    });

    it('defaults to MEDIUM/MEDIUM when not specified', async () => {
      prisma.projectRisk.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'r1', ...data }));
      const result = await service.createRisk({ projectId: 'p1', entityId: 'e1', title: 'Weather delay' } as any, 'u1');
      expect(result.riskScore).toBe(4); // MEDIUM(2) x MEDIUM(2)
    });

    it('notifies the owner when a risk is created pre-assigned', async () => {
      prisma.projectRisk.create.mockResolvedValue({ id: 'r1', title: 'Rebar shortage', ownerId: 'owner1' });
      await service.createRisk({ projectId: 'p1', entityId: 'e1', title: 'Rebar shortage', ownerId: 'owner1' } as any, 'u1');
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner1', title: 'Risk assigned to you' }));
    });
  });

  describe('risk lifecycle guards', () => {
    it('rejects acting on a CLOSED risk', async () => {
      prisma.projectRisk.findUnique.mockResolvedValue({ id: 'r1', status: RiskStatus.CLOSED });
      await expect(service.assessRisk('r1', { probability: RiskProbability.HIGH, impact: RiskImpact.HIGH } as any)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for a missing risk', async () => {
      prisma.projectRisk.findUnique.mockResolvedValue(null);
      await expect(service.closeRisk('missing')).rejects.toThrow(NotFoundException);
    });

    it('moves IDENTIFIED -> ASSESSED on first assessment only', async () => {
      prisma.projectRisk.findUnique.mockResolvedValue({ id: 'r1', status: RiskStatus.IDENTIFIED });
      prisma.projectRisk.update.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));
      const result = await service.assessRisk('r1', { probability: RiskProbability.LOW, impact: RiskImpact.LOW } as any);
      expect(result.status).toBe(RiskStatus.ASSESSED);
      expect(result.riskScore).toBe(1);
    });
  });

  describe('convertRiskToIssue', () => {
    it('marks the risk OCCURRED and creates a linked issue', async () => {
      prisma.projectRisk.findUnique.mockResolvedValue({
        id: 'r1',
        status: RiskStatus.MITIGATING,
        projectId: 'p1',
        entityId: 'e1',
        title: 'Rebar shortage',
        description: 'Supplier delay',
        ownerId: 'owner1',
      });
      prisma.projectIssue.create.mockResolvedValue({ id: 'i1', title: '[Risk occurred] Rebar shortage', assignedToId: 'owner1' });

      const result = await service.convertRiskToIssue('r1', {} as any, 'u1');

      expect(prisma.projectRisk.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: RiskStatus.OCCURRED } }));
      expect(prisma.projectIssue.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ riskId: 'r1', raisedById: 'u1', assignedToId: 'owner1' }) }),
      );
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner1', title: 'New issue assigned' }));
      expect(result.id).toBe('i1');
    });

    it('rejects converting an already-CLOSED risk', async () => {
      prisma.projectRisk.findUnique.mockResolvedValue({ id: 'r1', status: RiskStatus.CLOSED });
      await expect(service.convertRiskToIssue('r1', {} as any, 'u1')).rejects.toThrow(ConflictException);
    });
  });

  describe('issue lifecycle', () => {
    it('notifies the assignee on issue creation', async () => {
      prisma.projectIssue.create.mockResolvedValue({ id: 'i1', title: 'Crane breakdown', assignedToId: 'tech1' });
      await service.createIssue({ projectId: 'p1', entityId: 'e1', title: 'Crane breakdown', assignedToId: 'tech1' } as any, 'u1');
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'tech1', title: 'New issue assigned' }));
    });

    it('rejects closing an issue that is not RESOLVED', async () => {
      prisma.projectIssue.findUnique.mockResolvedValue({ id: 'i1', status: IssueStatus.OPEN });
      await expect(service.closeIssue('i1')).rejects.toThrow(BadRequestException);
    });

    it('rejects acting on a CLOSED issue', async () => {
      prisma.projectIssue.findUnique.mockResolvedValue({ id: 'i1', status: IssueStatus.CLOSED });
      await expect(service.startIssueWork('i1')).rejects.toThrow(ConflictException);
    });

    it('moves OPEN -> RESOLVED -> CLOSED', async () => {
      prisma.projectIssue.findUnique.mockResolvedValueOnce({ id: 'i1', status: IssueStatus.OPEN });
      prisma.projectIssue.update.mockResolvedValue({ id: 'i1', status: IssueStatus.RESOLVED });
      const resolved = await service.resolveIssue('i1', { resolutionNotes: 'Replaced part' } as any);
      expect(resolved.status).toBe(IssueStatus.RESOLVED);

      prisma.projectIssue.findUnique.mockResolvedValueOnce({ id: 'i1', status: IssueStatus.RESOLVED });
      prisma.projectIssue.update.mockResolvedValue({ id: 'i1', status: IssueStatus.CLOSED });
      const closed = await service.closeIssue('i1');
      expect(closed.status).toBe(IssueStatus.CLOSED);
    });
  });

  describe('getRiskIssueSummary', () => {
    it('shapes grouped counts and top risks for the portfolio dashboard', async () => {
      prisma.projectRisk.groupBy.mockResolvedValue([{ status: RiskStatus.IDENTIFIED, _count: 2 }]);
      prisma.projectRisk.findMany.mockResolvedValue([{ id: 'r1', title: 'Rebar shortage', riskScore: 9, status: RiskStatus.MITIGATING }]);
      prisma.projectIssue.groupBy
        .mockResolvedValueOnce([{ status: IssueStatus.OPEN, _count: 3 }])
        .mockResolvedValueOnce([{ priority: 'CRITICAL', _count: 1 }]);

      const result = await service.getRiskIssueSummary();

      expect(result.risksByStatus).toEqual([{ status: RiskStatus.IDENTIFIED, count: 2 }]);
      expect(result.topOpenRisks[0].riskScore).toBe(9);
    });

    it('Release K: ANDs the optional entityId filter into both risk and issue queries when provided', async () => {
      prisma.projectRisk.groupBy.mockResolvedValue([]);
      prisma.projectRisk.findMany.mockResolvedValue([]);
      prisma.projectIssue.groupBy.mockResolvedValue([]);

      await service.getRiskIssueSummary('proj-1', 'ent-1');

      expect(prisma.projectRisk.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 'proj-1', entityId: 'ent-1' } }),
      );
      expect(prisma.projectIssue.groupBy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { projectId: 'proj-1', entityId: 'ent-1' } }),
      );
    });

    it('Release K: omits the entityId filter entirely when not provided (existing callers unaffected)', async () => {
      prisma.projectRisk.groupBy.mockResolvedValue([]);
      prisma.projectRisk.findMany.mockResolvedValue([]);
      prisma.projectIssue.groupBy.mockResolvedValue([]);

      await service.getRiskIssueSummary();

      expect(prisma.projectRisk.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });
});
