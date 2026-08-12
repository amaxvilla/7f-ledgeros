import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequisitionStatus, VacancyStatus, WorkflowInstanceStatus } from '@prisma/client';
import { RecruitmentService } from '../recruitment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngineService } from '../../workflow/workflow.service';
import { BudgetingService } from '../../budgeting/budgeting.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

function buildPrismaMock() {
  return {
    jobRequisition: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    vacancy: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    jobApplication: { groupBy: jest.fn(), findMany: jest.fn() },
    interview: { count: jest.fn() },
  };
}

function buildWorkflowMock() {
  return { startInstance: jest.fn(), getInstance: jest.fn() };
}

function buildBudgetingMock() {
  return { getAvailableForLine: jest.fn() };
}

describe('RecruitmentService', () => {
  let service: RecruitmentService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let workflow: ReturnType<typeof buildWorkflowMock>;
  let budgeting: ReturnType<typeof buildBudgetingMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    workflow = buildWorkflowMock();
    budgeting = buildBudgetingMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecruitmentService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkflowEngineService, useValue: workflow },
        { provide: BudgetingService, useValue: budgeting },
      ],
    }).compile();
    service = moduleRef.get(RecruitmentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createRequisition', () => {
    it('rejects a missing job title', async () => {
      await expect(service.createRequisition({ entityId: 'e1', jobTitle: '' }, 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a DRAFT requisition', async () => {
      prisma.jobRequisition.create.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));
      const result: any = await service.createRequisition({ entityId: 'e1', jobTitle: 'Engineer' }, 'u1');
      expect(result.status).toBe(RequisitionStatus.DRAFT);
      expect(result.requestedById).toBe('u1');
    });
  });

  describe('submitRequisitionForApproval', () => {
    it('rejects a requisition that is not DRAFT', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'r1', status: RequisitionStatus.APPROVED });
      await expect(service.submitRequisitionForApproval('r1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('starts a workflow instance and moves to PENDING_APPROVAL', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({
        id: 'r1',
        status: RequisitionStatus.DRAFT,
        entityId: 'e1',
        departmentId: null,
        projectId: null,
      });
      workflow.startInstance.mockResolvedValue({ id: 'wf1' });
      prisma.jobRequisition.update.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));

      const result: any = await service.submitRequisitionForApproval('r1', 'u1');
      expect(workflow.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({ workflowCode: 'RECRUITMENT_REQUISITION', entityType: 'JobRequisition' }),
        'u1',
      );
      expect(result.status).toBe(RequisitionStatus.PENDING_APPROVAL);
      expect(result.workflowInstanceId).toBe('wf1');
    });

    it('rejects submission when the linked budget line has no available budget (ported from ZIP A)', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({
        id: 'r1',
        status: RequisitionStatus.DRAFT,
        entityId: 'e1',
        departmentId: null,
        projectId: null,
        budgetLineId: 'bl1',
      });
      budgeting.getAvailableForLine.mockResolvedValue(0);

      await expect(service.submitRequisitionForApproval('r1', 'u1')).rejects.toThrow(BadRequestException);
      expect(workflow.startInstance).not.toHaveBeenCalled();
    });

    it('allows submission when the linked budget line has available budget', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({
        id: 'r1',
        status: RequisitionStatus.DRAFT,
        entityId: 'e1',
        departmentId: null,
        projectId: null,
        budgetLineId: 'bl1',
      });
      budgeting.getAvailableForLine.mockResolvedValue(50000);
      workflow.startInstance.mockResolvedValue({ id: 'wf1' });
      prisma.jobRequisition.update.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));

      const result: any = await service.submitRequisitionForApproval('r1', 'u1');
      expect(budgeting.getAvailableForLine).toHaveBeenCalledWith('bl1');
      expect(result.status).toBe(RequisitionStatus.PENDING_APPROVAL);
    });
  });

  describe('refreshRequisitionApproval', () => {
    it('marks the requisition APPROVED once the workflow instance completes', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({
        id: 'r1',
        status: RequisitionStatus.PENDING_APPROVAL,
        workflowInstanceId: 'wf1',
      });
      workflow.getInstance.mockResolvedValue({ status: WorkflowInstanceStatus.APPROVED });
      prisma.jobRequisition.update.mockImplementation(({ data }: any) => ({ id: 'r1', ...data }));

      const result: any = await service.refreshRequisitionApproval('r1');
      expect(result.status).toBe(RequisitionStatus.APPROVED);
    });
  });

  describe('createVacancy', () => {
    it('rejects opening a vacancy against a non-approved requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({ id: 'r1', status: RequisitionStatus.DRAFT });
      await expect(service.createVacancy({ jobRequisitionId: 'r1', title: 'Engineer' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a DRAFT vacancy for an approved requisition', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({
        id: 'r1',
        status: RequisitionStatus.APPROVED,
        entityId: 'e1',
        departmentId: 'd1',
        employmentType: 'FULL_TIME',
      });
      prisma.vacancy.create.mockImplementation(({ data }: any) => ({ id: 'v1', ...data }));
      const result: any = await service.createVacancy({ jobRequisitionId: 'r1', title: 'Engineer' });
      expect(result.status).toBe(VacancyStatus.DRAFT);
    });
  });

  describe('publishVacancy', () => {
    it('rejects publishing a CLOSED vacancy', async () => {
      prisma.vacancy.findUnique.mockResolvedValue({ id: 'v1', status: VacancyStatus.CLOSED, applications: [] });
      await expect(service.publishVacancy('v1')).rejects.toThrow(ConflictException);
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('findRequisitions scopes results to the caller\'s viewable entities', async () => {
      prisma.jobRequisition.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.findRequisitions(scope, undefined, undefined);

      expect(prisma.jobRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ entityId: { in: ['ent-1'] } }, expect.any(Object)] },
        }),
      );
    });

    it('findOneRequisition 404s when the requisition is outside the caller\'s scope', async () => {
      prisma.jobRequisition.findUnique.mockResolvedValue({
        id: 'jr1',
        entityId: 'ent-2',
        departmentId: null,
        costCenterId: null,
        projectId: null,
      });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await expect(service.findOneRequisition('jr1', scope)).rejects.toThrow('Job requisition jr1 not found');
    });
  });

  describe('recruiterDashboard', () => {
    it('includes a calendarSyncFailures count alongside the existing widgets', async () => {
      prisma.vacancy.count.mockResolvedValue(3);
      prisma.jobRequisition.count.mockResolvedValue(2);
      prisma.jobApplication.groupBy.mockResolvedValue([{ stage: 'APPLIED', _count: { _all: 5 } }]);
      // Same interview.count mock is used for the upcoming-interviews,
      // calendarSyncFailures, and teamsSyncFailures queries in the
      // underlying Promise.all — distinguish them by the `where` shape
      // each call is made with.
      prisma.interview.count.mockImplementation(({ where }: any) => {
        if (where.teamsSyncFailedAt) return Promise.resolve(2);
        if (where.calendarSyncFailedAt) return Promise.resolve(1);
        return Promise.resolve(4);
      });

      const result = await service.recruiterDashboard('ent-1');

      expect(result.upcomingInterviews).toBe(4);
      expect(result.calendarSyncFailures).toBe(1);
      expect(result.teamsSyncFailures).toBe(2);
      expect(result.pipelineByStage).toEqual([{ stage: 'APPLIED', count: 5 }]);
    });
  });
});
