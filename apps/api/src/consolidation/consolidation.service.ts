import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, JournalEntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateConsolidationGroupDto {
  code: string;
  name: string;
  parentEntityId: string;
}

interface SetOwnershipDto {
  consolidationGroupId: string;
  parentEntityId: string;
  childEntityId: string;
  ownershipPercent: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

@Injectable()
export class ConsolidationService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // GROUPS & OWNERSHIP
  // -------------------------------------------------------------------

  async createGroup(dto: CreateConsolidationGroupDto) {
    const existing = await this.prisma.consolidationGroup.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Consolidation group code "${dto.code}" already exists`);

    const parent = await this.prisma.entity.findUnique({ where: { id: dto.parentEntityId } });
    if (!parent) throw new NotFoundException(`Parent entity ${dto.parentEntityId} not found`);

    return this.prisma.consolidationGroup.create({ data: dto });
  }

  findGroups() {
    return this.prisma.consolidationGroup.findMany({ include: { ownerships: true } });
  }

  async setOwnership(dto: SetOwnershipDto) {
    if (dto.ownershipPercent <= 0 || dto.ownershipPercent > 100) {
      throw new BadRequestException('Ownership percent must be between 0 and 100');
    }
    const group = await this.prisma.consolidationGroup.findUnique({
      where: { id: dto.consolidationGroupId },
    });
    if (!group) throw new NotFoundException(`Consolidation group ${dto.consolidationGroupId} not found`);

    return this.prisma.consolidationOwnership.create({
      data: {
        consolidationGroupId: dto.consolidationGroupId,
        parentEntityId: dto.parentEntityId,
        childEntityId: dto.childEntityId,
        ownershipPercent: dto.ownershipPercent,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
  }

  // -------------------------------------------------------------------
  // CONSOLIDATED TRIAL BALANCE / P&L / BALANCE SHEET
  // -------------------------------------------------------------------

  /**
   * Sums posted journal lines by account across every entity in the group,
   * nets out intercompany eliminations recorded for the group, and returns
   * a single consolidated trial balance.
   */
  async getConsolidatedTrialBalance(consolidationGroupId: string, fiscalPeriodId?: string) {
    const group = await this.getGroupWithMembers(consolidationGroupId);
    const entityIds = [group.parentEntityId, ...group.ownerships.map((o) => o.childEntityId)];

    const lines = await this.prisma.journalLine.findMany({
      where: {
        entityId: { in: entityIds },
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
        },
      },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { accountId: string; code: string; name: string; type: AccountType; debit: number; credit: number }
    >();

    for (const line of lines) {
      const key = line.accountId;
      const existing = byAccount.get(key) ?? {
        accountId: key,
        code: line.account.code,
        name: line.account.name,
        type: line.account.accountType,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(line.debit);
      existing.credit += Number(line.credit);
      byAccount.set(key, existing);
    }

    const eliminations = await this.prisma.intercompanyElimination.findMany({
      where: { consolidationGroupId, ...(fiscalPeriodId ? { fiscalPeriodId } : {}) },
    });
    const totalEliminated = eliminations.reduce((sum, e) => sum + Number(e.eliminationAmount), 0);

    const rows = Array.from(byAccount.values()).sort((a, b) => a.code.localeCompare(b.code));
    const grossTotals = rows.reduce(
      (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
      { debit: 0, credit: 0 },
    );

    return {
      consolidationGroupId,
      fiscalPeriodId: fiscalPeriodId ?? null,
      memberEntityIds: entityIds,
      rows,
      grossTotals,
      totalEliminated,
      netTotals: {
        debit: grossTotals.debit - totalEliminated,
        credit: grossTotals.credit - totalEliminated,
      },
    };
  }

  async getConsolidatedProfitAndLoss(consolidationGroupId: string, fiscalPeriodId?: string) {
    const tb = await this.getConsolidatedTrialBalance(consolidationGroupId, fiscalPeriodId);
    const revenue = tb.rows.filter((r) => r.type === AccountType.REVENUE);
    const expense = tb.rows.filter((r) => r.type === AccountType.EXPENSE);

    const totalRevenue = revenue.reduce((sum, r) => sum + (r.credit - r.debit), 0);
    const totalExpense = expense.reduce((sum, r) => sum + (r.debit - r.credit), 0);

    const minorityInterest = await this.calculateMinorityInterest(
      consolidationGroupId,
      totalRevenue - totalExpense,
    );

    return {
      consolidationGroupId,
      fiscalPeriodId: fiscalPeriodId ?? null,
      revenue,
      expense,
      totalRevenue,
      totalExpense,
      consolidatedNetIncome: totalRevenue - totalExpense,
      minorityInterest,
      netIncomeAttributableToParent: totalRevenue - totalExpense - minorityInterest.totalMinorityShare,
    };
  }

  async getConsolidatedBalanceSheet(consolidationGroupId: string, fiscalPeriodId?: string) {
    const tb = await this.getConsolidatedTrialBalance(consolidationGroupId, fiscalPeriodId);
    const assets = tb.rows.filter((r) => r.type === AccountType.ASSET);
    const liabilities = tb.rows.filter((r) => r.type === AccountType.LIABILITY);
    const equity = tb.rows.filter((r) => r.type === AccountType.EQUITY);

    const totalAssets = assets.reduce((sum, r) => sum + (r.debit - r.credit), 0);
    const totalLiabilities = liabilities.reduce((sum, r) => sum + (r.credit - r.debit), 0);
    const totalEquity = equity.reduce((sum, r) => sum + (r.credit - r.debit), 0);

    return {
      consolidationGroupId,
      fiscalPeriodId: fiscalPeriodId ?? null,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balances: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  }

  /**
   * Minority (non-controlling) interest = each subsidiary's share of group
   * net income multiplied by (100% - group's ownership%) in that subsidiary.
   * This is a simplified single-period calculation; a production system
   * would attribute income by subsidiary rather than pro-rating the group
   * total, which the seed data / Phase 2 work will refine.
   */
  private async calculateMinorityInterest(consolidationGroupId: string, consolidatedNetIncome: number) {
    const group = await this.getGroupWithMembers(consolidationGroupId);
    const shares = group.ownerships.map((o) => {
      const minorityPercent = 100 - Number(o.ownershipPercent);
      return {
        childEntityId: o.childEntityId,
        ownershipPercent: Number(o.ownershipPercent),
        minorityPercent,
      };
    });

    // Simplified: distribute consolidated net income evenly across subsidiaries
    // for the minority-share calculation until per-entity P&L attribution lands.
    const perSubsidiaryIncome = shares.length > 0 ? consolidatedNetIncome / shares.length : 0;
    const detail = shares.map((s) => ({
      ...s,
      minorityShare: perSubsidiaryIncome * (s.minorityPercent / 100),
    }));

    return {
      detail,
      totalMinorityShare: detail.reduce((sum, d) => sum + d.minorityShare, 0),
    };
  }

  private async getGroupWithMembers(consolidationGroupId: string) {
    const group = await this.prisma.consolidationGroup.findUnique({
      where: { id: consolidationGroupId },
      include: { ownerships: true },
    });
    if (!group) throw new NotFoundException(`Consolidation group ${consolidationGroupId} not found`);
    return group;
  }
}
