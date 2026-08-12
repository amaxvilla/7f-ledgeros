import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgentAssignmentRole,
  AgentAssignmentScope,
  AgentStatus,
  CommissionBasisType,
  CommissionCalculationStatus,
  CommissionCollectionBasis,
  CommissionPlanType,
  Prisma,
  TaxType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { CommissionPlanService } from './commission-plan.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import {
  AdjustCommissionCalculationDto,
  ApproveCommissionCalculationDto,
  CalculateCommissionDto,
  CancelCommissionCalculationDto,
  MarkPaidCommissionCalculationDto,
  MarkPayableCommissionCalculationDto,
  RejectCommissionCalculationDto,
  ReverseCommissionCalculationDto,
  SubmitCommissionCalculationDto,
} from './dto/commission-calculation.dto';

/**
 * "Active" — not yet in a terminal state (REJECTED/CANCELLED/REVERSED).
 * Used by `calculate()`'s own duplicate-assignment guard (an assignment
 * can have at most one non-terminal calculation at a time, whatever
 * stage of the lifecycle it's at) and by `reverse()`'s own guard (any
 * non-terminal state, including PAID, can be reversed — see
 * CommissionCalculationStatus's own schema doc comment for why a
 * clawback of an already-paid commission is a real business need this
 * deliberately still allows). Exported so CommissionReportingService's own
 * "commission earned" total (RE-COMM.5) reuses this exact definition
 * (every non-terminal-rejection status) rather than re-deciding which
 * statuses count as "earned" a second time.
 */
export const ACTIVE_STATUSES: CommissionCalculationStatus[] = [
  CommissionCalculationStatus.CALCULATED,
  CommissionCalculationStatus.PENDING,
  CommissionCalculationStatus.APPROVED,
  CommissionCalculationStatus.PAYABLE,
  CommissionCalculationStatus.PAID,
];

/** Same deep-include chain AgentAssignmentService/RealEstateService.getCustomerStatement already use to reach a Unit's own Project (and, from there, its optional Estate) — reused here rather than re-derived. Exported so CommissionReportingService's own by-project/by-unit aggregations (RE-COMM.5) reuse the identical chain instead of re-deriving it a third time. */
export const UNIT_PROJECT_INCLUDE = {
  floor: { include: { block: { include: { phase: { include: { project: true } } } } } },
} satisfies Prisma.UnitInclude;

/** Every field a resolved CommissionPlan's own rate/tier lookup needs, kept in one place so `pickRate` and the persisted snapshot always agree. */
interface RateResolution {
  tierOrderApplied: number | null;
  rateApplied: number | null;
  fixedAmountApplied: number | null;
  grossCommission: number;
}

/**
 * Agent & Commission Management, RE-COMM.2/RE-COMM.3/RE-COMM.4 —
 * Commission Calculation + Lifecycle + Financial Integration.
 *
 * Computes a single commission amount for one AgentAssignment against
 * the confirmed sale (UnitSaleAllocation) it was made on, snapshotting
 * every number used so a later CommissionPlan edit or TaxCode rate
 * change never retroactively alters an already-calculated historical
 * commission. Also owns the full approval/payment lifecycle
 * (submit/approve/reject/markPayable/markPaid) and adjustment
 * (reverse-and-recalculate) — see CommissionCalculationStatus's own
 * schema doc comment for the complete transition graph. markPayable/
 * markPaid post through the existing PostingEngineService.
 * postSystemEntry — no separate accounting engine, per the master
 * prompt's own explicit RE-COMM.4 instruction; see
 * AccountsPayableService.postInvoice for the closest existing analogue
 * this reuses.
 */
