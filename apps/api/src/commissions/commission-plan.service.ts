import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionPlanScope, CommissionPlanStatus, CommissionPlanType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  CreateCommissionPlanDto,
  DeactivateCommissionPlanDto,
  UpdateCommissionPlanDto,
} from './dto/commission-plan.dto';

const SCOPE_TARGET_FIELDS = ['projectId', 'estateId', 'unitId', 'agentId'] as const;

/**
 * Agent & Commission Management, RE-COMM.1 — Commission Plans.
 *
 * Configurable commission-structure master. Deliberately does NOT
 * compute a commission for any real sale — that is RE-COMM.2
 * (Commission Calculation), which will read plans this service manages
 * but live in its own module. This service's job is: define a rate/
 * amount/tier schedule, validate it's internally consistent, and let
 * it be looked up later. No PostingEngineService involvement here —
 * see RE-COMM.4's own scope for why plan definition never itself
 * posts anything.
 *
 * See the schema's own top-of-section comment for the scope-target and
 * plan-resolution-precedence rules this service enforces.
 */
@Injectable()
export class CommissionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  private async requirePlan(id: string) {
    const plan = await this.prisma.commissionPlan.findUnique({
      where: { id },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException(`Commission plan ${id} not found`);
    return plan;
  }

  /**
   * Exactly one of projectId/estateId/unitId/agentId must be set, and
   * it must match `scope` (GLOBAL means none are set). Thrown as a 400
   * — this is caller input, not a conflict with existing state.
   */
  private validateScopeTarget(scope: CommissionPlanScope, dto: {
    projectId?: string;
    estateId?: string;
    unitId?: string;
    agentId?: string;
  }) {
    const populated = SCOPE_TARGET_FIELDS.filter((f) => dto[f] != null);

    if (scope === CommissionPlanScope.GLOBAL) {
      if (populated.length > 0) {
        throw new BadRequestException(
          `scope GLOBAL must not set any of projectId/estateId/unitId/agentId (found: ${populated.join(', ')})`,
        );
      }
      return;
    }

    const expectedField = `${scope.toLowerCase()}Id`;
    if (populated.length !== 1 || populated[0] !== expectedField) {
      throw new BadRequestException(
        `scope ${scope} requires exactly ${expectedField} to be set (and no other scope-target field)`,
      );
    }
  }

  /**
   * When isTiered is false: exactly one of rate/fixedAmount must be set,
   * matching `type`, and `tiers` must be empty. When isTiered is true:
   * rate/fixedAmount at the plan level must both be absent, and `tiers`
   * must form a gapless, non-overlapping, ascending schedule where each
   * tier supplies exactly the field matching `type`.
   */
  private validateRateShape(
    type: CommissionPlanType,
    isTiered: boolean,
    rate: number | undefined,
    fixedAmount: number | undefined,
    tiers: { tierOrder: number; minAmount: number; maxAmount?: number; rate?: number; fixedAmount?: number }[] | undefined,
  ) {
    const rateField = type === CommissionPlanType.PERCENTAGE ? 'rate' : 'fixedAmount';
    const otherField = type === CommissionPlanType.PERCENTAGE ? 'fixedAmount' : 'rate';

    if (!isTiered) {
      if (tiers && tiers.length > 0) {
        throw new BadRequestException('tiers must not be supplied when isTiered is false');
      }
      const value = type === CommissionPlanType.PERCENTAGE ? rate : fixedAmount;
      const other = type === CommissionPlanType.PERCENTAGE ? fixedAmount : rate;
      if (value == null) {
        throw new BadRequestException(`${rateField} is required for a non-tiered ${type} plan`);
      }
      if (other != null) {
        throw new BadRequestException(`${otherField} must not be set for a ${type} plan`);
      }
      return;
    }

    if (rate != null || fixedAmount != null) {
      throw new BadRequestException('rate/fixedAmount must not be set at the plan level when isTiered is true — use tiers instead');
    }
    if (!tiers || tiers.length === 0) {
      throw new BadRequestException('tiers is required when isTiered is true');
    }

    const sorted = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder);
    sorted.forEach((tier, idx) => {
      if (tier.tierOrder !== idx + 1) {
        throw new BadRequestException('tiers must be ordered contiguously starting at 1 (tierOrder)');
      }
      const value = type === CommissionPlanType.PERCENTAGE ? tier.rate : tier.fixedAmount;
      const other = type === CommissionPlanType.PERCENTAGE ? tier.fixedAmount : tier.rate;
      if (value == null) {
        throw new BadRequestException(`tier ${tier.tierOrder}: ${rateField} is required for a ${type} plan`);
      }
      if (other != null) {
        throw new BadRequestException(`tier ${tier.tierOrder}: ${otherField} must not be set for a ${type} plan`);
      }
      if (tier.maxAmount != null && tier.maxAmount <= tier.minAmount) {
        throw new BadRequestException(`tier ${tier.tierOrder}: maxAmount must be greater than minAmount`);
      }
      const isLast = idx === sorted.length - 1;
      if (!isLast && tier.maxAmount == null) {
        throw new BadRequestException(`tier ${tier.tierOrder}: only the final tier may leave maxAmount open-ended`);
      }
      if (idx > 0) {
        const prev = sorted[idx - 1];
        if (prev.maxAmount == null || Number(prev.maxAmount) !== Number(tier.minAmount)) {
          throw new BadRequestException(
            `tier ${tier.tierOrder}: minAmount (${tier.minAmount}) must equal tier ${prev.tierOrder}'s maxAmount to stay gapless`,
          );
        }
      } else if (Number(tier.minAmount) !== 0) {
        throw new BadRequestException('tier 1: minAmount must be 0 — the schedule must start at the beginning of the commission basis');
      }
    });
  }

