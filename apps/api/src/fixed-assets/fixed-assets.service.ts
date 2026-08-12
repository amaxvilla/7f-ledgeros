import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FixedAssetStatus, DepreciationEntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  CreateAssetCategoryDto,
  CreateFixedAssetDto,
  DisposeAssetDto,
  RunDepreciationDto,
} from './dto/fixed-assets.dto';

const CENTS_TOLERANCE = 0.005;

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // ---- Asset Categories ----

  async createAssetCategory(dto: CreateAssetCategoryDto) {
    const existing = await this.prisma.assetCategory.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Asset category "${dto.name}" already exists`);
    return this.prisma.assetCategory.create({ data: { ...dto } });
  }

  findAssetCategories() {
    return this.prisma.assetCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  // ---- Fixed Asset Register ----

  async createFixedAsset(dto: CreateFixedAssetDto) {
    const category = await this.prisma.assetCategory.findUnique({ where: { id: dto.assetCategoryId } });
    if (!category) throw new NotFoundException(`Asset category ${dto.assetCategoryId} not found`);

    const existingTag = await this.prisma.fixedAsset.findUnique({
      where: { entityId_assetTag: { entityId: dto.entityId, assetTag: dto.assetTag } },
    });
    if (existingTag) throw new ConflictException(`Asset tag ${dto.assetTag} already exists for this entity`);

    const residualValue = dto.residualValue ?? 0;
    if (residualValue > dto.acquisitionCost) {
      throw new BadRequestException('Residual value cannot exceed acquisition cost');
    }

    return this.prisma.fixedAsset.create({
      data: {
        entityId: dto.entityId,
        assetCategoryId: dto.assetCategoryId,
        assetTag: dto.assetTag,
        name: dto.name,
        description: dto.description,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: dto.acquisitionCost,
        residualValue,
        usefulLifeYears: dto.usefulLifeYears,
        departmentId: dto.departmentId,
        costCenterId: dto.costCenterId,
        locationName: dto.locationName,
      },
    });
  }

  findFixedAssets(scope: SecurityScope, entityId?: string, status?: FixedAssetStatus) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity'] });
    return this.prisma.fixedAsset.findMany({
      where: { AND: [rls, { entityId, status }] },
      include: { assetCategory: true },
      orderBy: { assetTag: 'asc' },
    });
  }

  async findFixedAssetById(id: string) {
    const asset = await this.prisma.fixedAsset.findUnique({
      where: { id },
      include: { assetCategory: true, depreciationEntries: { orderBy: { periodDate: 'asc' } }, disposal: true },
    });
    if (!asset) throw new NotFoundException(`Fixed asset ${id} not found`);
    return asset;
  }

  // ---- Depreciation Engine (straight-line only — see DepreciationMethod doc comment) ----

  /**
   * Posts one month of straight-line depreciation for every eligible
   * ACTIVE asset as of the month containing periodDate. Idempotent per
   * (asset, month) via the DepreciationEntry unique constraint — safe to
   * re-run for the same month without double-posting.
   */
  async runDepreciation(dto: RunDepreciationDto) {
    const periodMonth = startOfMonth(new Date(dto.periodDate));

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        status: FixedAssetStatus.ACTIVE,
        entityId: dto.entityId,
        acquisitionDate: { lte: endOfMonth(periodMonth) },
      },
      include: { assetCategory: true },
    });

    const results: { fixedAssetId: string; skipped?: string; depreciationEntry?: unknown }[] = [];

    for (const asset of assets) {
      const alreadyPosted = await this.prisma.depreciationEntry.findUnique({
        where: { fixedAssetId_periodDate: { fixedAssetId: asset.id, periodDate: periodMonth } },
      });
      if (alreadyPosted) {
        results.push({ fixedAssetId: asset.id, skipped: 'already posted for this period' });
        continue;
      }

      const depreciableBase = Number(asset.acquisitionCost) - Number(asset.residualValue);
      const monthlyDepreciation = depreciableBase / (asset.usefulLifeYears * 12);

      const priorAccumulated = await this.getAccumulatedDepreciation(asset.id);
      const remainingDepreciable = depreciableBase - priorAccumulated;

      if (remainingDepreciable <= CENTS_TOLERANCE) {
        await this.prisma.fixedAsset.update({
          where: { id: asset.id },
          data: { status: FixedAssetStatus.FULLY_DEPRECIATED },
        });
        results.push({ fixedAssetId: asset.id, skipped: 'already fully depreciated' });
        continue;
      }

      const thisMonthDepreciation = Math.min(monthlyDepreciation, remainingDepreciable);
      const newAccumulated = priorAccumulated + thisMonthDepreciation;
      const netBookValue = Number(asset.acquisitionCost) - newAccumulated;

      const posted = await this.postingEngine.postSystemEntry(
        {
          entityId: asset.entityId,
          entryDate: periodMonth.toISOString(),
          description: `Depreciation — ${asset.assetTag} / ${asset.name} (${monthLabel(periodMonth)})`,
          sourceType: 'FIXED_ASSET',
          sourceReference: asset.id,
          lines: [
            {
              accountId: asset.assetCategory.depreciationExpenseAccountId,
              debit: round2(thisMonthDepreciation),
              credit: 0,
              departmentId: asset.departmentId ?? undefined,
              costCenterId: asset.costCenterId ?? undefined,
            },
            {
              accountId: asset.assetCategory.accumulatedDepreciationAccountId,
              debit: 0,
              credit: round2(thisMonthDepreciation),
            },
          ],
        } as never,
        dto.systemUserId,
      );

      const entry = await this.prisma.depreciationEntry.create({
        data: {
          fixedAssetId: asset.id,
          periodDate: periodMonth,
          depreciationAmount: round2(thisMonthDepreciation),
          accumulatedDepreciation: round2(newAccumulated),
          netBookValue: round2(netBookValue),
          status: DepreciationEntryStatus.POSTED,
          journalEntryId: (posted as { id: string }).id,
          postedAt: new Date(),
        },
      });

      await this.prisma.fixedAsset.update({
        where: { id: asset.id },
        data: {
          lastDepreciatedThrough: periodMonth,
          status: netBookValue <= CENTS_TOLERANCE ? FixedAssetStatus.FULLY_DEPRECIATED : FixedAssetStatus.ACTIVE,
        },
      });

      results.push({ fixedAssetId: asset.id, depreciationEntry: entry });
    }

    return { periodMonth, assetsProcessed: assets.length, results };
  }

  private async getAccumulatedDepreciation(fixedAssetId: string): Promise<number> {
    const last = await this.prisma.depreciationEntry.findFirst({
      where: { fixedAssetId, status: DepreciationEntryStatus.POSTED },
      orderBy: { periodDate: 'desc' },
    });
    return last ? Number(last.accumulatedDepreciation) : 0;
  }

  // ---- Disposal ----

  async disposeAsset(fixedAssetId: string, dto: DisposeAssetDto) {
    const asset = await this.prisma.fixedAsset.findUnique({
      where: { id: fixedAssetId },
      include: { assetCategory: true, disposal: true },
    });
    if (!asset) throw new NotFoundException(`Fixed asset ${fixedAssetId} not found`);
    if (asset.status === FixedAssetStatus.DISPOSED || asset.disposal) {
      throw new ConflictException(`Fixed asset ${asset.assetTag} has already been disposed`);
    }

    const accumulatedDepreciation = await this.getAccumulatedDepreciation(asset.id);
    const netBookValueAtDisposal = Number(asset.acquisitionCost) - accumulatedDepreciation;
    const gainLoss = dto.disposalProceeds - netBookValueAtDisposal;

    const lines = [
      { accountId: asset.assetCategory.accumulatedDepreciationAccountId, debit: round2(accumulatedDepreciation), credit: 0 },
      { accountId: dto.disposalProceedsGlAccountId, debit: round2(dto.disposalProceeds), credit: 0 },
      { accountId: asset.assetCategory.assetAccountId, debit: 0, credit: round2(Number(asset.acquisitionCost)) },
    ];
    if (Math.abs(gainLoss) > CENTS_TOLERANCE) {
      if (gainLoss > 0) {
        lines.push({ accountId: dto.gainLossGlAccountId, debit: 0, credit: round2(gainLoss) });
      } else {
        lines.push({ accountId: dto.gainLossGlAccountId, debit: round2(Math.abs(gainLoss)), credit: 0 });
      }
    }

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: asset.entityId,
        entryDate: dto.disposalDate,
        description: `Disposal — ${asset.assetTag} / ${asset.name}`,
        sourceType: 'FIXED_ASSET',
        sourceReference: asset.id,
        lines,
      } as never,
      dto.disposedById,
    );

    const disposal = await this.prisma.assetDisposal.create({
      data: {
        fixedAssetId: asset.id,
        disposalDate: new Date(dto.disposalDate),
        disposalProceeds: round2(dto.disposalProceeds),
        netBookValueAtDisposal: round2(netBookValueAtDisposal),
        gainLoss: round2(gainLoss),
        journalEntryId: (posted as { id: string }).id,
        disposedById: dto.disposedById,
      },
    });

    await this.prisma.fixedAsset.update({
      where: { id: asset.id },
      data: { status: FixedAssetStatus.DISPOSED },
    });

    return disposal;
  }

  // ---- Dashboard / Reporting summary (reused by DashboardService, not re-queried there) ----

  async getFixedAssetSummary(entityId?: string) {
    const [byStatus, categories] = await Promise.all([
      this.prisma.fixedAsset.groupBy({
        by: ['status'],
        where: { entityId },
        _count: { _all: true },
        _sum: { acquisitionCost: true },
      }),
      this.prisma.assetCategory.count({ where: { isActive: true } }),
    ]);

    const activeAssets = await this.prisma.fixedAsset.findMany({
      where: { entityId, status: { in: [FixedAssetStatus.ACTIVE, FixedAssetStatus.FULLY_DEPRECIATED] } },
      select: { id: true, acquisitionCost: true },
    });

    let totalAccumulatedDepreciation = 0;
    for (const a of activeAssets) {
      totalAccumulatedDepreciation += await this.getAccumulatedDepreciation(a.id);
    }
    const totalAcquisitionCost = byStatus.reduce((sum, s) => sum + Number(s._sum.acquisitionCost ?? 0), 0);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        acquisitionCost: Number(s._sum.acquisitionCost ?? 0),
      })),
      categoriesCount: categories,
      totalAcquisitionCost: round2(totalAcquisitionCost),
      totalAccumulatedDepreciation: round2(totalAccumulatedDepreciation),
      totalNetBookValue: round2(totalAcquisitionCost - totalAccumulatedDepreciation),
    };
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
