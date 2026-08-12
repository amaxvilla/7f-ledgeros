import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectTaskStatus } from '@prisma/client';
import { SchedulingService } from '../scheduling.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';

describe('SchedulingService', () => {
  let service: SchedulingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      projectTask: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      taskDependency: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn((ops: any) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [SchedulingService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(SchedulingService);
  });

  describe('createTask', () => {
    it('rejects plannedEnd before plannedStart', async () => {
      await expect(
        service.createTask(
          { projectId: 'p1', entityId: 'e1', name: 'Foundation', plannedStart: '2026-08-10', plannedEnd: '2026-08-01' } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing parent task', async () => {
      prisma.projectTask.findUnique.mockResolvedValue(null);
      await expect(
        service.createTask(
          { projectId: 'p1', entityId: 'e1', name: 'Foundation', parentTaskId: 'missing', plannedStart: '2026-08-01', plannedEnd: '2026-08-10' } as any,
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a task', async () => {
      prisma.projectTask.create.mockResolvedValue({ id: 't1' });
      const result = await service.createTask(
        { projectId: 'p1', entityId: 'e1', name: 'Foundation', plannedStart: '2026-08-01', plannedEnd: '2026-08-10' } as any,
        'u1',
      );
      expect(result.id).toBe('t1');
    });
  });

  describe('updateProgress', () => {
    it('derives NOT_STARTED / IN_PROGRESS / COMPLETED from percentComplete', async () => {
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1', status: ProjectTaskStatus.NOT_STARTED, actualStart: null, actualEnd: null, actualCost: null });
      prisma.projectTask.update.mockImplementation(({ data }: any) => ({ id: 't1', ...data }));

      const mid = await service.updateProgress('t1', { percentComplete: 40 } as any);
      expect(mid.status).toBe(ProjectTaskStatus.IN_PROGRESS);

      const done = await service.updateProgress('t1', { percentComplete: 100 } as any);
      expect(done.status).toBe(ProjectTaskStatus.COMPLETED);
      expect(done.actualEnd).toBeInstanceOf(Date);
    });

    it('rejects updating a CANCELLED task', async () => {
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1', status: ProjectTaskStatus.CANCELLED });
      await expect(service.updateProgress('t1', { percentComplete: 50 } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('addDependency', () => {
    it('rejects a task depending on itself', async () => {
      await expect(service.addDependency({ predecessorId: 't1', successorId: 't1' } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects tasks from different projects', async () => {
      prisma.projectTask.findUnique
        .mockResolvedValueOnce({ id: 't1', projectId: 'p1' })
        .mockResolvedValueOnce({ id: 't2', projectId: 'p2' });
      await expect(service.addDependency({ predecessorId: 't1', successorId: 't2' } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate dependency', async () => {
      prisma.projectTask.findUnique
        .mockResolvedValueOnce({ id: 't1', projectId: 'p1' })
        .mockResolvedValueOnce({ id: 't2', projectId: 'p1' });
      prisma.taskDependency.findUnique.mockResolvedValue({ id: 'd1' });
      await expect(service.addDependency({ predecessorId: 't1', successorId: 't2' } as any)).rejects.toThrow(ConflictException);
    });

    it('rejects a dependency that would create a cycle', async () => {
      prisma.projectTask.findUnique
        .mockResolvedValueOnce({ id: 't2', projectId: 'p1' })
        .mockResolvedValueOnce({ id: 't1', projectId: 'p1' });
      prisma.taskDependency.findUnique.mockResolvedValue(null);
      // t1 -> t2 already exists; adding t2 -> t1 would cycle.
      prisma.taskDependency.findMany.mockImplementation(({ where }: any) =>
        where.predecessorId === 't1' ? Promise.resolve([{ successorId: 't2' }]) : Promise.resolve([]),
      );

      await expect(service.addDependency({ predecessorId: 't2', successorId: 't1' } as any)).rejects.toThrow(BadRequestException);
    });

    it('creates a valid dependency', async () => {
      prisma.projectTask.findUnique
        .mockResolvedValueOnce({ id: 't1', projectId: 'p1' })
        .mockResolvedValueOnce({ id: 't2', projectId: 'p1' });
      prisma.taskDependency.findUnique.mockResolvedValue(null);
      prisma.taskDependency.findMany.mockResolvedValue([]);
      prisma.taskDependency.create.mockResolvedValue({ id: 'd1' });

      const result = await service.addDependency({ predecessorId: 't1', successorId: 't2' } as any);
      expect(result.id).toBe('d1');
    });
  });

  describe('computeCriticalPath', () => {
    it('identifies the critical path across a simple 3-task chain with slack on a side branch', async () => {
      // t1 (5d) -> t2 (5d) -> t4 (5d) is the critical path (15d).
      // t3 (2d) also depends on t1 and feeds t4, but is shorter, so it has float.
      const day = (n: number) => new Date(2026, 0, n);
      prisma.projectTask.findMany.mockResolvedValue([
        { id: 't1', plannedStart: day(1), plannedEnd: day(6) }, // 5 days
        { id: 't2', plannedStart: day(6), plannedEnd: day(11) }, // 5 days
        { id: 't3', plannedStart: day(6), plannedEnd: day(8) }, // 2 days
        { id: 't4', plannedStart: day(11), plannedEnd: day(16) }, // 5 days
      ]);
      prisma.taskDependency.findMany.mockResolvedValue([
        { predecessorId: 't1', successorId: 't2', lagDays: 0 },
        { predecessorId: 't1', successorId: 't3', lagDays: 0 },
        { predecessorId: 't2', successorId: 't4', lagDays: 0 },
        { predecessorId: 't3', successorId: 't4', lagDays: 0 },
      ]);

      const result = await service.computeCriticalPath('p1');

      const byId = new Map(result.tasks.map((t: any) => [t.id, t]));
      expect(byId.get('t1').isCritical).toBe(true);
      expect(byId.get('t2').isCritical).toBe(true);
      expect(byId.get('t4').isCritical).toBe(true);
      expect(byId.get('t3').isCritical).toBe(false);
      expect(byId.get('t3').floatDays).toBeGreaterThan(0);
      expect(result.projectDurationDays).toBe(15);
    });

    it('returns an empty result for a project with no tasks', async () => {
      prisma.projectTask.findMany.mockResolvedValue([]);
      const result = await service.computeCriticalPath('empty-project');
      expect(result.tasks).toEqual([]);
    });
  });

  describe('computeEarnedValue', () => {
    it('computes PV/EV/AC/SPI/CPI for a fully-elapsed, half-complete task', async () => {
      prisma.projectTask.findMany.mockResolvedValue([
        {
          id: 't1',
          plannedStart: new Date(2026, 0, 1),
          plannedEnd: new Date(2026, 0, 11), // 10-day task
          budgetedCost: 10000,
          percentComplete: 50,
          actualCost: 6000,
        },
      ]);

      // asOfDate after plannedEnd -> full PV recognized.
      const result = await service.computeEarnedValue('p1', '2026-01-15');

      expect(result.PV).toBe(10000);
      expect(result.EV).toBe(5000);
      expect(result.AC).toBe(6000);
      expect(result.SV).toBe(-5000);
      expect(result.CV).toBe(-1000);
      expect(result.SPI).toBeCloseTo(0.5);
      expect(result.CPI).toBeCloseTo(0.8333, 3);
    });

    it('returns null SPI/CPI when PV/AC are zero rather than dividing by zero', async () => {
      prisma.projectTask.findMany.mockResolvedValue([
        { id: 't1', plannedStart: new Date(2026, 0, 10), plannedEnd: new Date(2026, 0, 20), budgetedCost: 5000, percentComplete: 0, actualCost: null },
      ]);

      const result = await service.computeEarnedValue('p1', '2026-01-01');

      expect(result.PV).toBe(0);
      expect(result.SPI).toBeNull();
      expect(result.CPI).toBeNull();
    });

    it('Release K: applies the optional entityId filter additively when provided', async () => {
      prisma.projectTask.findMany.mockResolvedValue([]);
      await service.computeEarnedValue('p1', '2026-01-01', 'ent-1');
      expect(prisma.projectTask.findMany).toHaveBeenCalledWith({ where: { projectId: 'p1', entityId: 'ent-1' } });
    });

    it('Release K: omits the entityId filter entirely when not provided (existing callers unaffected)', async () => {
      prisma.projectTask.findMany.mockResolvedValue([]);
      await service.computeEarnedValue('p1', '2026-01-01');
      expect(prisma.projectTask.findMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
    });
  });

  describe('getGanttData (Release K: optional entityId filter)', () => {
    it('filters both the task and dependency queries by entityId when provided', async () => {
      prisma.projectTask.findMany.mockResolvedValue([]);
      prisma.taskDependency.findMany.mockResolvedValue([]);

      await service.getGanttData('p1', 'ent-1');

      expect(prisma.projectTask.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', entityId: 'ent-1' },
        orderBy: { plannedStart: 'asc' },
      });
      expect(prisma.taskDependency.findMany).toHaveBeenCalledWith({
        where: { predecessor: { projectId: 'p1', entityId: 'ent-1' } },
      });
    });

    it('omits the entityId filter entirely when not provided (existing callers unaffected)', async () => {
      prisma.projectTask.findMany.mockResolvedValue([]);
      prisma.taskDependency.findMany.mockResolvedValue([]);

      await service.getGanttData('p1');

      expect(prisma.projectTask.findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1' },
        orderBy: { plannedStart: 'asc' },
      });
      expect(prisma.taskDependency.findMany).toHaveBeenCalledWith({
        where: { predecessor: { projectId: 'p1' } },
      });
    });
  });
});