  async create(dto: CreateCommissionPlanDto, createdById: string) {
    const existing = await this.prisma.commissionPlan.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Commission plan code "${dto.code}" is already in use`);
    }

    this.validateScopeTarget(dto.scope, dto);
    this.validateRateShape(dto.type, dto.isTiered ?? false, dto.rate, dto.fixedAmount, dto.tiers);

    return this.prisma.commissionPlan.create({
      data: {
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        scope: dto.scope,
        projectId: dto.projectId,
        estateId: dto.estateId,
        unitId: dto.unitId,
        agentId: dto.agentId,
        rate: dto.rate,
        fixedAmount: dto.fixedAmount,
        isReferral: dto.isReferral ?? false,
        isTiered: dto.isTiered ?? false,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        notes: dto.notes,
        createdById,
        tiers: dto.isTiered && dto.tiers
          ? {
              create: dto.tiers.map((t) => ({
                tierOrder: t.tierOrder,
                minAmount: t.minAmount,
                maxAmount: t.maxAmount,
                rate: t.rate,
                fixedAmount: t.fixedAmount,
              })),
            }
          : undefined,
      },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
    });
  }

  findPlans(
    scope: SecurityScope,
    filters: {
      entityId?: string;
      scope?: CommissionPlanScope;
      status?: CommissionPlanStatus;
      agentId?: string;
      projectId?: string;
      estateId?: string;
      unitId?: string;
      isReferral?: boolean;
    },
  ) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });

    return this.prisma.commissionPlan.findMany({
      where: { AND: [rls, filters] },
      include: { tiers: { orderBy: { tierOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlan(scope: SecurityScope, id: string) {
    const plan = await this.requirePlan(id);
    if (!this.rowLevelSecurity.canAccess(scope, plan, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Commission plan ${id} not found`);
    }
    return plan;
  }

  /**
   * Resolve the single best-matching ACTIVE plan for a given target,
   * following the precedence documented on the schema: UNIT > PROJECT >
   * ESTATE > AGENT > GLOBAL. Returns null if nothing matches. This is
   * the one piece of "how a real calculation would pick a plan" logic
   * this checkpoint includes — a read-only lookup, no side effects —
   * since RE-COMM.2 (Commission Calculation) will need exactly this and
   * shouldn't have to reimplement it.
   */
  async resolvePlan(
    scope: SecurityScope,
    target: { entityId: string; projectId?: string; estateId?: string; unitId?: string; agentId?: string; isReferral?: boolean },
  ) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    const isReferral = target.isReferral ?? false;
    const now = new Date();

    const candidateWheres: { scope: CommissionPlanScope; extra: Record<string, unknown> }[] = [];
    if (target.unitId) candidateWheres.push({ scope: CommissionPlanScope.UNIT, extra: { unitId: target.unitId } });
    if (target.projectId) candidateWheres.push({ scope: CommissionPlanScope.PROJECT, extra: { projectId: target.projectId } });
    if (target.estateId) candidateWheres.push({ scope: CommissionPlanScope.ESTATE, extra: { estateId: target.estateId } });
    if (target.agentId) candidateWheres.push({ scope: CommissionPlanScope.AGENT, extra: { agentId: target.agentId } });
    candidateWheres.push({ scope: CommissionPlanScope.GLOBAL, extra: {} });

    for (const candidate of candidateWheres) {
      const plan = await this.prisma.commissionPlan.findFirst({
        where: {
          AND: [
            rls,
            {
              entityId: target.entityId,
              scope: candidate.scope,
              status: CommissionPlanStatus.ACTIVE,
              isReferral,
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
              ...candidate.extra,
            },
          ],
        },
        include: { tiers: { orderBy: { tierOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      if (plan) return plan;
    }
    return null;
  }

  async update(scope: SecurityScope, id: string, dto: UpdateCommissionPlanDto) {
    const plan = await this.getPlan(scope, id);

    const isTiered = dto.isTiered ?? plan.isTiered;
    const rate = dto.rate ?? (isTiered ? undefined : plan.rate != null ? Number(plan.rate) : undefined);
    const fixedAmount = dto.fixedAmount ?? (isTiered ? undefined : plan.fixedAmount != null ? Number(plan.fixedAmount) : undefined);
    const tiers = dto.tiers ?? (isTiered && !dto.tiers ? plan.tiers.map((t) => ({
      tierOrder: t.tierOrder,
      minAmount: Number(t.minAmount),
      maxAmount: t.maxAmount != null ? Number(t.maxAmount) : undefined,
      rate: t.rate != null ? Number(t.rate) : undefined,
      fixedAmount: t.fixedAmount != null ? Number(t.fixedAmount) : undefined,
    })) : dto.tiers);

    this.validateRateShape(plan.type, isTiered, rate, fixedAmount, tiers);

    return this.prisma.$transaction(async (tx) => {
      if (dto.tiers) {
        await tx.commissionPlanTier.deleteMany({ where: { commissionPlanId: plan.id } });
      }

      return tx.commissionPlan.update({
        where: { id: plan.id },
        data: {
          name: dto.name,
          rate: isTiered ? null : rate,
          fixedAmount: isTiered ? null : fixedAmount,
          isReferral: dto.isReferral,
          isTiered: dto.isTiered,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          notes: dto.notes,
          tiers: dto.tiers
            ? {
                create: dto.tiers.map((t) => ({
                  tierOrder: t.tierOrder,
                  minAmount: t.minAmount,
                  maxAmount: t.maxAmount,
                  rate: t.rate,
                  fixedAmount: t.fixedAmount,
                })),
              }
            : undefined,
        },
        include: { tiers: { orderBy: { tierOrder: 'asc' } } },
      });
    });
  }

  /** ACTIVE -> INACTIVE only. Soft-disable — see CommissionPlanStatus's own schema doc comment for why there is no reactivation path. */
  async deactivate(scope: SecurityScope, id: string, dto: DeactivateCommissionPlanDto, deactivatedById: string) {
    const plan = await this.getPlan(scope, id);
    if (plan.status !== CommissionPlanStatus.ACTIVE) {
      throw new ConflictException(`Commission plan ${id} is already ${plan.status}`);
    }
    return this.prisma.commissionPlan.update({
      where: { id: plan.id },
      data: {
        status: CommissionPlanStatus.INACTIVE,
        deactivatedById,
        deactivatedAt: new Date(),
        deactivateReason: dto.reason,
      },
    });
  }
}
