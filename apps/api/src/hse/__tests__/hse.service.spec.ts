import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CorrectiveActionStatus, HseCaseStatus, InspectionResult } from '@prisma/client';
import { HseService } from '../hse.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksProviderRegistry } from '../../tasks/tasks-provider.registry';
import { MS_GRAPH_TASKS_PROVIDER_CODE } from '../../tasks/providers/microsoft-graph-tasks.provider';

function buildTasksRegistryMock() {
  return { isRegistered: jest.fn(), get: jest.fn() };
}

describe('HseService', () => {
  let service: HseService;
  let prisma: any;
  let tasksRegistry: ReturnType<typeof buildTasksRegistryMock>;

  beforeEach(async () => {
    prisma = {
      incidentReport: { findUnique: jest.fn(), update: jest.fn() },
      nearMiss: { findUnique: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn() },
      ppeIssuance: { create: jest.fn() },
      correctiveAction: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
      inspectionChecklist: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      inspectionChecklistItem: { findUnique: jest.fn(), update: jest.fn() },
    };
    tasksRegistry = buildTasksRegistryMock();
    // Default: no tasks provider registered — most tests aren't about
    // task sync, so they should be unaffected by it (trySyncCreate's own
    // first line short-circuits on this), same pattern
    // interview.service.spec.ts's calendarRegistry default uses.
    tasksRegistry.isRegistered.mockReturnValue(false);

    const moduleRef = await Test.createTestingModule({
      providers: [
        HseService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasksProviderRegistry, useValue: tasksRegistry },
      ],
    }).compile();

    service = moduleRef.get(HseService);
  });

  describe('advanceIncidentStatus', () => {
    it('refuses to close an incident with outstanding corrective actions', async () => {
      prisma.incidentReport.findUnique.mockResolvedValue({
        id: 'inc-1',
        correctiveActions: [{ status: CorrectiveActionStatus.OPEN }],
      });
      await expect(service.advanceIncidentStatus('inc-1', HseCaseStatus.CLOSED)).rejects.toThrow(ConflictException);
    });

    it('allows closing once all corrective actions are completed', async () => {
      prisma.incidentReport.findUnique.mockResolvedValue({
        id: 'inc-1',
        correctiveActions: [{ status: CorrectiveActionStatus.COMPLETED }],
      });
      prisma.incidentReport.update.mockResolvedValue({ id: 'inc-1', status: HseCaseStatus.CLOSED });

      const result = await service.advanceIncidentStatus('inc-1', HseCaseStatus.CLOSED);
      expect(result.status).toBe(HseCaseStatus.CLOSED);
    });

    it('allows moving to INVESTIGATING regardless of corrective actions', async () => {
      prisma.incidentReport.findUnique.mockResolvedValue({
        id: 'inc-1',
        correctiveActions: [{ status: CorrectiveActionStatus.OPEN }],
      });
      prisma.incidentReport.update.mockResolvedValue({ id: 'inc-1', status: HseCaseStatus.INVESTIGATING });

      const result = await service.advanceIncidentStatus('inc-1', HseCaseStatus.INVESTIGATING);
      expect(result.status).toBe(HseCaseStatus.INVESTIGATING);
    });

    it('throws NotFoundException for a missing incident', async () => {
      prisma.incidentReport.findUnique.mockResolvedValue(null);
      await expect(service.advanceIncidentStatus('missing', HseCaseStatus.CLOSED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCorrectiveAction', () => {
    it('requires a reference to an incident or a near miss', async () => {
      await expect(
        service.createCorrectiveAction({
          description: 'Fix the guardrail',
          dueDate: '2026-08-01',
          createdById: 'u1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a corrective action tied to an incident report', async () => {
      prisma.correctiveAction.create.mockResolvedValue({ id: 'ca-1' });
      const result = await service.createCorrectiveAction({
        incidentReportId: 'inc-1',
        description: 'Fix the guardrail',
        dueDate: '2026-08-01',
        createdById: 'u1',
      });
      expect(result.id).toBe('ca-1');
    });

    describe('Microsoft To Do sync (Release IG.1, Checkpoint M)', () => {
      const createdAction = { id: 'ca-1', description: 'Fix the guardrail', dueDate: new Date('2026-08-01') };

      it('creates a Microsoft To Do task and persists providerTaskId when a tasks provider is registered', async () => {
        prisma.correctiveAction.create.mockResolvedValue(createdAction);
        tasksRegistry.isRegistered.mockReturnValue(true);
        const provider = { createTask: jest.fn().mockResolvedValue({ providerTaskId: 'AAMk-task-1' }) };
        tasksRegistry.get.mockReturnValue(provider);
        prisma.correctiveAction.update.mockResolvedValue({ ...createdAction, providerTaskId: 'AAMk-task-1', taskProviderCode: MS_GRAPH_TASKS_PROVIDER_CODE });

        const result = await service.createCorrectiveAction({
          incidentReportId: 'inc-1',
          description: 'Fix the guardrail',
          dueDate: '2026-08-01',
          createdById: 'u1',
        });

        expect(provider.createTask).toHaveBeenCalledWith({ title: 'Fix the guardrail', dueDateTime: createdAction.dueDate });
        expect(prisma.correctiveAction.update).toHaveBeenCalledWith({
          where: { id: 'ca-1' },
          data: { taskProviderCode: MS_GRAPH_TASKS_PROVIDER_CODE, providerTaskId: 'AAMk-task-1', taskSyncFailedAt: null },
        });
        expect(result.providerTaskId).toBe('AAMk-task-1');
      });

      it('falls back to the pre-sync row and flags taskSyncFailedAt when the task provider throws', async () => {
        prisma.correctiveAction.create.mockResolvedValue(createdAction);
        tasksRegistry.isRegistered.mockReturnValue(true);
        const provider = { createTask: jest.fn().mockRejectedValue(new Error('Graph down')) };
        tasksRegistry.get.mockReturnValue(provider);

        const result = await service.createCorrectiveAction({
          incidentReportId: 'inc-1',
          description: 'Fix the guardrail',
          dueDate: '2026-08-01',
          createdById: 'u1',
        });

        expect(result).toEqual(createdAction); // unsynced fallback — the row itself is never lost
        expect(prisma.correctiveAction.update).toHaveBeenCalledWith({ where: { id: 'ca-1' }, data: { taskSyncFailedAt: expect.any(Date) } });
      });

      it('skips sync entirely (no throw) when no tasks provider is registered', async () => {
        prisma.correctiveAction.create.mockResolvedValue(createdAction);
        // tasksRegistry.isRegistered already defaults to false from beforeEach.
        const result = await service.createCorrectiveAction({
          incidentReportId: 'inc-1',
          description: 'Fix the guardrail',
          dueDate: '2026-08-01',
          createdById: 'u1',
        });
        expect(result).toEqual(createdAction);
        expect(prisma.correctiveAction.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('completeCorrectiveAction', () => {
    it('throws NotFoundException for an unknown corrective action', async () => {
      prisma.correctiveAction.findUnique.mockResolvedValue(null);
      await expect(service.completeCorrectiveAction('missing')).rejects.toThrow(NotFoundException);
    });

    it('marks the action COMPLETED even when it was never task-synced', async () => {
      prisma.correctiveAction.findUnique.mockResolvedValue({ id: 'ca-1', providerTaskId: null, taskProviderCode: null });
      prisma.correctiveAction.update.mockResolvedValue({ id: 'ca-1', status: CorrectiveActionStatus.COMPLETED });

      const result = await service.completeCorrectiveAction('ca-1');

      expect(result.status).toBe(CorrectiveActionStatus.COMPLETED);
      expect(tasksRegistry.get).not.toHaveBeenCalled();
    });

    it('marks the linked Microsoft To Do task completed and clears a previously-set failure flag', async () => {
      prisma.correctiveAction.findUnique.mockResolvedValue({
        id: 'ca-1',
        providerTaskId: 'AAMk-task-1',
        taskProviderCode: MS_GRAPH_TASKS_PROVIDER_CODE,
        taskSyncFailedAt: new Date('2026-07-01'),
      });
      prisma.correctiveAction.update
        .mockResolvedValueOnce({ id: 'ca-1', status: CorrectiveActionStatus.COMPLETED })
        .mockResolvedValueOnce({ id: 'ca-1', status: CorrectiveActionStatus.COMPLETED, taskSyncFailedAt: null });
      const provider = { updateTask: jest.fn().mockResolvedValue(undefined) };
      tasksRegistry.get.mockReturnValue(provider);

      const result = await service.completeCorrectiveAction('ca-1');

      expect(provider.updateTask).toHaveBeenCalledWith({ providerTaskId: 'AAMk-task-1', completed: true });
      expect(prisma.correctiveAction.update).toHaveBeenLastCalledWith({ where: { id: 'ca-1' }, data: { taskSyncFailedAt: null } });
      expect(result.taskSyncFailedAt).toBeNull();
    });

    it('does not issue an extra flag-clear write when the flag was never set', async () => {
      prisma.correctiveAction.findUnique.mockResolvedValue({
        id: 'ca-1',
        providerTaskId: 'AAMk-task-1',
        taskProviderCode: MS_GRAPH_TASKS_PROVIDER_CODE,
        taskSyncFailedAt: null,
      });
      prisma.correctiveAction.update.mockResolvedValue({ id: 'ca-1', status: CorrectiveActionStatus.COMPLETED });
      const provider = { updateTask: jest.fn().mockResolvedValue(undefined) };
      tasksRegistry.get.mockReturnValue(provider);

      await service.completeCorrectiveAction('ca-1');

      expect(prisma.correctiveAction.update).toHaveBeenCalledTimes(1); // only the COMPLETED write, no flag-clear write
    });

    it('flags taskSyncFailedAt (but still returns COMPLETED) when the linked task update fails', async () => {
      prisma.correctiveAction.findUnique.mockResolvedValue({
        id: 'ca-1',
        providerTaskId: 'AAMk-task-1',
        taskProviderCode: MS_GRAPH_TASKS_PROVIDER_CODE,
        taskSyncFailedAt: null,
      });
      prisma.correctiveAction.update.mockResolvedValue({ id: 'ca-1', status: CorrectiveActionStatus.COMPLETED });
      const provider = { updateTask: jest.fn().mockRejectedValue(new Error('Graph down')) };
      tasksRegistry.get.mockReturnValue(provider);

      const result = await service.completeCorrectiveAction('ca-1');

      expect(result.status).toBe(CorrectiveActionStatus.COMPLETED);
      expect(prisma.correctiveAction.update).toHaveBeenLastCalledWith({ where: { id: 'ca-1' }, data: { taskSyncFailedAt: expect.any(Date) } });
    });
  });

  describe('finalizeChecklist', () => {
    it('refuses to finalize until every item has been assessed', async () => {
      prisma.inspectionChecklist.findUnique.mockResolvedValue({
        id: 'chk-1',
        items: [{ isCompliant: true }, { isCompliant: null }],
      });
      await expect(service.finalizeChecklist('chk-1')).rejects.toThrow(BadRequestException);
    });

    it('resolves PASS when every item is compliant', async () => {
      prisma.inspectionChecklist.findUnique.mockResolvedValue({
        id: 'chk-1',
        items: [{ isCompliant: true }, { isCompliant: true }],
      });
      prisma.inspectionChecklist.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'chk-1', ...data }),
      );
      const result = await service.finalizeChecklist('chk-1');
      expect(result.result).toBe(InspectionResult.PASS);
    });

    it('resolves FAIL when every item is non-compliant', async () => {
      prisma.inspectionChecklist.findUnique.mockResolvedValue({
        id: 'chk-1',
        items: [{ isCompliant: false }, { isCompliant: false }],
      });
      prisma.inspectionChecklist.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'chk-1', ...data }),
      );
      const result = await service.finalizeChecklist('chk-1');
      expect(result.result).toBe(InspectionResult.FAIL);
    });

    it('resolves PASS_WITH_OBSERVATIONS for a mix of compliant and non-compliant items', async () => {
      prisma.inspectionChecklist.findUnique.mockResolvedValue({
        id: 'chk-1',
        items: [{ isCompliant: true }, { isCompliant: false }],
      });
      prisma.inspectionChecklist.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'chk-1', ...data }),
      );
      const result = await service.finalizeChecklist('chk-1');
      expect(result.result).toBe(InspectionResult.PASS_WITH_OBSERVATIONS);
    });
  });

  describe('flagOverdueCorrectiveActions', () => {
    it('reports how many actions were flagged', async () => {
      prisma.correctiveAction.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.flagOverdueCorrectiveActions('2026-08-01');
      expect(result.flagged).toBe(3);
    });
  });
});
