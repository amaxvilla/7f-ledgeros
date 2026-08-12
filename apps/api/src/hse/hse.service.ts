import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CorrectiveActionStatus, HseCaseStatus, IncidentSeverity, InspectionResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksProviderRegistry } from '../tasks/tasks-provider.registry';
import { MS_GRAPH_TASKS_PROVIDER_CODE } from '../tasks/providers/microsoft-graph-tasks.provider';

interface CreateIncidentReportDto {
  entityId: string;
  projectId?: string;
  incidentDate: string;
  location?: string;
  description: string;
  severity: IncidentSeverity;
  reportedById: string;
}

interface CreateNearMissDto {
  entityId: string;
  projectId?: string;
  occurredAt: string;
  location?: string;
  description: string;
  reportedById: string;
}

interface CreatePpeIssuanceDto {
  entityId: string;
  employeeId: string;
  itemName: string;
  quantity: number;
  issuedDate: string;
  expiryDate?: string;
  createdById: string;
}

interface CreateToolboxTalkDto {
  entityId: string;
  projectId?: string;
  topic: string;
  talkDate: string;
  conductedById: string;
  attendeeCount: number;
  notes?: string;
}

interface CreateCorrectiveActionDto {
  incidentReportId?: string;
  nearMissId?: string;
  description: string;
  assignedToId?: string;
  dueDate: string;
  createdById: string;
}

interface CreateInspectionChecklistDto {
  entityId: string;
  projectId?: string;
  checklistType: string;
  inspectionDate: string;
  inspectorId: string;
  items: { itemDescription: string }[];
}

@Injectable()
export class HseService {
  private readonly logger = new Logger(HseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksProviders: TasksProviderRegistry,
  ) {}

  // ---- Incident reports ----

  createIncidentReport(dto: CreateIncidentReportDto) {
    return this.prisma.incidentReport.create({
      data: {
        entityId: dto.entityId,
        projectId: dto.projectId,
        incidentDate: new Date(dto.incidentDate),
        location: dto.location,
        description: dto.description,
        severity: dto.severity,
        reportedById: dto.reportedById,
        status: HseCaseStatus.OPEN,
      },
    });
  }

  findIncidentReports(entityId?: string, status?: HseCaseStatus) {
    return this.prisma.incidentReport.findMany({
      where: { ...(entityId ? { entityId } : {}), ...(status ? { status } : {}) },
      include: { correctiveActions: true },
      orderBy: { incidentDate: 'desc' },
    });
  }

