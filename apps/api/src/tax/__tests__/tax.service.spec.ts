import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TaxRemittanceStatus } from '@prisma/client';
import { TaxService } from '../tax.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountsPayableService } from '../../accounts-payable/accounts-payable.service';

describe('TaxService', () => {
  let service: TaxService;
  let prisma: any;
  let ap: any;

  const whtRow = (overrides: Partial<any> = {}) => ({
    id: 'wht-1',
    entityId: 'ent-1',
    amount: 100,
    status: TaxRemittanceStatus.PENDING,
    taxAuthorityAccountId: 'acc-authority',
    createdAt: new Date('2026-03-15T00:00:00Z'),
    ...overrides,
  });

  const vatRow = (overrides: Partial<any> = {}) => ({
    id: 'vat-1',
    entityId: 'ent-1',
    amount: 50,
    status: TaxRemittanceStatus.PENDING,
    taxAuthorityAccountId: 'acc-authority-2',
    createdAt: new Date('2026-03-20T00:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      taxCode: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    };
    ap = {
      getWHTSchedule: jest.fn(),
      getVATSchedule: jest.fn(),
      remitWHT: jest.fn(),
      remitVAT: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsPayableService, useValue: ap },
      ],
    }).compile();

    service = moduleRef.get(TaxService);
  });

  describe('createTaxCode', () => {
    it('rejects a duplicate tax code', async () => {
      prisma.taxCode.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.createTaxCode({
          code: 'WHT-SERVICES-5',
          name: 'WHT Services 5%',
          taxType: 'WHT',
          rate: 0.05,
          taxAuthorityAccountId: 'acc-authority',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTaxPosition', () => {
    it('filters deductions to the requested period and sums pending vs remitted', async () => {
      ap.getWHTSchedule.mockResolvedValue([
        whtRow({ id: 'wht-in', amount: 100, createdAt: new Date('2026-03-15') }),
        whtRow({ id: 'wht-out', amount: 999, createdAt: new Date('2026-06-01') }), // outside period
        whtRow({ id: 'wht-remitted', amount: 40, status: TaxRemittanceStatus.REMITTED, createdAt: new Date('2026-03-18') }),
      ]);
      ap.getVATSchedule.mockResolvedValue([vatRow()]);

      const position = await service.getTaxPosition({
        entityId: 'ent-1',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
      });

      expect(position.wht.count).toBe(2); // wht-in + wht-remitted, wht-out excluded
      expect(position.wht.pendingAmount).toBeCloseTo(100, 2);
      expect(position.wht.remittedAmount).toBeCloseTo(40, 2);
      expect(position.vat.count).toBe(1);
      expect(position.vat.pendingAmount).toBeCloseTo(50, 2);
    });
  });

  describe('remitPeriod', () => {
    it('throws if there is nothing pending in the period', async () => {
      ap.getWHTSchedule.mockResolvedValue([]);
      ap.getVATSchedule.mockResolvedValue([]);
      await expect(
        service.remitPeriod(
          { entityId: 'ent-1', periodStart: '2026-03-01', periodEnd: '2026-03-31', taxType: 'WHT', cashGlAccountId: 'acc-bank' },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls AccountsPayableService.remitWHT for each pending deduction in period — no duplicate posting logic', async () => {
      const rows = [whtRow({ id: 'wht-a' }), whtRow({ id: 'wht-b' })];
      ap.getWHTSchedule.mockResolvedValue(rows); // used for both position + pending fetch
      ap.getVATSchedule.mockResolvedValue([]);
      ap.remitWHT.mockResolvedValue({ id: 'remitted' });

      const result = await service.remitPeriod(
        { entityId: 'ent-1', periodStart: '2026-03-01', periodEnd: '2026-03-31', taxType: 'WHT', cashGlAccountId: 'acc-bank' },
        'user-1',
      );

      expect(ap.remitWHT).toHaveBeenCalledTimes(2);
      expect(ap.remitWHT).toHaveBeenCalledWith('wht-a', { cashGlAccountId: 'acc-bank' }, 'user-1');
      expect(ap.remitVAT).not.toHaveBeenCalled();
      expect(result.remittedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it('collects per-deduction failures without aborting the whole batch', async () => {
      const rows = [whtRow({ id: 'wht-a' }), whtRow({ id: 'wht-b' })];
      ap.getWHTSchedule.mockResolvedValue(rows);
      ap.getVATSchedule.mockResolvedValue([]);
      ap.remitWHT
        .mockResolvedValueOnce({ id: 'remitted' })
        .mockRejectedValueOnce(new ConflictException('Already remitted'));

      const result = await service.remitPeriod(
        { entityId: 'ent-1', periodStart: '2026-03-01', periodEnd: '2026-03-31', taxType: 'WHT', cashGlAccountId: 'acc-bank' },
        'user-1',
      );

      expect(result.remittedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0].id).toBe('wht-b');
    });
  });
});
