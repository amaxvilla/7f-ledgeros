import { Injectable, NotFoundException } from '@nestjs/common';
import { CommissionCalculationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { ACTIVE_STATUSES, UNIT_PROJECT_INCLUDE } from './commission-calculation.service';

/** Every status counted in "outstanding" — approved and awaiting the accrual posting, or accrued and awaiting payment. Deliberately excludes PENDING (not yet approved, so not yet a committed liability) and CALCULATED (not even submitted). */
const OUTSTANDING_STATUSES: CommissionCalculationStatus[] = [CommissionCalculationStatus.APPROVED, CommissionCalculationStatus.PAYABLE];

/** Aging buckets, boundaries kept identical to AccountsPayableService.getVendorAging's own (0/30/60/90) so a reader who already knows that report's bucket meanings needs no new mental model here. */
function agingBucket(days: number): 'current' | '1-30' | '31-60' | '61-90' | '90+' {
  if (days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * Agent & Commission Management, RE-COMM.5 — Agent Statements &
 * Reporting. A separate, read-only service from CommissionCalculationService
 * (which owns writes/lifecycle) — every method here is a pure aggregation
 * over CommissionCalculation, matching this codebase's existing
 * "DashboardService/ReportingService reuse the owning domain service's own
 * aggregation rather than re-query" split (see DashboardService.
 * getOutstandingPayablesReceivables reusing AccountsPayableService.
 * getVendorAging for the same pattern this module follows).
 *
 * "Commission earned" throughout this service means the sum of every
 * calculation in `ACTIVE_STATUSES` (CALCULATED through PAID — i.e. every
 * calculation that hasn't been REJECTED/REVERSED/CANCELLED) — the same
 * definition CommissionCalculationService.reverse's own guard already
 * uses for "still active", reused here rather than re-decided.
 */
@Injectable()
export class CommissionReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  private scopedWhere(scope: SecurityScope, entityId?: string): Prisma.CommissionCalculationWhereInput {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return entityId ? { AND: [rls, { entityId }] } : (rls as Prisma.CommissionCalculationWhereInput);
  }

  /**
   * Commission earned / approved / payable / paid / outstanding — the
   * first five report items RE-COMM.5 names, all derivable from one
   * `groupBy(status)` aggregate rather than five separate queries.
   */
  async getSummary(scope: SecurityScope, entityId?: string) {
    const where = this.scopedWhere(scope, entityId);
    const rows = await this.prisma.commissionCalculation.groupBy({
      by: ['status'],
      where,
      _sum: { netCommission: true, grossCommission: true },
      _count: true,
    });

    const byStatus: Record<string, { amount: number; grossAmount: number; count: number }> = {};
    for (const row of rows) {
      byStatus[row.status] = {
        amount: Number(row._sum.netCommission ?? 0),
        grossAmount: Number(row._sum.grossCommission ?? 0),
        count: row._count,
      };
    }
    const amountOf = (status: CommissionCalculationStatus) => byStatus[status]?.amount ?? 0;
    const earned = ACTIVE_STATUSES.reduce((sum, status) => sum + amountOf(status), 0);
    const approved = amountOf(CommissionCalculationStatus.APPROVED);
    const payable = amountOf(CommissionCalculationStatus.PAYABLE);
    const paid = amountOf(CommissionCalculationStatus.PAID);

    return {
      entityId: entityId ?? null,
      earned,
      approved,
      payable,
      paid,
      outstanding: approved + payable,
      byStatus,
    };
  }

  /** Commission by agent — earned/paid/outstanding per agent, sorted highest-earning first. */
  async getByAgent(scope: SecurityScope, entityId?: string) {
    const where: Prisma.CommissionCalculationWhereInput = {
      AND: [this.scopedWhere(scope, entityId), { status: { in: ACTIVE_STATUSES } }],
    };
    const rows = await this.prisma.commissionCalculation.findMany({
      where,
      select: { agentId: true, status: true, netCommission: true, agent: { select: { code: true, displayName: true } } },
    });

    const byAgent = new Map<
      string,
      { agentId: string; agentCode: string; agentName: string; earned: number; paid: number; outstanding: number; count: number }
    >();
    for (const row of rows) {
      let entry = byAgent.get(row.agentId);
      if (!entry) {
        entry = { agentId: row.agentId, agentCode: row.agent.code, agentName: row.agent.displayName, earned: 0, paid: 0, outstanding: 0, count: 0 };
        byAgent.set(row.agentId, entry);
      }
      const amount = Number(row.netCommission);
      entry.earned += amount;
      entry.count += 1;
      if (row.status === CommissionCalculationStatus.PAID) entry.paid += amount;
      if (OUTSTANDING_STATUSES.includes(row.status)) entry.outstanding += amount;
    }
    return Array.from(byAgent.values()).sort((a, b) => b.earned - a.earned);
  }

  /**
   * Commission by project (and, nested per project, by unit) — the
   * deep allocation -> unit -> floor -> block -> phase -> project chain
   * `UNIT_PROJECT_INCLUDE` already resolves for CommissionCalculationService
   * itself, reused verbatim here rather than re-derived a third time (see
   * that const's own updated doc comment) or restated as a raw SQL view
   * (this codebase's other alternative for a deep join, used only where
   * the result set is genuinely large — CommissionCalculation is not).
   */
  async getByProject(scope: SecurityScope, entityId?: string) {
    const where: Prisma.CommissionCalculationWhereInput = {
      AND: [this.scopedWhere(scope, entityId), { status: { in: ACTIVE_STATUSES } }],
    };
    const rows = await this.prisma.commissionCalculation.findMany({
      where,
      select: {
        status: true,
        netCommission: true,
        allocation: {
          select: {
            unitId: true,
            unit: {
              select: {
                code: true,
                ...UNIT_PROJECT_INCLUDE,
              },
            },
          },
        },
      },
    });

    interface ProjectBucket {
      projectId: string;
      projectCode: string;
      earned: number;
      paid: number;
      outstanding: number;
      count: number;
      units: Map<string, { unitId: string; unitCode: string; earned: number; paid: number; outstanding: number; count: number }>;
    }
    const byProject = new Map<string, ProjectBucket>();

    for (const row of rows) {
      const project = row.allocation.unit.floor.block.phase.project;
      let bucket = byProject.get(project.id);
      if (!bucket) {
        bucket = { projectId: project.id, projectCode: project.code, earned: 0, paid: 0, outstanding: 0, count: 0, units: new Map() };
        byProject.set(project.id, bucket);
      }
      let unitBucket = bucket.units.get(row.allocation.unitId);
      if (!unitBucket) {
        unitBucket = { unitId: row.allocation.unitId, unitCode: row.allocation.unit.code, earned: 0, paid: 0, outstanding: 0, count: 0 };
        bucket.units.set(row.allocation.unitId, unitBucket);
      }

      const amount = Number(row.netCommission);
      const isPaid = row.status === CommissionCalculationStatus.PAID;
      const isOutstanding = OUTSTANDING_STATUSES.includes(row.status);

      bucket.earned += amount;
      bucket.count += 1;
      unitBucket.earned += amount;
      unitBucket.count += 1;
      if (isPaid) {
        bucket.paid += amount;
        unitBucket.paid += amount;
      }
      if (isOutstanding) {
        bucket.outstanding += amount;
        unitBucket.outstanding += amount;
      }
    }

    return Array.from(byProject.values())
      .map((bucket) => ({ ...bucket, units: Array.from(bucket.units.values()).sort((a, b) => b.earned - a.earned) }))
      .sort((a, b) => b.earned - a.earned);
  }

  /**
   * Commission aging — how long each PAYABLE (accrued, not yet paid)
   * calculation has been outstanding, bucketed from `markedPayableAt`
   * (the date the liability was actually posted, not `calculatedAt`) —
   * same "age from when the obligation became real" convention
   * AccountsPayableService.getVendorAging uses (its own `dueDate`, not
   * the invoice date). PENDING/APPROVED calculations are deliberately
   * excluded — they aren't yet a posted liability to age.
   */
  async getAging(scope: SecurityScope, entityId?: string) {
    const where: Prisma.CommissionCalculationWhereInput = {
      AND: [this.scopedWhere(scope, entityId), { status: CommissionCalculationStatus.PAYABLE }],
    };
    const rows = await this.prisma.commissionCalculation.findMany({
      where,
      select: {
        id: true,
        agentId: true,
        netCommission: true,
        markedPayableAt: true,
        agent: { select: { code: true, displayName: true } },
      },
      orderBy: { markedPayableAt: 'asc' },
    });

    const now = Date.now();
    const buckets = rows.map((row) => {
      const daysOutstanding = row.markedPayableAt ? Math.floor((now - row.markedPayableAt.getTime()) / 86_400_000) : 0;
      return {
        commissionCalculationId: row.id,
        agentId: row.agentId,
        agentCode: row.agent.code,
        agentName: row.agent.displayName,
        netCommission: Number(row.netCommission),
        markedPayableAt: row.markedPayableAt,
        daysOutstanding,
        bucket: agingBucket(daysOutstanding),
      };
    });

    const totals = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } as Record<ReturnType<typeof agingBucket>, number>;
    for (const row of buckets) totals[row.bucket] += row.netCommission;

    return { rows: buckets, totals };
  }

  /**
   * Commission forecast — the pipeline of commission NOT yet paid,
   * grouped by lifecycle stage rather than a calendar horizon.
   * Deliberately NOT modeled on DashboardService.getCashForecast's own
   * 30/60/90-day buckets: unlike an AP/AR invoice, CommissionCalculation
   * has no due date at any stage of its lifecycle (confirmed directly
   * against the schema — `submittedAt`/`approvedAt`/`markedPayableAt`
   * are all "when this happened", none is "when this is due"), so a
   * calendar-day bucket would need an invented assumption this schema
   * gives no basis for. What the lifecycle genuinely tells you is how
   * FAR each amount is from being paid — PENDING is furthest (not even
   * approved yet), PAYABLE is nearest (approved and accrued, awaiting
   * only the payment run) — which is what this groups by instead.
   */
  async getForecast(scope: SecurityScope, entityId?: string) {
    const where: Prisma.CommissionCalculationWhereInput = {
      AND: [
        this.scopedWhere(scope, entityId),
        { status: { in: [CommissionCalculationStatus.CALCULATED, CommissionCalculationStatus.PENDING, CommissionCalculationStatus.APPROVED, CommissionCalculationStatus.PAYABLE] } },
      ],
    };
    const rows = await this.prisma.commissionCalculation.groupBy({
      by: ['status'],
      where,
      _sum: { netCommission: true },
      _count: true,
    });

    const stageOf = (status: CommissionCalculationStatus) => rows.find((r) => r.status === status);
    const stage = (status: CommissionCalculationStatus, label: string) => {
      const found = stageOf(status);
      return { status, label, amount: Number(found?._sum.netCommission ?? 0), count: found?._count ?? 0 };
    };

    const pipeline = [
      stage(CommissionCalculationStatus.PAYABLE, 'Accrued, awaiting payment'),
      stage(CommissionCalculationStatus.APPROVED, 'Approved, awaiting accrual posting'),
      stage(CommissionCalculationStatus.PENDING, 'Submitted, awaiting approval'),
      stage(CommissionCalculationStatus.CALCULATED, 'Calculated, not yet submitted'),
    ];

    return { entityId: entityId ?? null, pipeline, totalUnpaid: pipeline.reduce((sum, p) => sum + p.amount, 0) };
  }

  /**
   * A single agent's statement: the agent's own summary totals (via
   * `getByAgent`'s own per-agent shape, computed directly rather than
   * filtered out of the entity-wide list so a caller with only
   * `commission.view` scoped to this agent doesn't need entity-wide
   * access) plus every calculation, newest first — the RE-COMM.5-named
   * "Agent statement" report itself.
   */
  async getAgentStatement(scope: SecurityScope, agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, code: true, displayName: true, entityId: true } });
    if (!agent || !this.rowLevelSecurity.canAccess(scope, agent, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    const calculations = await this.prisma.commissionCalculation.findMany({
      where: { AND: [rls, { agentId }] },
      orderBy: { calculatedAt: 'desc' },
    });

    const active = calculations.filter((c) => ACTIVE_STATUSES.includes(c.status));
    const sumOf = (statuses: CommissionCalculationStatus[]) =>
      active.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + Number(c.netCommission), 0);

    const summary = {
      earned: sumOf(ACTIVE_STATUSES),
      approved: sumOf([CommissionCalculationStatus.APPROVED]),
      payable: sumOf([CommissionCalculationStatus.PAYABLE]),
      paid: sumOf([CommissionCalculationStatus.PAID]),
      outstanding: sumOf(OUTSTANDING_STATUSES),
    };

    return { agent, summary, calculations };
  }
}
