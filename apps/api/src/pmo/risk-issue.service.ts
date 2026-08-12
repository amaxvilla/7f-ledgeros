import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IssueStatus, RiskImpact, RiskProbability, RiskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AssessRiskDto,
  AssignIssueDto,
  AssignRiskOwnerDto,
  ConvertRiskToIssueDto,
  CreateIssueDto,
  CreateRiskDto,
  ResolveIssueDto,
  SetMitigationPlanDto,
} from './dto/risk-issue.dto';

const SCALE: Record<RiskProbability | RiskImpact, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

@Injectable()
export class RiskIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly notifications: NotificationsService,
  ) {}

  // =====================================================================
  // RISK REGISTER
  // =====================================================================

  async createRisk(dto: CreateRiskDto, identifiedById: string) {
    const probability = dto.probability ?? RiskProbability.MEDIUM;
    const impact = dto.impact ?? RiskImpact.MEDIUM;

    const risk = await this.prisma.projectRisk.create({
      data: {
        projectId: dto.projectId,
        entityId: dto.entityId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        probability,
        impact,
        riskScore: SCALE[probability] * SCALE[impact],
        ownerId: dto.ownerId,
        identifiedById,
      },
    });

    await this.notifyBestEffort(risk.ownerId, 'Risk assigned to you', risk.title, { riskId: risk.id });
    return risk;
  }

  findRisks(scope: SecurityScope, filters: { projectId?: string; status?: RiskStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.projectRisk.findMany({
      where: { AND: [rls, filters] },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getRisk(id: string) {
    const risk = await this.prisma.projectRisk.findUnique({ where: { id }, include: { issues: true } });
    if (!risk) throw new NotFoundException(`Risk ${id} not found`);
    return risk;
  }

  private async requireRisk(id: string) {
    const risk = await this.prisma.projectRisk.findUnique({ where: { id } });
    if (!risk) throw new NotFoundException(`Risk ${id} not found`);
    return risk;
  }

  private assertRiskOpen(risk: { status: RiskStatus }) {
    if (risk.status === RiskStatus.CLOSED) throw new ConflictException('This risk is already CLOSED');
  }

  async assessRisk(id: string, dto: AssessRiskDto) {
    const risk = await this.requireRisk(id);
    this.assertRiskOpen(risk);
    return this.prisma.projectRisk.update({
      where: { id },
      data: {
        probability: dto.probability,
        impact: dto.impact,
        riskScore: SCALE[dto.probability] * SCALE[dto.impact],
        status: risk.status === RiskStatus.IDENTIFIED ? RiskStatus.ASSESSED : risk.status,
      },
    });
  }

  async assignRiskOwner(id: string, dto: AssignRiskOwnerDto) {
    const risk = await this.requireRisk(id);
    this.assertRiskOpen(risk);
    const updated = await this.prisma.projectRisk.update({ where: { id }, data: { ownerId: dto.ownerId } });
    if (dto.ownerId !== risk.ownerId) {
      await this.notifyBestEffort(dto.ownerId, 'Risk assigned to you', risk.title, { riskId: id });
    }
    return updated;
  }

  async setMitigationPlan(id: string, dto: SetMitigationPlanDto) {
    const risk = await this.requireRisk(id);
    this.assertRiskOpen(risk);
    return this.prisma.projectRisk.update({
      where: { id },
      data: { mitigationPlan: dto.mitigationPlan, status: RiskStatus.MITIGATING },
    });
  }

  async monitorRisk(id: string) {
    const risk = await this.requireRisk(id);
    this.assertRiskOpen(risk);
    return this.prisma.projectRisk.update({ where: { id }, data: { status: RiskStatus.MONITORING } });
  }

  async closeRisk(id: string) {
    const risk = await this.requireRisk(id);
    this.assertRiskOpen(risk);
    return this.prisma.projectRisk.update({ where: { id }, data: { status: RiskStatus.CLOSED, closedAt: new Date() } });
  }

  /**
   * Marks the risk OCCURRED and creates a linked ProjectIssue in one step
   * — reuses createIssue() below rather than duplicating issue-creation
   * logic, so the resulting issue goes through exactly the same path
   * (including its own assignment notification) as any other issue.
   */
  async convertRiskToIssue(riskId: string, dto: ConvertRiskToIssueDto, raisedById: string) {
    const risk = await this.requireRisk(riskId);
    this.assertRiskOpen(risk);

    const [, issue] = await this.prisma.$transaction([
      this.prisma.projectRisk.update({ where: { id: riskId }, data: { status: RiskStatus.OCCURRED } }),
      this.prisma.projectIssue.create({
        data: {
          projectId: risk.projectId,
          entityId: risk.entityId,
          riskId,
          title: dto.title ?? `[Risk occurred] ${risk.title}`,
          description: dto.description ?? risk.description,
          priority: dto.priority,
          assignedToId: dto.assignedToId ?? risk.ownerId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          raisedById,
        },
      }),
    ]);

    await this.notifyBestEffort(issue.assignedToId, 'New issue assigned', issue.title, { issueId: issue.id, riskId });
    return issue;
  }

  // =====================================================================
  // ISSUE REGISTER
  // =====================================================================

  async createIssue(dto: CreateIssueDto, raisedById: string) {
    const issue = await this.prisma.projectIssue.create({
      data: {
        projectId: dto.projectId,
        entityId: dto.entityId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assignedToId: dto.assignedToId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        raisedById,
      },
    });

    await this.notifyBestEffort(issue.assignedToId, 'New issue assigned', issue.title, { issueId: issue.id });
    return issue;
  }

  findIssues(scope: SecurityScope, filters: { projectId?: string; status?: IssueStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.projectIssue.findMany({
      where: { AND: [rls, filters] },
      orderBy: [{ priority: 'desc' }, { raisedAt: 'desc' }],
    });
  }

  async getIssue(id: string) {
    const issue = await this.prisma.projectIssue.findUnique({ where: { id }, include: { risk: true } });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }

  private async requireIssue(id: string) {
    const issue = await this.prisma.projectIssue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }

  private assertIssueOpen(issue: { status: IssueStatus }) {
    if (issue.status === IssueStatus.CLOSED) throw new ConflictException('This issue is already CLOSED');
  }

  async assignIssue(id: string, dto: AssignIssueDto) {
    const issue = await this.requireIssue(id);
    this.assertIssueOpen(issue);
    const updated = await this.prisma.projectIssue.update({ where: { id }, data: { assignedToId: dto.assignedToId } });
    if (dto.assignedToId !== issue.assignedToId) {
      await this.notifyBestEffort(dto.assignedToId, 'Issue assigned to you', issue.title, { issueId: id });
    }
    return updated;
  }

  async startIssueWork(id: string) {
    const issue = await this.requireIssue(id);
    this.assertIssueOpen(issue);
    return this.prisma.projectIssue.update({ where: { id }, data: { status: IssueStatus.IN_PROGRESS } });
  }

  async escalateIssue(id: string) {
    const issue = await this.requireIssue(id);
    this.assertIssueOpen(issue);
    return this.prisma.projectIssue.update({ where: { id }, data: { status: IssueStatus.ESCALATED } });
  }

  async resolveIssue(id: string, dto: ResolveIssueDto) {
    const issue = await this.requireIssue(id);
    this.assertIssueOpen(issue);
    return this.prisma.projectIssue.update({
      where: { id },
      data: { status: IssueStatus.RESOLVED, resolvedAt: new Date(), resolutionNotes: dto.resolutionNotes },
    });
  }

  async closeIssue(id: string) {
    const issue = await this.requireIssue(id);
    if (issue.status !== IssueStatus.RESOLVED) {
      throw new BadRequestException(`Only a RESOLVED issue can be closed (currently ${issue.status})`);
    }
    return this.prisma.projectIssue.update({ where: { id }, data: { status: IssueStatus.CLOSED } });
  }

  // =====================================================================
  // SUMMARY (for the Executive PMO Dashboard widget)
  // =====================================================================

  /**
   * `entityId` is optional and additive (Release K — PMO Reporting
   * Integration) — same "AND entity_id =" safe-filter pattern as
   * SchedulingService.getGanttData/computeEarnedValue's own entityId
   * param; existing callers (RiskController/IssueController,
   * DashboardService.getPmoRiskIssueOverview) that only pass `projectId`
   * are unaffected.
   */
  async getRiskIssueSummary(projectId?: string, entityId?: string) {
    const riskWhere = { ...(projectId ? { projectId } : {}), ...(entityId ? { entityId } : {}) };
    const issueWhere = { ...(projectId ? { projectId } : {}), ...(entityId ? { entityId } : {}) };

    const [risksByStatus, topRisks, issuesByStatus, issuesByPriority] = await Promise.all([
      this.prisma.projectRisk.groupBy({ by: ['status'], where: riskWhere, _count: true }),
      this.prisma.projectRisk.findMany({
        where: { ...riskWhere, status: { notIn: [RiskStatus.CLOSED] } },
        orderBy: { riskScore: 'desc' },
        take: 5,
      }),
      this.prisma.projectIssue.groupBy({ by: ['status'], where: issueWhere, _count: true }),
      this.prisma.projectIssue.groupBy({ by: ['priority'], where: { ...issueWhere, status: { notIn: [IssueStatus.CLOSED] } }, _count: true }),
    ]);

    return {
      risksByStatus: risksByStatus.map((r) => ({ status: r.status, count: r._count })),
      topOpenRisks: topRisks.map((r) => ({ id: r.id, title: r.title, riskScore: r.riskScore, status: r.status })),
      issuesByStatus: issuesByStatus.map((r) => ({ status: r.status, count: r._count })),
      openIssuesByPriority: issuesByPriority.map((r) => ({ priority: r.priority, count: r._count })),
    };
  }

  // =====================================================================
  // NOTIFICATIONS — same best-effort pattern as Release G
  // =====================================================================

  private async notifyBestEffort(userId: string | null | undefined, title: string, body: string, metadata: Record<string, unknown>) {
    if (!userId) return;
    try {
      await this.notifications.create({ userId, title, body, metadata });
    } catch {
      // Non-fatal — see Release G (HandoverService.addSnag) for the original rationale.
    }
  }
}