  async advanceIncidentStatus(id: string, status: HseCaseStatus) {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id },
      include: { correctiveActions: true },
    });
    if (!incident) throw new NotFoundException(`Incident report ${id} not found`);

    if (status === HseCaseStatus.CLOSED) {
      const openActions = incident.correctiveActions.filter(
        (a) => a.status !== CorrectiveActionStatus.COMPLETED,
      );
      if (openActions.length > 0) {
        throw new ConflictException(
          `Cannot close incident: ${openActions.length} corrective action(s) are not yet COMPLETED`,
        );
      }
    }

    return this.prisma.incidentReport.update({ where: { id }, data: { status } });
  }

  // ---- Near misses ----

  createNearMiss(dto: CreateNearMissDto) {
    return this.prisma.nearMiss.create({
      data: {
        entityId: dto.entityId,
        projectId: dto.projectId,
        occurredAt: new Date(dto.occurredAt),
        location: dto.location,
        description: dto.description,
        reportedById: dto.reportedById,
        status: HseCaseStatus.OPEN,
      },
    });
  }

  findNearMisses(entityId?: string, status?: HseCaseStatus) {
    return this.prisma.nearMiss.findMany({
      where: { ...(entityId ? { entityId } : {}), ...(status ? { status } : {}) },
      include: { correctiveActions: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async advanceNearMissStatus(id: string, status: HseCaseStatus) {
    const nearMiss = await this.prisma.nearMiss.findUnique({ where: { id } });
    if (!nearMiss) throw new NotFoundException(`Near miss ${id} not found`);
    return this.prisma.nearMiss.update({ where: { id }, data: { status } });
  }

  // ---- PPE issuance ----

  async issuePpe(dto: CreatePpeIssuanceDto) {
    if (dto.quantity <= 0) throw new BadRequestException('Quantity must be positive');
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException(`Employee ${dto.employeeId} not found`);

    return this.prisma.ppeIssuance.create({
      data: {
        entityId: dto.entityId,
        employeeId: dto.employeeId,
        itemName: dto.itemName,
        quantity: dto.quantity,
        issuedDate: new Date(dto.issuedDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        createdById: dto.createdById,
      },
    });
  }

  findPpeIssuances(employeeId?: string) {
    return this.prisma.ppeIssuance.findMany({
      where: employeeId ? { employeeId } : undefined,
      orderBy: { issuedDate: 'desc' },
    });
  }

  /** PPE items issued with an expiry date on or before the given date — due for replacement. */
  findExpiringPpe(entityId: string, onOrBefore: string) {
    return this.prisma.ppeIssuance.findMany({
      where: { entityId, expiryDate: { lte: new Date(onOrBefore) } },
      include: { employee: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // ---- Toolbox talks ----

  createToolboxTalk(dto: CreateToolboxTalkDto) {
    if (dto.attendeeCount < 0) throw new BadRequestException('Attendee count cannot be negative');
    return this.prisma.toolboxTalk.create({
      data: {
        entityId: dto.entityId,
        projectId: dto.projectId,
        topic: dto.topic,
        talkDate: new Date(dto.talkDate),
        conductedById: dto.conductedById,
        attendeeCount: dto.attendeeCount,
        notes: dto.notes,
      },
    });
  }

  findToolboxTalks(entityId?: string, projectId?: string) {
    return this.prisma.toolboxTalk.findMany({
      where: { ...(entityId ? { entityId } : {}), ...(projectId ? { projectId } : {}) },
      orderBy: { talkDate: 'desc' },
    });
  }

  // ---- Corrective actions ----

  async createCorrectiveAction(dto: CreateCorrectiveActionDto) {
    if (!dto.incidentReportId && !dto.nearMissId) {
      throw new BadRequestException('A corrective action must reference an incident report or a near miss');
    }
    const action = await this.prisma.correctiveAction.create({
      data: {
        incidentReportId: dto.incidentReportId,
        nearMissId: dto.nearMissId,
        description: dto.description,
        assignedToId: dto.assignedToId,
        dueDate: new Date(dto.dueDate),
        createdById: dto.createdById,
        status: CorrectiveActionStatus.OPEN,
      },
    });

    // Microsoft To Do sync (Release IG.1, Checkpoint M) — best-effort,
    // same shape as InterviewService.schedule()'s calendar sync and
    // CandidateService.upsertCandidate()'s contact sync: a
    // TasksProvider failure must never lose the corrective-action row
    // that already exists above. A corrective action maps onto
    // TasksProvider more directly than either of those two callers did
    // onto their own providers — it already has a title-shaped
    // `description` and a real `dueDate`, exactly TaskParams's two
    // required-ish fields, with no reshaping needed.
    const synced = await this.trySyncCreate(action.id, { title: action.description, dueDateTime: action.dueDate });
    return synced ?? action;
  }

  /**
   * Best-effort Microsoft To Do task creation for a just-created
   * corrective action. Returns the updated row (with providerTaskId/
   * taskProviderCode set) on success, or undefined if sync was
   * skipped/failed — callers fall back to the pre-sync row they already
   * have. Hardcoded to MS_GRAPH_TASKS_PROVIDER_CODE, same reasoning
   * InterviewService.trySyncCreate's and CandidateService.trySyncCreate's
   * own doc comments give: the only provider IG.1 has built for this
   * sub-area.
   */
  private async trySyncCreate(actionId: string, params: { title: string; dueDateTime: Date }) {
    if (!this.tasksProviders.isRegistered(MS_GRAPH_TASKS_PROVIDER_CODE)) return undefined;

    try {
      const provider = this.tasksProviders.get(MS_GRAPH_TASKS_PROVIDER_CODE);
      const result = await provider.createTask(params);

      return await this.prisma.correctiveAction.update({
        where: { id: actionId },
        data: { taskProviderCode: MS_GRAPH_TASKS_PROVIDER_CODE, providerTaskId: result.providerTaskId, taskSyncFailedAt: null },
      });
    } catch (err) {
      this.logger.warn(`Created corrective action ${actionId} but could not create its Microsoft To Do task: ${(err as Error).message}`);
      await this.tryMarkSyncFailed(actionId);
      return undefined;
    }
  }

  /**
   * Best-effort persistence of the task-sync failure flag itself.
   * Deliberately isolated from the try/catch it's called from, same
   * reasoning InterviewService.tryMarkSyncFailed's and
   * CandidateService.tryMarkSyncFailed's own doc comments give: if THIS
   * update also fails, it must not throw past the caller.
   */
  private async tryMarkSyncFailed(actionId: string): Promise<void> {
    try {
      await this.prisma.correctiveAction.update({ where: { id: actionId }, data: { taskSyncFailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Could not persist taskSyncFailedAt for corrective action ${actionId}: ${(err as Error).message}`);
    }
  }

  findCorrectiveActions(filter?: { assignedToId?: string; status?: CorrectiveActionStatus }) {
    return this.prisma.correctiveAction.findMany({
      where: {
        ...(filter?.assignedToId ? { assignedToId: filter.assignedToId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async completeCorrectiveAction(id: string) {
    const action = await this.prisma.correctiveAction.findUnique({ where: { id } });
    if (!action) throw new NotFoundException(`Corrective action ${id} not found`);
    const updated = await this.prisma.correctiveAction.update({
      where: { id },
      data: { status: CorrectiveActionStatus.COMPLETED, completedAt: new Date() },
    });

    // Completion-sync (Release IG.1, Checkpoint M) — mirrors
    // InterviewService.reschedule()'s own calendarEventId-guarded
    // updateEvent block: only runs when a prior create-sync actually
    // landed (providerTaskId + taskProviderCode both set), marks the
    // Microsoft To Do task completed, and — same as reschedule() —
    // clears a previously-set failure flag on success but leaves it
    // alone on failure (tryMarkSyncFailed already does the "set" side).
    if (action.providerTaskId && action.taskProviderCode) {
      try {
        const provider = this.tasksProviders.get(action.taskProviderCode);
        await provider.updateTask({ providerTaskId: action.providerTaskId, completed: true });
        if (action.taskSyncFailedAt) {
          return await this.prisma.correctiveAction.update({ where: { id }, data: { taskSyncFailedAt: null } });
        }
      } catch (err) {
        this.logger.warn(
          `Completed corrective action ${id} but could not complete its Microsoft To Do task ${action.providerTaskId}: ${(err as Error).message}`,
        );
        await this.tryMarkSyncFailed(id);
      }
    }

    return updated;
  }

  /** Flags OPEN/IN_PROGRESS actions whose due date has passed as OVERDUE. */
  async flagOverdueCorrectiveActions(asOf: string) {
    const result = await this.prisma.correctiveAction.updateMany({
      where: {
        status: { in: [CorrectiveActionStatus.OPEN, CorrectiveActionStatus.IN_PROGRESS] },
        dueDate: { lt: new Date(asOf) },
      },
      data: { status: CorrectiveActionStatus.OVERDUE },
    });
    return { flagged: result.count };
  }

  // ---- Inspection checklists ----

  async createInspectionChecklist(dto: CreateInspectionChecklistDto) {
    if (dto.items.length === 0) throw new BadRequestException('Checklist needs at least one item');
    return this.prisma.inspectionChecklist.create({
      data: {
        entityId: dto.entityId,
        projectId: dto.projectId,
        checklistType: dto.checklistType,
        inspectionDate: new Date(dto.inspectionDate),
        inspectorId: dto.inspectorId,
        items: { create: dto.items.map((i) => ({ itemDescription: i.itemDescription })) },
      },
      include: { items: true },
    });
  }

  async recordItemResult(itemId: string, isCompliant: boolean, remarks?: string) {
    const item = await this.prisma.inspectionChecklistItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Checklist item ${itemId} not found`);
    return this.prisma.inspectionChecklistItem.update({
      where: { id: itemId },
      data: { isCompliant, remarks },
    });
  }

  /**
   * Derives the checklist's overall result from its items: any
   * non-compliant item fails the checklist; all-compliant passes; a mix
   * of compliant plus not-yet-assessed items resolves to
   * PASS_WITH_OBSERVATIONS once every item has been recorded, otherwise
   * throws until the inspection is complete.
   */
  async finalizeChecklist(id: string) {
    const checklist = await this.prisma.inspectionChecklist.findUnique({ where: { id }, include: { items: true } });
    if (!checklist) throw new NotFoundException(`Inspection checklist ${id} not found`);

    const unassessed = checklist.items.filter((i) => i.isCompliant === null);
    if (unassessed.length > 0) {
      throw new BadRequestException(`${unassessed.length} item(s) have not been assessed yet`);
    }

    const nonCompliant = checklist.items.filter((i) => i.isCompliant === false);
    let result: InspectionResult;
    if (nonCompliant.length === 0) {
      result = InspectionResult.PASS;
    } else if (nonCompliant.length === checklist.items.length) {
      result = InspectionResult.FAIL;
    } else {
      result = InspectionResult.PASS_WITH_OBSERVATIONS;
    }

    return this.prisma.inspectionChecklist.update({ where: { id }, data: { result } });
  }

  findInspectionChecklists(entityId?: string, projectId?: string) {
    return this.prisma.inspectionChecklist.findMany({
      where: { ...(entityId ? { entityId } : {}), ...(projectId ? { projectId } : {}) },
      include: { items: true },
      orderBy: { inspectionDate: 'desc' },
    });
  }
}
