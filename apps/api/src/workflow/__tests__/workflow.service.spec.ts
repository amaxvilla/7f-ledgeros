import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { WorkflowActionType, WorkflowInstanceStatus, WorkflowStageInstanceStatus } from '@prisma/client';
import { WorkflowEngineService } from '../workflow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

function buildPrismaMock() {
  return {
    workflowDefinition: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    workflowApprovalRule: { createMany: jest.fn() },
    workflowInstance: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    workflowStageInstance: { update: jest.fn() },
    workflowStageDefinition: { findUnique: jest.fn() },
    workflowAction: { create: jest.fn() },
    userRole: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    notifications = { create: jest.fn().mockResolvedValue({}) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(WorkflowEngineService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('startInstance', () => {
    const definition = {
      id: 'wf1',
      code: 'PO_APPROVAL',
      isActive: true,
      stages: [
        { id: 'stageA', sequence: 1, name: 'Dept Head', stageType: 'APPROVAL', requiredRoleCode: 'DEPT_HEAD', minApprovals: 1, rules: [] },
        { id: 'stageB', sequence: 2, name: 'CFO', stageType: 'APPROVAL', requiredRoleCode: 'FINANCE_MANAGER', minApprovals: 1, rules: [] },
      ],
      rules: [
        {
          id: 'rule1',
          stageDefinitionId: 'stageB',
          field: 'AMOUNT',
          operator: 'GT',
          value: '10000000',
          requiredRoleCode: 'CFO',
        },
      ],
    };

    it('skips a stage whose workflow-level rule does not match the context', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue(definition);
      prisma.workflowInstance.create.mockImplementation(({ data }: any) => ({
        id: 'inst1',
        ...data,
        stageInstances: data.stageInstances.create,
      }));

      const result: any = await service.startInstance(
        { workflowCode: 'PO_APPROVAL', entityType: 'PurchaseOrder', entityId: 'po1', context: { amount: 2_000_000 } } as any,
        'u1',
      );

      // Only stageA should be instantiated — stageB's rule (AMOUNT GT 10m) doesn't match.
      expect(result.stageInstances).toHaveLength(1);
      expect(result.stageInstances[0].stageDefinitionId).toBe('stageA');
      expect(result.stageInstances[0].status).toBe(WorkflowStageInstanceStatus.ACTIVE);
      // Release G: the first (now-ACTIVE) stage's role holders get notified.
      expect(prisma.userRole.findMany).toHaveBeenCalledWith({
        where: { role: { code: 'DEPT_HEAD' } },
        select: { userId: true },
      });
    });

    it('includes a stage and overrides its role when the workflow-level rule matches', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue(definition);
      prisma.workflowInstance.create.mockImplementation(({ data }: any) => ({
        id: 'inst1',
        ...data,
        stageInstances: data.stageInstances.create,
      }));

      const result: any = await service.startInstance(
        { workflowCode: 'PO_APPROVAL', entityType: 'PurchaseOrder', entityId: 'po1', context: { amount: 15_000_000 } } as any,
        'u1',
      );

      expect(result.stageInstances).toHaveLength(2);
      const stageB = result.stageInstances[1];
      expect(stageB.stageDefinitionId).toBe('stageB');
      // Workflow-level rule overrides FINANCE_MANAGER -> CFO for this instance.
      expect(stageB.requiredRoleCode).toBe('CFO');
      expect(stageB.status).toBe(WorkflowStageInstanceStatus.PENDING);
    });

    it('rejects starting an inactive workflow definition', async () => {
      prisma.workflowDefinition.findUnique.mockResolvedValue({ ...definition, isActive: false });
      await expect(
        service.startInstance({ workflowCode: 'PO_APPROVAL', entityType: 'PurchaseOrder', entityId: 'po1', context: {} } as any, 'u1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('act', () => {
    it('rejects acting on a stage that requires a role the actor does not hold', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        stageInstances: [
          { id: 'si1', sequence: 1, status: WorkflowStageInstanceStatus.ACTIVE, requiredRoleCode: 'CFO', requiredApprovals: 1, approvalsReceived: 0 },
        ],
      });
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.act('inst1', { action: WorkflowActionType.APPROVE } as any, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('advances to the next stage once required approvals are met', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        stageInstances: [
          { id: 'si1', sequence: 1, status: WorkflowStageInstanceStatus.ACTIVE, requiredRoleCode: 'DEPT_HEAD', requiredApprovals: 1, approvalsReceived: 0, stageDefinitionId: 'stageA' },
          { id: 'si2', sequence: 2, status: WorkflowStageInstanceStatus.PENDING, requiredRoleCode: 'CFO', requiredApprovals: 1, approvalsReceived: 0, stageDefinitionId: 'stageB' },
        ],
      });
      prisma.userRole.findFirst.mockResolvedValue({ userId: 'u1', roleId: 'r1' });
      prisma.userRole.findMany.mockResolvedValue([{ userId: 'cfo1' }]);
      prisma.workflowAction.create.mockResolvedValue({});
      prisma.workflowStageInstance.update.mockResolvedValue({});
      prisma.workflowInstance.findUnique.mockResolvedValueOnce({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        stageInstances: [
          { id: 'si1', sequence: 1, status: WorkflowStageInstanceStatus.ACTIVE, requiredRoleCode: 'DEPT_HEAD', requiredApprovals: 1, approvalsReceived: 0, stageDefinitionId: 'stageA' },
          { id: 'si2', sequence: 2, status: WorkflowStageInstanceStatus.PENDING, requiredRoleCode: 'CFO', requiredApprovals: 1, approvalsReceived: 0, stageDefinitionId: 'stageB' },
        ],
      }).mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        stageInstances: [],
        workflowDefinition: {},
      });

      await service.act('inst1', { action: WorkflowActionType.APPROVE } as any, 'u1');

      expect(prisma.workflowStageInstance.update).toHaveBeenCalledWith({
        where: { id: 'si1' },
        data: { approvalsReceived: 1, status: WorkflowStageInstanceStatus.APPROVED, completedAt: expect.any(Date) },
      });
      expect(prisma.workflowStageInstance.update).toHaveBeenCalledWith({
        where: { id: 'si2' },
        data: { status: WorkflowStageInstanceStatus.ACTIVE, activatedAt: expect.any(Date) },
      });
      // Release G: the newly-activated stage's role holders get notified.
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'cfo1', title: 'Approval needed' }),
      );
    });

    it('rejects and ends the instance on REJECT', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        startedById: 'requester1',
        stageInstances: [
          { id: 'si1', sequence: 1, status: WorkflowStageInstanceStatus.ACTIVE, requiredRoleCode: null, requiredApprovals: 1, approvalsReceived: 0 },
        ],
      });
      prisma.workflowAction.create.mockResolvedValue({});
      prisma.workflowStageInstance.update.mockResolvedValue({});
      prisma.workflowInstance.update.mockResolvedValue({ id: 'inst1', status: WorkflowInstanceStatus.REJECTED });

      const result = await service.act('inst1', { action: WorkflowActionType.REJECT, comments: 'Budget exceeded' } as any, 'u1');

      expect(prisma.workflowInstance.update).toHaveBeenCalledWith({
        where: { id: 'inst1' },
        data: { status: WorkflowInstanceStatus.REJECTED, completedAt: expect.any(Date) },
      });
      expect((result as any).status).toBe(WorkflowInstanceStatus.REJECTED);
      // Release G: the original requester gets notified of the rejection.
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'requester1', title: 'Request rejected', body: 'Budget exceeded' }),
      );
    });

    it('rejects acting on a non-IN_PROGRESS instance', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({ id: 'inst1', status: WorkflowInstanceStatus.APPROVED, stageInstances: [] });
      await expect(service.act('inst1', { action: WorkflowActionType.APPROVE } as any, 'u1')).rejects.toThrow(ConflictException);
    });

    it('notifies the requester on RETURN', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        startedById: 'requester1',
        stageInstances: [
          { id: 'si1', sequence: 1, status: WorkflowStageInstanceStatus.ACTIVE, requiredRoleCode: null, requiredApprovals: 1, approvalsReceived: 0 },
        ],
      });
      prisma.workflowAction.create.mockResolvedValue({});
      prisma.workflowStageInstance.update.mockResolvedValue({});
      prisma.workflowInstance.update.mockResolvedValue({ id: 'inst1', status: WorkflowInstanceStatus.RETURNED });

      await service.act('inst1', { action: WorkflowActionType.RETURN, comments: 'Missing receipts' } as any, 'u1');

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'requester1', title: 'Request returned', body: 'Missing receipts' }),
      );
    });

    it('notifies the requester when the final stage completes', async () => {
      const activeStage = { id: 'si1', sequence: 1, status: WorkflowStageInstanceStatus.ACTIVE, requiredRoleCode: null, requiredApprovals: 1, approvalsReceived: 0, stageDefinitionId: 'stageA' };
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        startedById: 'requester1',
        stageInstances: [activeStage],
      });
      prisma.workflowAction.create.mockResolvedValue({});
      prisma.workflowStageInstance.update.mockResolvedValue({});
      prisma.workflowStageDefinition.findUnique.mockResolvedValue({ stageType: 'APPROVAL' });
      prisma.workflowInstance.update.mockResolvedValue({ id: 'inst1', status: WorkflowInstanceStatus.APPROVED });

      const result = await service.act('inst1', { action: WorkflowActionType.APPROVE } as any, 'u1');

      expect((result as any).status).toBe(WorkflowInstanceStatus.APPROVED);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'requester1', title: 'Request approved' }),
      );
    });
  });

  describe('resubmit', () => {
    it('rejects resubmitting an instance that is not RETURNED', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.IN_PROGRESS,
        stageInstances: [],
      });
      await expect(service.resubmit('inst1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('reactivates the first stage and flips the instance back to IN_PROGRESS', async () => {
      prisma.workflowInstance.findUnique.mockResolvedValue({
        id: 'inst1',
        status: WorkflowInstanceStatus.RETURNED,
        stageInstances: [{ id: 'si1', sequence: 1 }],
      });
      prisma.workflowStageInstance.update.mockResolvedValue({});
      prisma.workflowAction.create.mockResolvedValue({});
      prisma.workflowInstance.update.mockResolvedValue({ id: 'inst1', status: WorkflowInstanceStatus.IN_PROGRESS });

      const result = await service.resubmit('inst1', 'u1');

      expect(prisma.workflowStageInstance.update).toHaveBeenCalledWith({
        where: { id: 'si1' },
        data: { status: WorkflowStageInstanceStatus.ACTIVE, approvalsReceived: 0, activatedAt: expect.any(Date), completedAt: null },
      });
      expect((result as any).status).toBe(WorkflowInstanceStatus.IN_PROGRESS);
    });
  });
});
