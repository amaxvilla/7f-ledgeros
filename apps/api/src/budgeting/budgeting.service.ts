import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountType,
  BudgetApprovalAction,
  BudgetCommitmentSourceType,
  BudgetCommitmentStatus,
  BudgetRevisionStatus,
  BudgetStatus,
  BudgetTransferStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { ReviseBudgetDto } from './dto/revise-budget.dto';
import { TransferBudgetDto } from './dto/transfer-budget.dto';
import { CreateBudgetCommitmentDto } from './dto/budget-commitment.dto';

// Accounts with these types carry a natural debit balance; movement is
// measured as debit-minus-credit. Everything else (REVENUE, LIABILITY,
// EQUITY) carries a natural credit balance and is measured the other way.
const DEBIT_NORMAL_TYPES: AccountType[] = [AccountType.ASSET, AccountType.EXPENSE];

const OPEN_COMMITMENT_STATUSES: BudgetCommitmentStatus[] = [
  BudgetCommitmentStatus.OPEN,
  BudgetCommitmentStatus.PARTIALLY_RELEASED,
];

// Accepted by every commitment-related method below so callers (e.g.
// ProcurementService on PO approval / GRN posting) can compose budget
// commitment changes inside their own $transaction. Defaults to the
// injected PrismaService when omitted, so all existing call sites and
// tests are unaffected.
type Db = PrismaService | Prisma.TransactionClient;

interface BudgetLineDimensions {
  accountId: string;
  projectId: string | null;
  phaseId: string | null;
  departmentId: string | null;
  costCenterId: string | null;
  fundingSourceId: string | null;
}

