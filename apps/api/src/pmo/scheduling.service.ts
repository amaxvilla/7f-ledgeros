import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  CreateProjectTaskDto,
  CreateTaskDependencyDto,
  SetTaskStatusDto,
  UpdateTaskProgressDto,
} from './dto/scheduling.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // =====================================================================
  // WBS — TASKS
  // =====================================================================

  async createTask(dto: CreateProjectTaskDto, createdById: string) {
    if (new Date(dto.plannedEnd) < new Date(dto.plannedStart)) {
      throw new BadRequestException('plannedEnd cannot be before plannedStart');
    }
    if (dto.parentTaskId) {
      const parent = await this.prisma.projectTask.findUnique({ where: { id: dto.parentTaskId } });
      if (!parent) throw new NotFoundException(`Parent task ${dto.parentTaskId} not found`);
    }

    return this.prisma.projectTask.create({
      data: {
        projectId: dto.projectId,
        entityId: dto.entityId,
        parentTaskId: dto.parentTaskId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isMilestone: dto.isMilestone,
        plannedStart: new Date(dto.plannedStart),
        plannedEnd: new Date(dto.plannedEnd),
        budgetedCost: dto.budgetedCost,
        createdById,
      },
    });
  }

  findTasks(scope: SecurityScope, filters: { projectId?: string; status?: ProjectTaskStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.projectTask.findMany({
      where: { AND: [rls, filters] },
      orderBy: [{ plannedStart: 'asc' }],
    });
  }

  async getTask(id: string) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id },
      include: { childTasks: true, predecessorOf: true, successorOf: true },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  private async requireTask(id: string) {
    const task = await this.prisma.projectTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /** Percent complete drives status automatically: 0 -> NOT_STARTED, 1-99 -> IN_PROGRESS, 100 -> COMPLETED (stamping actualEnd if not already set). */
  async updateProgress(id: string, dto: UpdateTaskProgressDto) {
    const task = await this.requireTask(id);
    if (task.status === ProjectTaskStatus.CANCELLED) {
      throw new ConflictException('Cannot update progress on a CANCELLED task');
    }

    const status =
      dto.percentComplete === 0
        ? ProjectTaskStatus.NOT_STARTED
        : dto.percentComplete === 100
          ? ProjectTaskStatus.COMPLETED
          : ProjectTaskStatus.IN_PROGRESS;

    return this.prisma.projectTask.update({
      where: { id },
      data: {
        percentComplete: dto.percentComplete,
        status,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : task.actualStart,
        actualEnd: dto.percentComplete === 100 ? (dto.actualEnd ? new Date(dto.actualEnd) : (task.actualEnd ?? new Date())) : task.actualEnd,
        actualCost: dto.actualCost ?? task.actualCost,
      },
    });
  }

  async setStatus(id: string, dto: SetTaskStatusDto) {
    await this.requireTask(id);
    return this.prisma.projectTask.update({ where: { id }, data: { status: dto.status } });
  }

  // =====================================================================
  // DEPENDENCIES
  // =====================================================================

  /**
   * Rejects a dependency that would create a cycle by checking whether the
   * successor can already reach the predecessor through the existing
   * dependency graph (a simple DFS) — without this check, computeCriticalPath
   * below has no well-defined answer.
   */
  async addDependency(dto: CreateTaskDependencyDto) {
    if (dto.predecessorId === dto.successorId) {
      throw new BadRequestException('A task cannot depend on itself');
    }
    const [predecessor, successor] = await Promise.all([
      this.prisma.projectTask.findUnique({ where: { id: dto.predecessorId } }),
      this.prisma.projectTask.findUnique({ where: { id: dto.successorId } }),
    ]);
    if (!predecessor) throw new NotFoundException(`Task ${dto.predecessorId} not found`);
    if (!successor) throw new NotFoundException(`Task ${dto.successorId} not found`);
    if (predecessor.projectId !== successor.projectId) {
      throw new BadRequestException('Both tasks must belong to the same project');
    }

    const existing = await this.prisma.taskDependency.findUnique({
      where: { predecessorId_successorId: { predecessorId: dto.predecessorId, successorId: dto.successorId } },
    });
    if (existing) throw new ConflictException('This dependency already exists');

    const wouldCycle = await this.canReach(dto.successorId, dto.predecessorId);
    if (wouldCycle) {
      throw new BadRequestException('This dependency would create a cycle in the task network');
    }

    return this.prisma.taskDependency.create({
      data: {
        predecessorId: dto.predecessorId,
        successorId: dto.successorId,
        type: dto.type,
        lagDays: dto.lagDays,
      },
    });
  }

  private async canReach(fromId: string, toId: string, visited = new Set<string>()): Promise<boolean> {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const edges = await this.prisma.taskDependency.findMany({ where: { predecessorId: fromId }, select: { successorId: true } });
    for (const edge of edges) {
      if (await this.canReach(edge.successorId, toId, visited)) return true;
    }
    return false;
  }

  // =====================================================================
  // CRITICAL PATH / GANTT
  // =====================================================================

  /**
   * Classic forward/backward-pass CPM over FINISH_TO_START-style lag
   * (every dependency type is treated as "successor cannot start before
   * predecessor's relevant date + lag" for this calculation — a documented
   * simplification; START_TO_START/FINISH_TO_FINISH/START_TO_FINISH are
   * stored faithfully but this release's float math only distinguishes
   * "must wait lagDays after predecessor", not the four distinct
   * relationship semantics). Persists isCritical/totalFloatDays on every
   * task and returns the full computed schedule.
   */
  async computeCriticalPath(projectId: string) {
    const tasks = await this.prisma.projectTask.findMany({ where: { projectId } });
    if (tasks.length === 0) return { tasks: [], projectEnd: null };

    const dependencies = await this.prisma.taskDependency.findMany({
      where: { predecessor: { projectId } },
    });

    const byId = new Map(tasks.map((t) => [t.id, t]));
    const durationDays = new Map(
      tasks.map((t) => [t.id, Math.max(1, Math.round((t.plannedEnd.getTime() - t.plannedStart.getTime()) / MS_PER_DAY))]),
    );
    const predecessorsOf = new Map<string, { id: string; lag: number }[]>();
    const successorsOf = new Map<string, { id: string; lag: number }[]>();
    for (const t of tasks) {
      predecessorsOf.set(t.id, []);
      successorsOf.set(t.id, []);
    }
    for (const dep of dependencies) {
      predecessorsOf.get(dep.successorId)?.push({ id: dep.predecessorId, lag: dep.lagDays });
      successorsOf.get(dep.predecessorId)?.push({ id: dep.successorId, lag: dep.lagDays });
    }

    // Topological order via Kahn's algorithm (cycle-free is guaranteed by
    // addDependency's check above, but we guard anyway rather than assume).
    const inDegree = new Map(tasks.map((t) => [t.id, predecessorsOf.get(t.id)!.length]));
    const queue = tasks.filter((t) => inDegree.get(t.id) === 0).map((t) => t.id);
    const order: string[] = [];
    const inDegreeWork = new Map(inDegree);
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const succ of successorsOf.get(id) ?? []) {
        inDegreeWork.set(succ.id, (inDegreeWork.get(succ.id) ?? 0) - 1);
        if (inDegreeWork.get(succ.id) === 0) queue.push(succ.id);
      }
    }
    if (order.length !== tasks.length) {
      throw new BadRequestException('Task network contains a cycle and cannot be scheduled — this should not happen if all dependencies went through addDependency()');
    }

    // Forward pass: earliest start/finish (in days from project start = 0).
    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();
    for (const id of order) {
      const preds = predecessorsOf.get(id) ?? [];
      const es = preds.length === 0 ? 0 : Math.max(...preds.map((p) => (earliestFinish.get(p.id) ?? 0) + p.lag));
      earliestStart.set(id, es);
      earliestFinish.set(id, es + durationDays.get(id)!);
    }

    const projectDuration = Math.max(...order.map((id) => earliestFinish.get(id)!));

    // Backward pass: latest start/finish.
    const latestFinish = new Map<string, number>();
    const latestStart = new Map<string, number>();
    for (const id of [...order].reverse()) {
      const succs = successorsOf.get(id) ?? [];
      const lf = succs.length === 0 ? projectDuration : Math.min(...succs.map((s) => (latestStart.get(s.id) ?? projectDuration) - s.lag));
      latestFinish.set(id, lf);
      latestStart.set(id, lf - durationDays.get(id)!);
    }

    const results = order.map((id) => {
      const floatDays = latestStart.get(id)! - earliestStart.get(id)!;
      return { id, floatDays, isCritical: floatDays === 0 };
    });

    await this.prisma.$transaction(
      results.map((r) => this.prisma.projectTask.update({ where: { id: r.id }, data: { isCritical: r.isCritical, totalFloatDays: r.floatDays } })),
    );

    return {
      projectDurationDays: projectDuration,
      tasks: results.map((r) => ({
        ...r,
        name: byId.get(r.id)!.name,
        plannedStart: byId.get(r.id)!.plannedStart,
        plannedEnd: byId.get(r.id)!.plannedEnd,
      })),
    };
  }

  /**
   * Shaped for a Gantt UI to consume directly: id, name, dates, progress,
   * parent, critical flag, and dependency edges.
   *
   * `entityId` is optional and additive (Release K — PMO Reporting
   * Integration): when provided, both queries are additionally filtered
   * by it, so a project that doesn't actually belong to that entity
   * simply returns no tasks — the same safe, no-error "AND entity_id ="
   * pattern the Reporting module's SQL views already use, rather than a
   * separate existence check. Existing callers (PmoController,
   * DashboardService) that only pass `projectId` are unaffected.
   */
  async getGanttData(projectId: string, entityId?: string) {
    const [tasks, dependencies] = await Promise.all([
      this.prisma.projectTask.findMany({ where: { projectId, ...(entityId ? { entityId } : {}) }, orderBy: { plannedStart: 'asc' } }),
      this.prisma.taskDependency.findMany({ where: { predecessor: { projectId, ...(entityId ? { entityId } : {}) } } }),
    ]);

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        parentTaskId: t.parentTaskId,
        name: t.name,
        start: t.plannedStart,
        end: t.plannedEnd,
        percentComplete: t.percentComplete,
        isMilestone: t.isMilestone,
        isCritical: t.isCritical,
        status: t.status,
      })),
      dependencies: dependencies.map((d) => ({ from: d.predecessorId, to: d.successorId, type: d.type, lagDays: d.lagDays })),
    };
  }

  // =====================================================================
  // EARNED VALUE MANAGEMENT
  // =====================================================================

  /**
   * PV/EV/AC computed per task and summed. PV uses linear time-phasing of
   * budgetedCost across the task's planned duration (a standard, documented
   * simplification — not S-curve-weighted). Tasks without a budgetedCost
   * contribute 0 to all three and are still counted, since an unbudgeted
   * task genuinely has no earned-value contribution to make.
   *
   * `entityId` is optional and additive (Release K — PMO Reporting
   * Integration) — see getGanttData's doc comment above for why.
   */
  async computeEarnedValue(projectId: string, asOfDate?: string, entityId?: string) {
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    const tasks = await this.prisma.projectTask.findMany({ where: { projectId, ...(entityId ? { entityId } : {}) } });

    let PV = 0;
    let EV = 0;
    let AC = 0;

    for (const t of tasks) {
      const budget = Number(t.budgetedCost ?? 0);
      const totalDays = Math.max(1, Math.round((t.plannedEnd.getTime() - t.plannedStart.getTime()) / MS_PER_DAY));
      const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((asOf.getTime() - t.plannedStart.getTime()) / MS_PER_DAY)));
      const taskPV = asOf >= t.plannedEnd ? budget : asOf <= t.plannedStart ? 0 : budget * (elapsedDays / totalDays);

      PV += taskPV;
      EV += budget * (t.percentComplete / 100);
      AC += Number(t.actualCost ?? 0);
    }

    const SV = EV - PV;
    const CV = EV - AC;
    const SPI = PV > 0 ? EV / PV : null;
    const CPI = AC > 0 ? EV / AC : null;

    return {
      projectId,
      asOfDate: asOf.toISOString(),
      taskCount: tasks.length,
      PV: round2(PV),
      EV: round2(EV),
      AC: round2(AC),
      SV: round2(SV),
      CV: round2(CV),
      SPI,
      CPI,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
