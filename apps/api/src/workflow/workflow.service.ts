import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  WorkflowActionType,
  WorkflowInstanceStatus,
  WorkflowRuleField,
  WorkflowRuleOperator,
  WorkflowStageInstanceStatus,
  WorkflowStageType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { StartWorkflowInstanceDto } from './dto/start-workflow-instance.dto';
import { ActOnWorkflowDto } from './dto/act-on-workflow.dto';

// Actions that advance a stage toward completion (subject to
// requiredApprovals). REJECT/RETURN end the instance; COMMENT is purely
// informational and never advances anything.
const ADVANCING_ACTIONS: WorkflowActionType[] = [
  WorkflowActionType.SUBMIT,
  WorkflowActionType.REVIEW,
  WorkflowActionType.APPROVE,
  WorkflowActionType.POST,
  WorkflowActionType.ARCHIVE,
];

interface RuleContext {
  amount?: number;
  departmentId?: string;
  projectId?: string;
  entityId?: string;
  role?: string;
  riskLevel?: string;
  budgetAvailable?: boolean;
}

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------------------
  // DEFINITIONS (admin/no-code configuration)
  // -------------------------------------------------------------------

  async createDefinition(dto: CreateWorkflowDefinitionDto) {
    const existing = await this.prisma.workflowDefinition.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Workflow definition ${dto.code} already exists`);

    const sequences = dto.stages.map((s) => s.sequence);
    if (new Set(sequences).size !== sequences.length) {
      throw new BadRequestException('Stage sequence numbers must be unique within a workflow');
    }

    const definition = await this.prisma.workflowDefinition.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        entityType: dto.entityType,
        stages: {
          create: dto.stages.map((stage) => ({
            sequence: stage.sequence,
            name: stage.name,
            stageType: stage.stageType,
            requiredRoleCode: stage.requiredRoleCode,
            minApprovals: stage.minApprovals ?? 1,
          })),
        },
      },
      include: { stages: true },
    });

    // WorkflowApprovalRule has two independent required-ish relations
    // (workflowDefinition, always; stageDefinition, optional). A rule
    // nested two levels deep under stages.create() can't also connect
    // the sibling workflowDefinition relation, so both stage-level and
    // workflow-level rules are created here in a single pass once the
    // stage ids exist.
    const stageBySequence = new Map<number, string>(definition.stages.map((s) => [s.sequence, s.id]));

    const stageRules = dto.stages.flatMap((stage) =>
      (stage.rules ?? []).map((r) => ({
        workflowDefinitionId: definition.id,
        stageDefinitionId: stageBySequence.get(stage.sequence) ?? null,
        field: r.field,
        operator: r.operator,
        value: r.value,
        requiredRoleCode: r.requiredRoleCode,
        description: r.description,
      })),
    );

    const workflowRules = (dto.workflowRules ?? []).map((r) => ({
      workflowDefinitionId: definition.id,
      stageDefinitionId: stageBySequence.get(r.appliesToStageSequence) ?? null,
      field: r.field,
      operator: r.operator,
      value: r.value,
      requiredRoleCode: r.requiredRoleCode,
      description: r.description,
    }));

    const allRules = [...stageRules, ...workflowRules];
    if (allRules.length) {
      await this.prisma.workflowApprovalRule.createMany({ data: allRules });
    }

    return this.findDefinition(definition.code);
  }

  async findDefinition(code: string) {
    const definition = await this.prisma.workflowDefinition.findUnique({
      where: { code },
      include: { stages: { include: { rules: true }, orderBy: { sequence: 'asc' } }, rules: true },
    });
    if (!definition) throw new NotFoundException(`Workflow definition ${code} not found`);
    return definition;
  }

  listDefinitions(entityType?: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { entityType, isActive: true },
      include: { stages: { orderBy: { sequence: 'asc' } } },
    });
  }

  // -------------------------------------------------------------------
  // INSTANCES
  // -------------------------------------------------------------------

  /**
   * Starts an approval process: evaluates each workflow-level rule
   * against `context` to decide which stages actually apply (a stage
   * with no matching workflow-level rule always applies), then creates
   * a WorkflowStageInstance per applicable stage — the first ACTIVE,
   * the rest PENDING. A stage-level rule (attached directly to a
   * stage) can override that stage's requiredRoleCode for this
   * instance (e.g. "require CFO specifically when AMOUNT GT 10m",
   * versus the stage's normal Finance Manager).
   */
  async startInstance(dto: StartWorkflowInstanceDto, userId: string) {
    const definition = await this.findDefinition(dto.workflowCode);
    if (!definition.isActive) throw new ConflictException(`Workflow ${dto.workflowCode} is not active`);

    const context = dto.context as RuleContext;

    const applicableStages = definition.stages.filter((stage) => {
      const skipRules = definition.rules.filter((r) => r.stageDefinitionId === stage.id);
      if (skipRules.length === 0) return true;
      // If any workflow-level rule targets this stage, the stage only
      // applies when at least one of those rules matches.
      return skipRules.some((rule) => this.evaluateRule(rule.field, rule.operator, rule.value, context));
    });

    if (applicableStages.length === 0) {
      throw new BadRequestException('No workflow stages apply to this context — check the workflow rules');
    }

    const instance = await this.prisma.workflowInstance.create({
      data: {
        workflowDefinitionId: definition.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        context: dto.context as Prisma.InputJsonValue,
        startedById: userId,
        stageInstances: {
          create: applicableStages.map((stage, i) => {
            const stageRoleOverride = stage.rules.find((r) =>
              this.evaluateRule(r.field, r.operator, r.value, context),
            )?.requiredRoleCode;
            return {
              stageDefinitionId: stage.id,
              sequence: stage.sequence,
              status: i === 0 ? WorkflowStageInstanceStatus.ACTIVE : WorkflowStageInstanceStatus.PENDING,
              requiredRoleCode: stageRoleOverride ?? stage.requiredRoleCode,
              requiredApprovals: stage.minApprovals,
              activatedAt: i === 0 ? new Date() : undefined,
            };
          }),
        },
      },
      include: { stageInstances: { orderBy: { sequence: 'asc' } } },
    });

    const firstStage = instance.stageInstances[0];
    if (firstStage?.requiredRoleCode) {
      await this.notifyRoleHolders(firstStage.requiredRoleCode, 'Approval needed', `${dto.workflowCode} awaiting your review`, {
        workflowInstanceId: instance.id,
        stageInstanceId: firstStage.id,
      });
    }

    return instance;
  }

  async getInstance(id: string) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        stageInstances: { orderBy: { sequence: 'asc' }, include: { stageDefinition: true, actions: true } },
        workflowDefinition: true,
      },
    });
    if (!instance) throw new NotFoundException(`Workflow instance ${id} not found`);
    return instance;
  }

  getInstancesForEntity(entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findMany({
      where: { entityType, entityId },
      include: { stageInstances: { orderBy: { sequence: 'asc' } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Records an action against the instance's currently-ACTIVE stage.
   * APPROVE/SUBMIT/REVIEW/POST/ARCHIVE advance the stage once enough
   * approvals are recorded (role-checked against the actor, when the
   * stage has a requiredRoleCode); REJECT/RETURN end the instance;
   * COMMENT never changes state.
   */
  async act(instanceId: string, dto: ActOnWorkflowDto, userId: string) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { stageInstances: { orderBy: { sequence: 'asc' } } },
    });
    if (!instance) throw new NotFoundException(`Workflow instance ${instanceId} not found`);
    if (instance.status !== WorkflowInstanceStatus.IN_PROGRESS) {
      throw new ConflictException(`Cannot act on an instance with status ${instance.status}`);
    }

    const activeStage = instance.stageInstances.find((s) => s.status === WorkflowStageInstanceStatus.ACTIVE);
    if (!activeStage) throw new ConflictException('No active stage on this instance');

    if (dto.action !== WorkflowActionType.COMMENT && activeStage.requiredRoleCode) {
      const hasRole = await this.prisma.userRole.findFirst({
        where: { userId, role: { code: activeStage.requiredRoleCode } },
      });
      if (!hasRole) {
        throw new BadRequestException(`This stage requires role ${activeStage.requiredRoleCode} to act`);
      }
    }

    await this.prisma.workflowAction.create({
      data: {
        workflowInstanceId: instanceId,
        stageInstanceId: activeStage.id,
        actorId: userId,
        action: dto.action,
        comments: dto.comments,
      },
    });

    if (dto.action === WorkflowActionType.REJECT) {
      await this.prisma.workflowStageInstance.update({
        where: { id: activeStage.id },
        data: { status: WorkflowStageInstanceStatus.REJECTED, completedAt: new Date() },
      });
      const rejected = await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: WorkflowInstanceStatus.REJECTED, completedAt: new Date() },
      });
      await this.notifyRequester(instance.startedById, 'Request rejected', dto.comments ?? `Instance ${instanceId} was rejected`, {
        workflowInstanceId: instanceId,
      });
      return rejected;
    }

    if (dto.action === WorkflowActionType.RETURN) {
      await this.prisma.workflowStageInstance.update({
        where: { id: activeStage.id },
        data: { status: WorkflowStageInstanceStatus.RETURNED, completedAt: new Date() },
      });
      const returned = await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: WorkflowInstanceStatus.RETURNED, completedAt: new Date() },
      });
      await this.notifyRequester(instance.startedById, 'Request returned', dto.comments ?? `Instance ${instanceId} was returned for changes`, {
        workflowInstanceId: instanceId,
      });
      return returned;
    }

    if (dto.action === WorkflowActionType.COMMENT) {
      return this.getInstance(instanceId);
    }

    if (!ADVANCING_ACTIONS.includes(dto.action)) {
      throw new BadRequestException(`Unsupported action ${dto.action}`);
    }

    const approvalsReceived = activeStage.approvalsReceived + 1;
    const stageComplete = approvalsReceived >= activeStage.requiredApprovals;

    await this.prisma.workflowStageInstance.update({
      where: { id: activeStage.id },
      data: {
        approvalsReceived,
        status: stageComplete ? WorkflowStageInstanceStatus.APPROVED : WorkflowStageInstanceStatus.ACTIVE,
        completedAt: stageComplete ? new Date() : undefined,
      },
    });

    if (!stageComplete) return this.getInstance(instanceId);

    const nextStage = instance.stageInstances.find((s) => s.sequence > activeStage.sequence);
    if (nextStage) {
      await this.prisma.workflowStageInstance.update({
        where: { id: nextStage.id },
        data: { status: WorkflowStageInstanceStatus.ACTIVE, activatedAt: new Date() },
      });
      if (nextStage.requiredRoleCode) {
        await this.notifyRoleHolders(nextStage.requiredRoleCode, 'Approval needed', `Instance ${instanceId} awaiting your review`, {
          workflowInstanceId: instanceId,
          stageInstanceId: nextStage.id,
        });
      }
      return this.getInstance(instanceId);
    }

    // No more stages — the workflow completes. A final stage of type
    // POSTED/ARCHIVED sets that as the instance's terminal status;
    // anything else lands on APPROVED.
    const finalStatus =
      activeStage.stageDefinitionId && (await this.finalStageType(activeStage.stageDefinitionId)) === WorkflowStageType.POSTED
        ? WorkflowInstanceStatus.POSTED
        : WorkflowInstanceStatus.APPROVED;

    const completed = await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: finalStatus, completedAt: new Date() },
    });
    await this.notifyRequester(instance.startedById, 'Request approved', `Instance ${instanceId} is now ${finalStatus}`, {
      workflowInstanceId: instanceId,
    });
    return completed;
  }

  /** Allows a RETURNED instance to be resubmitted from the first stage. */
  async resubmit(instanceId: string, userId: string) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { stageInstances: { orderBy: { sequence: 'asc' } } },
    });
    if (!instance) throw new NotFoundException(`Workflow instance ${instanceId} not found`);
    if (instance.status !== WorkflowInstanceStatus.RETURNED) {
      throw new ConflictException('Only a RETURNED instance can be resubmitted');
    }

    const firstStage = instance.stageInstances[0];
    await this.prisma.workflowStageInstance.update({
      where: { id: firstStage.id },
      data: { status: WorkflowStageInstanceStatus.ACTIVE, approvalsReceived: 0, activatedAt: new Date(), completedAt: null },
    });

    await this.prisma.workflowAction.create({
      data: {
        workflowInstanceId: instanceId,
        stageInstanceId: firstStage.id,
        actorId: userId,
        action: WorkflowActionType.SUBMIT,
        comments: 'Resubmitted after return',
      },
    });

    return this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: WorkflowInstanceStatus.IN_PROGRESS, completedAt: null },
    });
  }

  // -------------------------------------------------------------------
  // INTERNAL: rule evaluation
  // -------------------------------------------------------------------

  private evaluateRule(
    field: WorkflowRuleField,
    operator: WorkflowRuleOperator,
    rawValue: string,
    context: RuleContext,
  ): boolean {
    const actual = this.resolveContextValue(field, context);
    if (actual === undefined) return false;

    let expected: unknown;
    try {
      expected = JSON.parse(rawValue);
    } catch {
      expected = rawValue;
    }

    switch (operator) {
      case WorkflowRuleOperator.GT:
        return Number(actual) > Number(expected);
      case WorkflowRuleOperator.GTE:
        return Number(actual) >= Number(expected);
      case WorkflowRuleOperator.LT:
        return Number(actual) < Number(expected);
      case WorkflowRuleOperator.LTE:
        return Number(actual) <= Number(expected);
      case WorkflowRuleOperator.EQ:
        return actual === expected;
      case WorkflowRuleOperator.NEQ:
        return actual !== expected;
      case WorkflowRuleOperator.IN:
        return Array.isArray(expected) && expected.includes(actual);
      default:
        return false;
    }
  }

  private resolveContextValue(field: WorkflowRuleField, context: RuleContext): unknown {
    switch (field) {
      case WorkflowRuleField.AMOUNT:
        return context.amount;
      case WorkflowRuleField.DEPARTMENT:
        return context.departmentId;
      case WorkflowRuleField.PROJECT:
        return context.projectId;
      case WorkflowRuleField.ENTITY:
        return context.entityId;
      case WorkflowRuleField.ROLE:
        return context.role;
      case WorkflowRuleField.RISK_LEVEL:
        return context.riskLevel;
      case WorkflowRuleField.BUDGET_AVAILABILITY:
        return context.budgetAvailable;
      default:
        return undefined;
    }
  }

  private async finalStageType(stageDefinitionId: string): Promise<WorkflowStageType | null> {
    const stage = await this.prisma.workflowStageDefinition.findUnique({ where: { id: stageDefinitionId } });
    return stage?.stageType ?? null;
  }

  // =====================================================================
  // NOTIFICATIONS (Release G — Assignment & Workflow Notifications)
  // =====================================================================
  // Best-effort, same pattern HandoverService.addSnag() established as the
  // first caller of NotificationsService.create(): a notification failure
  // must never block a workflow action, so it's caught and logged rather
  // than left to fail the request. Role fan-out reuses the exact same
  // UserRole -> role.code lookup act() already does for the authorization
  // check above, rather than introducing a second way to resolve "who has
  // this role."

  private async notifyRoleHolders(roleCode: string, title: string, body: string, metadata: Record<string, unknown>) {
    try {
      const holders = await this.prisma.userRole.findMany({
        where: { role: { code: roleCode } },
        select: { userId: true },
      });
      await Promise.all(holders.map((h) => this.notifications.create({ userId: h.userId, title, body, metadata })));
    } catch {
      // Non-fatal — see doc comment above.
    }
  }

  private async notifyRequester(userId: string, title: string, body: string, metadata: Record<string, unknown>) {
    try {
      await this.notifications.create({ userId, title, body, metadata });
    } catch {
      // Non-fatal — see doc comment above.
    }
  }
}
