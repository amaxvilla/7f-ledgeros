import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FixedAssetStatus } from '@prisma/client';
import { FixedAssetsService } from '../fixed-assets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';

describe('FixedAssetsService', () => {
  let service: FixedAssetsService;
  let prisma: any;
  let postingEngine: any;

  const category = {
    id: 'cat-1',
    name: 'IT Equipment',
    assetAccountId: 'acc-asset',
    accumulatedDepreciationAccountId: 'acc-accdepr',
    depreciationExpenseAccountId: 'acc-deprexp',
  };

  const asset = {
    id: 'fa-1',
    entityId: 'ent-1',
    assetCategoryId: 'cat-1',
    assetTag: 'IT-001',
    name: 'Laptop',
    acquisitionDate: new Date('2026-01-15T00:00:00Z'),
    acquisitionCost: 1200,
    residualValue: 0,
    usefulLifeYears: 5, // 60 months -> $20/month straight-line
    status: FixedAssetStatus.ACTIVE,
    departmentId: null,
    costCenterId: null,
    assetCategory: category,
  };

  beforeEach(async () => {
    prisma = {
      assetCategory: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
      fixedAsset: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      depreciationEntry: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      assetDisposal: { create: jest.fn() },
    };
    postingEngine = { postSystemEntry: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FixedAssetsService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = moduleRef.get(FixedAssetsService);
  });

  describe('createFixedAsset', () => {
    it('rejects an unknown asset category', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(null);
      await expect(
        service.createFixedAsset({
          entityId: 'ent-1',
          assetCategoryId: 'missing',
          assetTag: 'X-1',
          name: 'X',
          acquisitionDate: '2026-01-01',
          acquisitionCost: 100,
          usefulLifeYears: 3,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate asset tag within the same entity', async () => {
      prisma.assetCategory.findUnique.mockResolvedValue(category);
      prisma.fixedAsset.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.createFixedAsset({
          entityId: 'ent-1',
          assetCategoryId: 'cat-1',
          assetTag: 'IT-001',
          name: 'Laptop 2',
          acquisitionDate: '2026-01-01',
          acquisitionCost: 100,
          usefulLifeYears: 3,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('runDepreciation — straight-line monthly amount', () => {
    it('posts $20 for a $1200/5yr asset with no prior depreciation', async () => {
      prisma.fixedAsset.findMany.mockResolvedValue([asset]);
      prisma.depreciationEntry.findUnique.mockResolvedValue(null); // not yet posted this period
      prisma.depreciationEntry.findFirst.mockResolvedValue(null); // no prior accumulated depreciation
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-1' });
      prisma.depreciationEntry.create.mockImplementation(({ data }: any) => Promise.resolve(data));
      prisma.fixedAsset.update.mockResolvedValue({});

      const result = await service.runDepreciation({
        periodDate: '2026-02-15',
        entityId: 'ent-1',
        systemUserId: 'sys-1',
      });

      expect(result.assetsProcessed).toBe(1);
      const posted = postingEngine.postSystemEntry.mock.calls[0][0];
      const debitLine = posted.lines.find((l: any) => l.debit > 0);
      const creditLine = posted.lines.find((l: any) => l.credit > 0);
      expect(debitLine.debit).toBeCloseTo(20, 2);
      expect(debitLine.accountId).toBe('acc-deprexp');
      expect(creditLine.credit).toBeCloseTo(20, 2);
      expect(creditLine.accountId).toBe('acc-accdepr');
    });

    it('is idempotent — skips an asset already depreciated for that period', async () => {
      prisma.fixedAsset.findMany.mockResolvedValue([asset]);
      prisma.depreciationEntry.findUnique.mockResolvedValue({ id: 'existing-entry' });

      const result = await service.runDepreciation({
        periodDate: '2026-02-15',
        entityId: 'ent-1',
        systemUserId: 'sys-1',
      });

      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
      expect(result.results[0].skipped).toContain('already posted');
    });

    it('caps the final month at the remaining depreciable balance instead of overshooting', async () => {
      // 60 monthly periods of $20 = $1200 total; simulate month 60 where
      // only $15 of depreciable base remains due to prior rounding.
      prisma.fixedAsset.findMany.mockResolvedValue([asset]);
      prisma.depreciationEntry.findUnique.mockResolvedValue(null);
      prisma.depreciationEntry.findFirst.mockResolvedValue({ accumulatedDepreciation: 1185 }); // $15 left
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-60' });
      prisma.depreciationEntry.create.mockImplementation(({ data }: any) => Promise.resolve(data));
      prisma.fixedAsset.update.mockResolvedValue({});

      await service.runDepreciation({ periodDate: '2031-01-15', entityId: 'ent-1', systemUserId: 'sys-1' });

      const posted = postingEngine.postSystemEntry.mock.calls[0][0];
      const debitLine = posted.lines.find((l: any) => l.debit > 0);
      expect(debitLine.debit).toBeCloseTo(15, 2);

      const updateCall = prisma.fixedAsset.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(FixedAssetStatus.FULLY_DEPRECIATED);
    });

    it('marks an already fully-depreciated asset as such without posting again', async () => {
      prisma.fixedAsset.findMany.mockResolvedValue([asset]);
      prisma.depreciationEntry.findUnique.mockResolvedValue(null);
      prisma.depreciationEntry.findFirst.mockResolvedValue({ accumulatedDepreciation: 1200 }); // fully depreciated
      prisma.fixedAsset.update.mockResolvedValue({});

      const result = await service.runDepreciation({ periodDate: '2031-02-15', entityId: 'ent-1', systemUserId: 'sys-1' });

      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
      expect(result.results[0].skipped).toContain('fully depreciated');
    });
  });

  describe('disposeAsset', () => {
    it('rejects disposing an asset that was already disposed', async () => {
      prisma.fixedAsset.findUnique.mockResolvedValue({ ...asset, status: FixedAssetStatus.DISPOSED, disposal: { id: 'd-1' } });
      await expect(
        service.disposeAsset('fa-1', {
          disposalDate: '2026-06-01',
          disposalProceeds: 500,
          disposalProceedsGlAccountId: 'acc-bank',
          gainLossGlAccountId: 'acc-gainloss',
          disposedById: 'u1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('books a gain when proceeds exceed net book value, and balances the journal', async () => {
      prisma.fixedAsset.findUnique.mockResolvedValue({ ...asset, disposal: null });
      prisma.depreciationEntry.findFirst.mockResolvedValue({ accumulatedDepreciation: 800 }); // NBV = 400
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-disposal' });
      prisma.assetDisposal.create.mockImplementation(({ data }: any) => Promise.resolve(data));
      prisma.fixedAsset.update.mockResolvedValue({});

      const disposal = await service.disposeAsset('fa-1', {
        disposalDate: '2026-06-01',
        disposalProceeds: 500, // NBV 400 -> gain of 100
        disposalProceedsGlAccountId: 'acc-bank',
        gainLossGlAccountId: 'acc-gainloss',
        disposedById: 'u1',
      });

      expect(disposal.gainLoss).toBeCloseTo(100, 2);

      const posted = postingEngine.postSystemEntry.mock.calls[0][0];
      const totalDebits = posted.lines.reduce((sum: number, l: any) => sum + l.debit, 0);
      const totalCredits = posted.lines.reduce((sum: number, l: any) => sum + l.credit, 0);
      expect(totalDebits).toBeCloseTo(totalCredits, 2);

      const gainLine = posted.lines.find((l: any) => l.accountId === 'acc-gainloss');
      expect(gainLine.credit).toBeCloseTo(100, 2); // gain is a credit
    });

    it('books a loss when proceeds are below net book value, and balances the journal', async () => {
      prisma.fixedAsset.findUnique.mockResolvedValue({ ...asset, disposal: null });
      prisma.depreciationEntry.findFirst.mockResolvedValue({ accumulatedDepreciation: 800 }); // NBV = 400
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-disposal-2' });
      prisma.assetDisposal.create.mockImplementation(({ data }: any) => Promise.resolve(data));
      prisma.fixedAsset.update.mockResolvedValue({});

      const disposal = await service.disposeAsset('fa-1', {
        disposalDate: '2026-06-01',
        disposalProceeds: 100, // NBV 400 -> loss of 300
        disposalProceedsGlAccountId: 'acc-bank',
        gainLossGlAccountId: 'acc-gainloss',
        disposedById: 'u1',
      });

      expect(disposal.gainLoss).toBeCloseTo(-300, 2);

      const posted = postingEngine.postSystemEntry.mock.calls[0][0];
      const totalDebits = posted.lines.reduce((sum: number, l: any) => sum + l.debit, 0);
      const totalCredits = posted.lines.reduce((sum: number, l: any) => sum + l.credit, 0);
      expect(totalDebits).toBeCloseTo(totalCredits, 2);

      const lossLine = posted.lines.find((l: any) => l.accountId === 'acc-gainloss');
      expect(lossLine.debit).toBeCloseTo(300, 2); // loss is a debit
    });
  });
});