@Injectable()
export class CommissionCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly commissionPlans: CommissionPlanService,
    private readonly postingEngine: PostingEngineService,
  ) {}

  private async requireCalculation(id: string) {
    const calc = await this.prisma.commissionCalculation.findUnique({ where: { id } });
    if (!calc) throw new NotFoundException(`Commission calculation ${id} not found`);
    return calc;
  }

  /**
   * Loads and validates everything a calculation needs from the
   * assignment side: the assignment itself must be SALE-scoped and
   * active, the agent must be ACTIVE, and (if not exempt) a WHT tax
   * code, if supplied, must exist. Returns everything already resolved
   * so `calculate`/`preview` share one code path.
   */
  private async resolveInputs(scope: SecurityScope, dto: CalculateCommissionDto) {
    const assignment = await this.prisma.agentAssignment.findUnique({
      where: { id: dto.agentAssignmentId },
      include: {
        agent: true,
        allocation: {
          include: {
            installmentSchedule: { include: { lines: true } },
            unit: { include: UNIT_PROJECT_INCLUDE },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException(`Agent assignment ${dto.agentAssignmentId} not found`);
    if (!this.rowLevelSecurity.canAccess(scope, assignment, { dimensions: ['entity', 'businessUnit'], mode: 'post' })) {
      throw new NotFoundException(`Agent assignment ${dto.agentAssignmentId} not found`);
    }

    if (assignment.scope !== AgentAssignmentScope.SALE || !assignment.allocationId || !assignment.allocation) {
      throw new BadRequestException(
        'A commission can only be calculated for a SALE-scope assignment with a confirmed sale (allocationId) — this assignment has none',
      );
    }
    if (!assignment.isActive) {
      throw new BadRequestException(`Agent assignment ${assignment.id} has already ended`);
    }

    const agent = assignment.agent;
    if (agent.status !== AgentStatus.ACTIVE) {
      throw new BadRequestException(`Agent ${agent.id} is not ACTIVE (status: ${agent.status}) — cannot calculate commission`);
    }

    const allocation = assignment.allocation;
    if (allocation.isCancelled) {
      throw new BadRequestException(`Sale allocation ${allocation.id} has been cancelled — cannot calculate commission against it`);
    }

    if (dto.whtTaxCodeId && agent.withholdingTaxExempt) {
      throw new BadRequestException(
        `Agent ${agent.id} is withholding-tax-exempt — whtTaxCodeId must not be supplied`,
      );
    }

    let taxCode: { rate: Prisma.Decimal; taxAuthorityAccountId: string } | null = null;
    if (dto.whtTaxCodeId) {
      const found = await this.prisma.taxCode.findUnique({ where: { id: dto.whtTaxCodeId } });
      if (!found) throw new NotFoundException(`Tax code ${dto.whtTaxCodeId} not found`);
      if (found.taxType !== TaxType.WHT) {
        throw new BadRequestException(`Tax code ${dto.whtTaxCodeId} is not a WHT code (taxType: ${found.taxType})`);
      }
      if (!found.isActive) {
        throw new BadRequestException(`Tax code ${dto.whtTaxCodeId} is not active`);
      }
      taxCode = found;
    }

    return { assignment, agent, allocation, taxCode };
  }

  /**
   * Basis (gross/net sale value, discount handling) plus partial-payment
   * proration. `collectedPercent` is clamped to [0, 1] — an over-payment
   * (rare, but not schema-prevented on InstallmentLine) never inflates
   * the commission basis beyond 100%.
   */
  private computeBasis(
    allocation: { salePrice: Prisma.Decimal; installmentSchedule: { totalAmount: Prisma.Decimal; lines: { amountPaid: Prisma.Decimal }[] } | null },
    dto: CalculateCommissionDto,
  ) {
    const grossSaleValue = Number(allocation.salePrice);
    const discountAmount = dto.discountAmount ?? 0;
    if (discountAmount > grossSaleValue) {
      throw new BadRequestException(`discountAmount (${discountAmount}) cannot exceed grossSaleValue (${grossSaleValue})`);
    }
    const netSaleValue = grossSaleValue - discountAmount;
    const commissionBasisAmount = dto.basisType === CommissionBasisType.GROSS ? grossSaleValue : netSaleValue;

    const collectionBasis = dto.collectionBasis ?? CommissionCollectionBasis.FULL;
    let collectedAmount: number | null = null;
    let collectedPercent: number | null = null;
    let proratedBasisAmount = commissionBasisAmount;

    if (collectionBasis === CommissionCollectionBasis.COLLECTED) {
      if (!allocation.installmentSchedule) {
        throw new BadRequestException(
          'collectionBasis COLLECTED requires the sale to have an InstallmentSchedule — this is a cash sale with nothing to prorate against',
        );
      }
      const totalAmount = Number(allocation.installmentSchedule.totalAmount);
      const paid = allocation.installmentSchedule.lines.reduce((sum, l) => sum + Number(l.amountPaid), 0);
      collectedAmount = paid;
      collectedPercent = totalAmount > 0 ? Math.min(1, Math.max(0, paid / totalAmount)) : 0;
      proratedBasisAmount = commissionBasisAmount * collectedPercent;
    }

    return { grossSaleValue, discountAmount, netSaleValue, commissionBasisAmount, collectionBasis, collectedAmount, collectedPercent, proratedBasisAmount };
  }

  /**
   * Applies a resolved CommissionPlan's rate/tier to `proratedBasisAmount`.
   * Tiered plans apply each band's own rate/fixedAmount only to the slice
   * of proratedBasisAmount falling within that band (a standard
   * progressive-tier calculation, not "whichever single tier the total
   * falls into") — consistent with CommissionPlanTier's own schema
   * comment describing bands as a gapless schedule *over the commission
   * basis amount*, the same convention a tax bracket uses.
   */
  private applyPlan(
    plan: { type: CommissionPlanType; isTiered: boolean; rate: Prisma.Decimal | null; fixedAmount: Prisma.Decimal | null; tiers: { tierOrder: number; minAmount: Prisma.Decimal; maxAmount: Prisma.Decimal | null; rate: Prisma.Decimal | null; fixedAmount: Prisma.Decimal | null }[] },
    proratedBasisAmount: number,
  ): RateResolution {
    if (!plan.isTiered) {
      if (plan.type === CommissionPlanType.PERCENTAGE) {
        const rate = Number(plan.rate);
        return { tierOrderApplied: null, rateApplied: rate, fixedAmountApplied: null, grossCommission: proratedBasisAmount * (rate / 100) };
      }
      const fixedAmount = Number(plan.fixedAmount);
      return { tierOrderApplied: null, rateApplied: null, fixedAmountApplied: fixedAmount, grossCommission: fixedAmount };
    }

    // Tiered: walk each band, apply its rate/fixedAmount to the slice of
    // proratedBasisAmount that falls within [minAmount, maxAmount).
    let remaining = proratedBasisAmount;
    let total = 0;
    let lastTierOrder: number | null = null;
    const sorted = [...plan.tiers].sort((a, b) => a.tierOrder - b.tierOrder);
    for (const tier of sorted) {
      const min = Number(tier.minAmount);
      const max = tier.maxAmount != null ? Number(tier.maxAmount) : Infinity;
      if (proratedBasisAmount <= min) break;
      const sliceWidth = Math.min(proratedBasisAmount, max) - min;
      if (sliceWidth <= 0) continue;
      lastTierOrder = tier.tierOrder;
      if (plan.type === CommissionPlanType.PERCENTAGE) {
        total += sliceWidth * (Number(tier.rate) / 100);
      } else {
        // Fixed-amount tiers: the tier's own fixedAmount applies once,
        // for whichever single band the total basis falls into (a flat
        // fee has no "per-slice" meaning the way a percentage does).
        if (proratedBasisAmount > min && (tier.maxAmount == null || proratedBasisAmount <= max)) {
          total = Number(tier.fixedAmount);
        }
      }
      remaining -= sliceWidth;
      if (remaining <= 0) break;
    }
    return { tierOrderApplied: lastTierOrder, rateApplied: null, fixedAmountApplied: null, grossCommission: total };
  }

  /**
   * Shared resolution + computation path for both `calculate` (persists)
   * and `preview` (does not). Returns everything `calculate` needs to
   * build the Prisma `create` payload.
   */
  private async computeAll(scope: SecurityScope, dto: CalculateCommissionDto) {
    const { assignment, agent, allocation, taxCode } = await this.resolveInputs(scope, dto);

    // Derived the same way AgentAssignmentService.resolveTarget() derives
    // it for a UNIT/SALE-scope assignment — AgentAssignment.projectId
    // itself is only populated for PROJECT-scope rows (confirmed by
    // reading AgentAssignmentService.create() directly), so a SALE-scope
    // assignment's own project/estate must be re-derived from the
    // allocation's unit -> floor -> block -> phase -> project chain to
    // give CommissionPlanService.resolvePlan() a real PROJECT/ESTATE
    // candidate to try, not just UNIT/AGENT/GLOBAL.
    const project = allocation.unit.floor.block.phase.project;

    const plan = await this.commissionPlans.resolvePlan(scope, {
      entityId: assignment.entityId,
      projectId: project.id,
      estateId: project.estateId ?? undefined,
      unitId: allocation.unitId,
      agentId: agent.id,
      isReferral: assignment.role === AgentAssignmentRole.REFERRAL,
    });
    if (!plan) {
      throw new NotFoundException(
        `No ACTIVE commission plan resolves for this assignment (entity ${assignment.entityId}, unit ${allocation.unitId}, agent ${agent.id}, isReferral ${assignment.role === AgentAssignmentRole.REFERRAL})`,
      );
    }

    const basis = this.computeBasis(allocation, dto);
    const rate = this.applyPlan(plan, basis.proratedBasisAmount);

    let whtApplied = false;
    let whtRate: number | null = null;
    let whtAmount = 0;
    let whtAuthorityAccountId: string | null = null;
    if (taxCode) {
      whtApplied = true;
      whtRate = Number(taxCode.rate);
      whtAmount = rate.grossCommission * (whtRate / 100);
      whtAuthorityAccountId = taxCode.taxAuthorityAccountId;
    }
    const netCommission = rate.grossCommission - whtAmount;

    return { assignment, agent, allocation, plan, basis, rate, whtApplied, whtRate, whtAmount, whtAuthorityAccountId, netCommission };
  }

  /** Computes and persists a new CommissionCalculation row. */
  async calculate(scope: SecurityScope, dto: CalculateCommissionDto, calculatedById: string) {
    const existing = await this.prisma.commissionCalculation.findFirst({
      where: { agentAssignmentId: dto.agentAssignmentId, status: { in: ACTIVE_STATUSES } },
    });
    if (existing) {
      throw new ConflictException(
        `Agent assignment ${dto.agentAssignmentId} already has an active commission calculation (${existing.id}, status ${existing.status}) — reverse or cancel it first`,
      );
    }

    const { assignment, agent, allocation, plan, basis, rate, whtApplied, whtRate, whtAmount, whtAuthorityAccountId, netCommission } =
      await this.computeAll(scope, dto);

    return this.prisma.commissionCalculation.create({
      data: {
        entityId: assignment.entityId,
        agentId: agent.id,
        agentAssignmentId: assignment.id,
        role: assignment.role,
        allocationId: allocation.id,
        commissionPlanId: plan.id,
        planType: plan.type,
        planWasTiered: plan.isTiered,
        tierOrderApplied: rate.tierOrderApplied,
        rateApplied: rate.rateApplied,
        fixedAmountApplied: rate.fixedAmountApplied,
        basisType: dto.basisType,
        grossSaleValue: basis.grossSaleValue,
        discountAmount: basis.discountAmount,
        netSaleValue: basis.netSaleValue,
        commissionBasisAmount: basis.commissionBasisAmount,
        collectionBasis: basis.collectionBasis,
        collectedAmount: basis.collectedAmount,
        collectedPercent: basis.collectedPercent,
        proratedBasisAmount: basis.proratedBasisAmount,
        grossCommission: rate.grossCommission,
        whtApplied,
        whtRate,
        whtAmount,
        whtAuthorityAccountId,
        netCommission,
        calculatedById,
        notes: dto.notes,
      },
    });
  }

  /** Read-only — runs the identical resolution/computation logic without persisting anything. */
  async preview(scope: SecurityScope, dto: CalculateCommissionDto) {
    const { assignment, agent, allocation, plan, basis, rate, whtApplied, whtRate, whtAmount, whtAuthorityAccountId, netCommission } =
      await this.computeAll(scope, dto);
    return {
      agentAssignmentId: assignment.id,
      agentId: agent.id,
      allocationId: allocation.id,
      commissionPlanId: plan.id,
      planType: plan.type,
      planWasTiered: plan.isTiered,
      ...basis,
      ...rate,
      whtApplied,
      whtRate,
      whtAmount,
      whtAuthorityAccountId,
      netCommission,
    };
  }

  findForAgent(scope: SecurityScope, agentId: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.commissionCalculation.findMany({
      where: { AND: [rls, { agentId }] },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  findForAllocation(scope: SecurityScope, allocationId: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.commissionCalculation.findMany({
      where: { AND: [rls, { allocationId }] },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  findAll(
    scope: SecurityScope,
    filters: { entityId?: string; agentId?: string; status?: CommissionCalculationStatus },
  ) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.commissionCalculation.findMany({
      where: { AND: [rls, filters] },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  async getOne(scope: SecurityScope, id: string) {
    const calc = await this.requireCalculation(id);
    if (!this.rowLevelSecurity.canAccess(scope, calc, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Commission calculation ${id} not found`);
    }
    return calc;
  }

  /** Voids a calculation that was never approved (duplicate, wrong plan resolved). Only valid from CALCULATED or PENDING — once APPROVED, use `reverse` instead (approval means someone already acted on it). Terminal — see CommissionCalculationStatus's own schema doc comment. */
  async cancel(scope: SecurityScope, id: string, dto: CancelCommissionCalculationDto, cancelledById: string) {
    const calc = await this.getOne(scope, id);
    if (calc.status !== CommissionCalculationStatus.CALCULATED && calc.status !== CommissionCalculationStatus.PENDING) {
      throw new ConflictException(
        `Commission calculation ${id} cannot be cancelled from status ${calc.status} — only CALCULATED or PENDING calculations can be cancelled; use reverse instead once approved`,
      );
    }
    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: { status: CommissionCalculationStatus.CANCELLED, cancelledById, cancelledAt: new Date(), cancelReason: dto.reason },
    });
  }

  /** Reverses a calculation whose underlying sale/assignment was reversed, or which was itself wrong — valid from any non-terminal status, including PAID (a clawback of an already-paid commission). Terminal — see CommissionCalculationStatus's own schema doc comment. Preserved for audit, never deleted. */
  async reverse(scope: SecurityScope, id: string, dto: ReverseCommissionCalculationDto, reversedById: string) {
    const calc = await this.getOne(scope, id);
    if (!ACTIVE_STATUSES.includes(calc.status)) {
      throw new ConflictException(`Commission calculation ${id} is already ${calc.status} — nothing to reverse`);
    }
    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: { status: CommissionCalculationStatus.REVERSED, reversedById, reversedAt: new Date(), reverseReason: dto.reason },
    });
  }

  /** CALCULATED -> PENDING. The first step of RE-COMM.3's own approval workflow — see CommissionCalculationStatus's own schema doc comment for the full transition graph. */
  async submit(scope: SecurityScope, id: string, dto: SubmitCommissionCalculationDto, submittedById: string) {
    const calc = await this.getOne(scope, id);
    if (calc.status !== CommissionCalculationStatus.CALCULATED) {
      throw new ConflictException(
        `Commission calculation ${id} cannot be submitted from status ${calc.status} — only CALCULATED calculations can be submitted for approval`,
      );
    }
    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: {
        status: CommissionCalculationStatus.PENDING,
        submittedById,
        submittedAt: new Date(),
        notes: dto.notes ?? calc.notes,
      },
    });
  }

  /** PENDING -> APPROVED. Requires the `commission.approve` permission at the controller level, separate from `commission.manage` — see COMMISSION_APPROVE's own doc comment in packages/config/src/permissions.ts. */
  async approve(scope: SecurityScope, id: string, dto: ApproveCommissionCalculationDto, approvedById: string) {
    const calc = await this.getOne(scope, id);
    if (calc.status !== CommissionCalculationStatus.PENDING) {
      throw new ConflictException(
        `Commission calculation ${id} cannot be approved from status ${calc.status} — only PENDING calculations can be approved`,
      );
    }
    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: {
        status: CommissionCalculationStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
        notes: dto.notes ?? calc.notes,
      },
    });
  }

  /** PENDING -> REJECTED. Terminal — a distinct outcome from `cancel`: rejection means an approver reviewed and declined it. Correct it via `adjust` from a fresh calculation, not by resurrecting this row. */
  async reject(scope: SecurityScope, id: string, dto: RejectCommissionCalculationDto, rejectedById: string) {
    const calc = await this.getOne(scope, id);
    if (calc.status !== CommissionCalculationStatus.PENDING) {
      throw new ConflictException(
        `Commission calculation ${id} cannot be rejected from status ${calc.status} — only PENDING calculations can be rejected`,
      );
    }
    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: { status: CommissionCalculationStatus.REJECTED, rejectedById, rejectedAt: new Date(), rejectReason: dto.reason },
    });
  }

  /**
   * APPROVED -> PAYABLE. Posts the accrual through the existing
   * PostingEngineService.postSystemEntry — see
   * AccountsPayableService.postInvoice's own gross/WHT/net split for
   * the analogue this reuses: Dr commissionExpenseAccountId (gross) /
   * Cr whtAuthorityAccountId (whtAmount, only if whtApplied) /
   * Cr commissionPayableAccountId (net). `payableAccountId` is stored
   * on this row for markPaid() to reuse — see its own schema doc
   * comment for why the caller doesn't resupply it there.
   */
  async markPayable(scope: SecurityScope, id: string, dto: MarkPayableCommissionCalculationDto, markedPayableById: string) {
    const calc = await this.getOne(scope, id);
    if (calc.status !== CommissionCalculationStatus.APPROVED) {
      throw new ConflictException(
        `Commission calculation ${id} cannot be marked payable from status ${calc.status} — only APPROVED calculations can be marked payable`,
      );
    }

    const lines: { accountId: string; debit: number; credit: number }[] = [
      { accountId: dto.commissionExpenseAccountId, debit: Number(calc.grossCommission), credit: 0 },
    ];
    if (calc.whtApplied && calc.whtAuthorityAccountId) {
      lines.push({ accountId: calc.whtAuthorityAccountId, debit: 0, credit: Number(calc.whtAmount) });
    }
    lines.push({ accountId: dto.commissionPayableAccountId, debit: 0, credit: Number(calc.netCommission) });

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: calc.entityId,
        entryDate: new Date().toISOString(),
        description: `Commission accrual — calculation ${calc.id}`,
        sourceType: 'COMMISSION',
        sourceReference: calc.id,
        lines,
      } as never,
      markedPayableById,
    );

    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: {
        status: CommissionCalculationStatus.PAYABLE,
        markedPayableById,
        markedPayableAt: new Date(),
        payableAccountId: dto.commissionPayableAccountId,
        payableJournalEntryId: (posted as { id: string }).id,
        notes: dto.notes ?? calc.notes,
      },
    });
  }

  /**
   * PAYABLE -> PAID. Posts the clearing entry through the same
   * PostingEngineService.postSystemEntry: Dr the payable account
   * markPayable() itself recorded (net) / Cr cashAccountId (net).
   * `paymentReference` remains a separate, free-text reconciliation
   * detail (e.g. a bank transfer reference) — independent of the
   * JournalEntry this posts, which is this system's own record.
   */
  async markPaid(scope: SecurityScope, id: string, dto: MarkPaidCommissionCalculationDto, paidById: string) {
    const calc = await this.getOne(scope, id);
    if (calc.status !== CommissionCalculationStatus.PAYABLE) {
      throw new ConflictException(
        `Commission calculation ${id} cannot be marked paid from status ${calc.status} — only PAYABLE calculations can be marked paid`,
      );
    }
    if (!calc.payableAccountId) {
      // Should be unreachable — every path into PAYABLE goes through
      // markPayable(), which always sets this — but guarded explicitly
      // rather than posting an entry with a null account.
      throw new ConflictException(`Commission calculation ${id} has no payable account on record — cannot post the clearing entry`);
    }

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: calc.entityId,
        entryDate: new Date().toISOString(),
        description: `Commission payment — calculation ${calc.id}`,
        sourceType: 'COMMISSION',
        sourceReference: calc.id,
        lines: [
          { accountId: calc.payableAccountId, debit: Number(calc.netCommission), credit: 0 },
          { accountId: dto.cashAccountId, debit: 0, credit: Number(calc.netCommission) },
        ],
      } as never,
      paidById,
    );

    return this.prisma.commissionCalculation.update({
      where: { id: calc.id },
      data: {
        status: CommissionCalculationStatus.PAID,
        paidById,
        paidAt: new Date(),
        paymentReference: dto.paymentReference,
        paymentJournalEntryId: (posted as { id: string }).id,
      },
    });
  }

  /**
   * RE-COMM.3's own "Adjustment" requirement. Atomically reverses `id`
   * (must be in an active/non-terminal state — the same states `reverse`
   * itself allows) and creates a brand-new calculation from
   * `dto.recalculate`, linked back via `supersedesCalculationId`. Both
   * writes happen in one `$transaction` so a failure partway through
   * never leaves the original reversed with no replacement.
   */
  async adjust(scope: SecurityScope, id: string, dto: AdjustCommissionCalculationDto, userId: string) {
    const calc = await this.getOne(scope, id);
    if (!ACTIVE_STATUSES.includes(calc.status)) {
      throw new ConflictException(`Commission calculation ${id} is already ${calc.status} — nothing to adjust`);
    }

    // Resolved/validated outside the transaction, same as `calculate`
    // itself — computeAll() only reads, never writes, so doing this
    // first keeps the transaction itself short (just the two writes).
    const computed = await this.computeAll(scope, dto.recalculate);

    const [, created] = await this.prisma.$transaction([
      this.prisma.commissionCalculation.update({
        where: { id: calc.id },
        data: { status: CommissionCalculationStatus.REVERSED, reversedById: userId, reversedAt: new Date(), reverseReason: dto.reason },
      }),
      this.prisma.commissionCalculation.create({
        data: {
          entityId: computed.assignment.entityId,
          agentId: computed.agent.id,
          agentAssignmentId: computed.assignment.id,
          role: computed.assignment.role,
          allocationId: computed.allocation.id,
          commissionPlanId: computed.plan.id,
          planType: computed.plan.type,
          planWasTiered: computed.plan.isTiered,
          tierOrderApplied: computed.rate.tierOrderApplied,
          rateApplied: computed.rate.rateApplied,
          fixedAmountApplied: computed.rate.fixedAmountApplied,
          basisType: dto.recalculate.basisType,
          grossSaleValue: computed.basis.grossSaleValue,
          discountAmount: computed.basis.discountAmount,
          netSaleValue: computed.basis.netSaleValue,
          commissionBasisAmount: computed.basis.commissionBasisAmount,
          collectionBasis: computed.basis.collectionBasis,
          collectedAmount: computed.basis.collectedAmount,
          collectedPercent: computed.basis.collectedPercent,
          proratedBasisAmount: computed.basis.proratedBasisAmount,
          grossCommission: computed.rate.grossCommission,
          whtApplied: computed.whtApplied,
          whtRate: computed.whtRate,
          whtAmount: computed.whtAmount,
          whtAuthorityAccountId: computed.whtAuthorityAccountId,
          netCommission: computed.netCommission,
          calculatedById: userId,
          supersedesCalculationId: calc.id,
          notes: dto.recalculate.notes,
        },
      }),
    ]);

    return created;
  }
}