@Injectable()
export class BudgetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // CREATE / READ
  // -------------------------------------------------------------------

  async createBudget(dto: CreateBudgetDto, userId: string) {
    const entity = await this.prisma.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) {
      throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);
    }

    const existing = await this.prisma.budget.findUnique({
      where: { entityId_code: { entityId: dto.entityId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Budget code ${dto.code} already exists for this entity`);
    }

    const accountIds = Array.from(new Set(dto.lines.map((l) => l.accountId)));
    const activeAccounts = await this.prisma.entityAccount.findMany({
      where: { entityId: dto.entityId, accountId: { in: accountIds }, isActive: true },
    });
    if (activeAccounts.length !== accountIds.length) {
      throw new BadRequestException(
        'One or more budget line accounts are not activated for this entity\'s chart of accounts',
      );
    }

    return this.prisma.budget.create({
      data: {
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        fiscalYear: dto.fiscalYear,
        description: dto.description,
        status: BudgetStatus.DRAFT,
        createdById: userId,
        lines: {
          create: dto.lines.map((line) => ({
            accountId: line.accountId,
            projectId: line.projectId,
            phaseId: line.phaseId,
            departmentId: line.departmentId,
            costCenterId: line.costCenterId,
            fundingSourceId: line.fundingSourceId,
            period: line.period,
            originalAmount: line.amount,
            revisedAmount: line.amount,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findAll(scope: SecurityScope, filters: { entityId?: string; fiscalYear?: number; status?: BudgetStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.budget.findMany({
      where: {
        AND: [
          rls,
          {
            entityId: filters.entityId,
            fiscalYear: filters.fiscalYear,
            status: filters.status,
          },
        ],
      },
      orderBy: [{ fiscalYear: 'desc' }, { code: 'asc' }],
    });
  }

  async findOne(id: string, scope: SecurityScope) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
      include: {
        lines: { include: { account: true, project: true, phase: true, department: true, costCenter: true, fundingSource: true } },
        revisions: { include: { lines: true }, orderBy: { revisionNumber: 'asc' } },
        transfers: { orderBy: { createdAt: 'asc' } },
        approvals: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!budget) throw new NotFoundException(`Budget ${id} not found`);
    if (!this.rowLevelSecurity.canAccess(scope, { entityId: budget.entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      // Same NotFoundException as a genuinely missing row — don't leak
      // existence of budgets the caller has no entity/business-unit access to.
      throw new NotFoundException(`Budget ${id} not found`);
    }
    return budget;
  }

  // -------------------------------------------------------------------
  // WORKFLOW: DRAFT -> SUBMITTED -> APPROVED (frozen) / REJECTED
  // -------------------------------------------------------------------

  async submit(id: string, userId: string) {
    const budget = await this.getBudgetOrThrow(id);
    this.assertStatus(budget.status, [BudgetStatus.DRAFT, BudgetStatus.REJECTED], 'submit');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.budget.update({
        where: { id },
        data: { status: BudgetStatus.SUBMITTED, submittedAt: new Date() },
      });
      await tx.budgetApproval.create({
        data: { budgetId: id, action: BudgetApprovalAction.SUBMITTED, actorId: userId },
      });
      return updated;
    });
  }

  /**
   * Approving a budget also freezes it: `originalAmount` on every line is
   * now locked in, and `frozenAt` is stamped immediately. From this point
   * on the only sanctioned ways to change amounts are `revise` (re-baseline)
   * and `transfer` (move revisedAmount between lines of the same budget).
   */
  async approve(id: string, userId: string, comments?: string) {
    const budget = await this.getBudgetOrThrow(id);
    this.assertStatus(budget.status, [BudgetStatus.SUBMITTED], 'approve');

    if (budget.createdById === userId) {
      throw new BadRequestException('The preparer of a budget cannot also approve it');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.budget.update({
        where: { id },
        data: {
          status: BudgetStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
          frozenAt: new Date(),
        },
      });
      await tx.budgetApproval.create({
        data: { budgetId: id, action: BudgetApprovalAction.APPROVED, actorId: userId, comments },
      });
      return updated;
    });
  }

  async reject(id: string, userId: string, comments?: string) {
    const budget = await this.getBudgetOrThrow(id);
    this.assertStatus(budget.status, [BudgetStatus.SUBMITTED], 'reject');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.budget.update({
        where: { id },
        data: { status: BudgetStatus.REJECTED },
      });
      await tx.budgetApproval.create({
        data: { budgetId: id, action: BudgetApprovalAction.REJECTED, actorId: userId, comments },
      });
      return updated;
    });
  }

  async close(id: string, userId: string) {
    const budget = await this.getBudgetOrThrow(id);
    this.assertStatus(budget.status, [BudgetStatus.APPROVED], 'close');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.budget.update({ where: { id }, data: { status: BudgetStatus.CLOSED } });
      await tx.budgetApproval.create({
        data: { budgetId: id, action: BudgetApprovalAction.CLOSED, actorId: userId, comments: 'Budget closed at year end' },
      });
      return updated;
    });
  }

  // -------------------------------------------------------------------
  // REVISION (re-baseline)
  // -------------------------------------------------------------------

  async revise(id: string, dto: ReviseBudgetDto, userId: string) {
    const budget = await this.getBudgetOrThrow(id);
    this.assertStatus(budget.status, [BudgetStatus.APPROVED], 'revise');

    const lineIds = dto.lines.map((l) => l.budgetLineId);
    const budgetLines = await this.prisma.budgetLine.findMany({ where: { id: { in: lineIds }, budgetId: id } });
    if (budgetLines.length !== lineIds.length) {
      throw new BadRequestException('One or more budget lines do not belong to this budget');
    }
    const lineById = new Map(budgetLines.map((l) => [l.id, l]));

    return this.prisma.$transaction(async (tx) => {
      const lastRevision = await tx.budgetRevision.findFirst({
        where: { budgetId: id },
        orderBy: { revisionNumber: 'desc' },
      });
      const revisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;

      const revision = await tx.budgetRevision.create({
        data: {
          budgetId: id,
          revisionNumber,
          reason: dto.reason,
          status: BudgetRevisionStatus.APPROVED,
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: {
            create: dto.lines.map((l) => ({
              budgetLineId: l.budgetLineId,
              previousAmount: lineById.get(l.budgetLineId)!.revisedAmount,
              newAmount: l.newAmount,
            })),
          },
        },
        include: { lines: true },
      });

      for (const l of dto.lines) {
        await tx.budgetLine.update({ where: { id: l.budgetLineId }, data: { revisedAmount: l.newAmount } });
      }

      await tx.budgetApproval.create({
        data: {
          budgetId: id,
          action: BudgetApprovalAction.REVISED,
          actorId: userId,
          comments: `Revision #${revisionNumber}: ${dto.reason}`,
        },
      });

      return revision;
    });
  }

  // -------------------------------------------------------------------
  // TRANSFER (reallocate within the same envelope)
  // -------------------------------------------------------------------

  async transfer(id: string, dto: TransferBudgetDto, userId: string) {
    const budget = await this.getBudgetOrThrow(id);
    this.assertStatus(budget.status, [BudgetStatus.APPROVED], 'transfer');

    if (dto.fromLineId === dto.toLineId) {
      throw new BadRequestException('Cannot transfer a budget line to itself');
    }

    const [fromLine, toLine] = await Promise.all([
      this.prisma.budgetLine.findFirst({ where: { id: dto.fromLineId, budgetId: id } }),
      this.prisma.budgetLine.findFirst({ where: { id: dto.toLineId, budgetId: id } }),
    ]);
    if (!fromLine || !toLine) {
      throw new BadRequestException('Both budget lines must belong to this budget');
    }

    const available = await this.getAvailableForLine(fromLine.id);
    if (available < dto.amount) {
      throw new BadRequestException(
        `Insufficient available budget on the source line: available ${available}, requested transfer ${dto.amount}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.budgetTransfer.create({
        data: {
          budgetId: id,
          fromLineId: dto.fromLineId,
          toLineId: dto.toLineId,
          amount: dto.amount,
          reason: dto.reason,
          status: BudgetTransferStatus.APPROVED,
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      await tx.budgetLine.update({
        where: { id: fromLine.id },
        data: { revisedAmount: { decrement: dto.amount } },
      });
      await tx.budgetLine.update({
        where: { id: toLine.id },
        data: { revisedAmount: { increment: dto.amount } },
      });

      await tx.budgetApproval.create({
        data: {
          budgetId: id,
          action: BudgetApprovalAction.TRANSFERRED,
          actorId: userId,
          comments: `Transferred ${dto.amount} from line ${fromLine.id} to line ${toLine.id}: ${dto.reason}`,
        },
      });

      return transfer;
    });
  }

  // -------------------------------------------------------------------
  // COMMITMENTS (reserve budget against a PO / manual commitment)
  // -------------------------------------------------------------------

  async createCommitment(dto: CreateBudgetCommitmentDto, userId: string, tx?: Prisma.TransactionClient) {
    const db: Db = tx ?? this.prisma;
    const line = await db.budgetLine.findUnique({
      where: { id: dto.budgetLineId },
      include: { budget: true },
    });
    if (!line) throw new NotFoundException(`Budget line ${dto.budgetLineId} not found`);
    if (line.budget.status !== BudgetStatus.APPROVED) {
      throw new ConflictException('Commitments can only be raised against an approved budget');
    }

    const available = await this.getAvailableForLine(line.id, tx);
    if (available < dto.amount) {
      throw new BadRequestException(
        `Insufficient available budget: available ${available}, requested commitment ${dto.amount}`,
      );
    }

    return db.budgetCommitment.create({
      data: {
        budgetLineId: dto.budgetLineId,
        amount: dto.amount,
        sourceType: dto.sourceType ?? BudgetCommitmentSourceType.MANUAL,
        sourceId: dto.sourceId,
        description: dto.description,
        createdById: userId,
      },
    });
  }

  /**
   * Releases (fully or partially) a commitment — called when the goods
   * receipt / vendor invoice behind it is posted. Exported so the
   * Procurement module can call it directly once it lands.
   */
  async releaseCommitment(id: string, amount: number, tx?: Prisma.TransactionClient) {
    const db: Db = tx ?? this.prisma;
    const commitment = await db.budgetCommitment.findUnique({ where: { id } });
    if (!commitment) throw new NotFoundException(`Budget commitment ${id} not found`);
    if (!OPEN_COMMITMENT_STATUSES.includes(commitment.status)) {
      throw new ConflictException(`Commitment ${id} is already ${commitment.status}`);
    }

    const newReleased = Number(commitment.releasedAmount) + amount;
    if (newReleased > Number(commitment.amount) + 0.005) {
      throw new BadRequestException(
        `Cannot release ${amount}: only ${Number(commitment.amount) - Number(commitment.releasedAmount)} remains open`,
      );
    }

    const fullyReleased = newReleased >= Number(commitment.amount) - 0.005;
    return db.budgetCommitment.update({
      where: { id },
      data: {
        releasedAmount: newReleased,
        status: fullyReleased ? BudgetCommitmentStatus.RELEASED : BudgetCommitmentStatus.PARTIALLY_RELEASED,
      },
    });
  }

  async cancelCommitment(id: string, tx?: Prisma.TransactionClient) {
    const db: Db = tx ?? this.prisma;
    const commitment = await db.budgetCommitment.findUnique({ where: { id } });
    if (!commitment) throw new NotFoundException(`Budget commitment ${id} not found`);
    if (!OPEN_COMMITMENT_STATUSES.includes(commitment.status)) {
      throw new ConflictException(`Commitment ${id} is already ${commitment.status}`);
    }
    return db.budgetCommitment.update({
      where: { id },
      data: { status: BudgetCommitmentStatus.CANCELLED },
    });
  }

  // -------------------------------------------------------------------
  // VARIANCE / AVAILABILITY (budgeted - actual - committed)
  // -------------------------------------------------------------------

  async variance(id: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
      include: {
        lines: {
          include: { account: true, project: true, phase: true, department: true, costCenter: true, fundingSource: true },
        },
      },
    });
    if (!budget) throw new NotFoundException(`Budget ${id} not found`);

    const lineResults = await Promise.all(
      budget.lines.map(async (line) => {
        const budgeted = Number(line.revisedAmount);
        const actual = await this.getActualForLine(budget.entityId, budget.fiscalYear, line);
        const committed = await this.getCommittedForLineId(line.id);
        const available = budgeted - actual - committed;

        return {
          budgetLineId: line.id,
          account: { id: line.account.id, code: line.account.code, name: line.account.name },
          projectId: line.projectId,
          phaseId: line.phaseId,
          departmentId: line.departmentId,
          costCenterId: line.costCenterId,
          fundingSourceId: line.fundingSourceId,
          period: line.period,
          originalAmount: Number(line.originalAmount),
          budgeted,
          actual,
          committed,
          available,
          utilizationPercent: budgeted > 0 ? Math.round(((actual + committed) / budgeted) * 10000) / 100 : null,
        };
      }),
    );

    const totals = lineResults.reduce(
      (acc, l) => ({
        budgeted: acc.budgeted + l.budgeted,
        actual: acc.actual + l.actual,
        committed: acc.committed + l.committed,
        available: acc.available + l.available,
      }),
      { budgeted: 0, actual: 0, committed: 0, available: 0 },
    );

    return {
      budgetId: budget.id,
      code: budget.code,
      fiscalYear: budget.fiscalYear,
      status: budget.status,
      lines: lineResults,
      totals,
    };
  }

  /** Available = revisedAmount - posted actuals - open commitments, for one line. */
  async getAvailableForLine(budgetLineId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db: Db = tx ?? this.prisma;
    const line = await db.budgetLine.findUnique({ where: { id: budgetLineId }, include: { budget: true, account: true } });
    if (!line) throw new NotFoundException(`Budget line ${budgetLineId} not found`);

    const actual = await this.getActualForLine(line.budget.entityId, line.budget.fiscalYear, line, tx);
    const committed = await this.getCommittedForLineId(line.id, tx);
    return Number(line.revisedAmount) - actual - committed;
  }

  private async getCommittedForLineId(budgetLineId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db: Db = tx ?? this.prisma;
    const commitments = await db.budgetCommitment.findMany({
      where: { budgetLineId, status: { in: OPEN_COMMITMENT_STATUSES } },
    });
    return commitments.reduce((sum, c) => sum + (Number(c.amount) - Number(c.releasedAmount)), 0);
  }

  private async getActualForLine(
    entityId: string,
    fiscalYear: number,
    line: BudgetLineDimensions & { period: number; account?: { accountType: AccountType } },
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db: Db = tx ?? this.prisma;
    const startDate = new Date(Date.UTC(fiscalYear, line.period - 1, 1));
    const endDate = new Date(Date.UTC(fiscalYear, line.period, 0, 23, 59, 59));

    const where: Prisma.JournalLineWhereInput = {
      accountId: line.accountId,
      entityId,
      journalEntry: { status: 'POSTED', entryDate: { gte: startDate, lte: endDate } },
      ...(line.projectId ? { projectId: line.projectId } : {}),
      ...(line.phaseId ? { phaseId: line.phaseId } : {}),
      ...(line.departmentId ? { departmentId: line.departmentId } : {}),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.fundingSourceId ? { fundingSourceId: line.fundingSourceId } : {}),
    };

    const aggregate = await db.journalLine.aggregate({
      where,
      _sum: { debit: true, credit: true },
    });

    const debit = Number(aggregate._sum.debit ?? 0);
    const credit = Number(aggregate._sum.credit ?? 0);

    const account = line.account ?? (await db.account.findUnique({ where: { id: line.accountId } }));
    const isDebitNormal = account ? DEBIT_NORMAL_TYPES.includes(account.accountType) : true;

    return isDebitNormal ? debit - credit : credit - debit;
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async getBudgetOrThrow(id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget) throw new NotFoundException(`Budget ${id} not found`);
    return budget;
  }

  private assertStatus(current: BudgetStatus, allowed: BudgetStatus[], action: string) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `Cannot ${action} a budget with status ${current}. Expected one of: ${allowed.join(', ')}`,
      );
    }
  }
}
