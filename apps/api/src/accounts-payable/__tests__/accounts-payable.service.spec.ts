import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  PaymentBatchStatus,
  PaymentVoucherStatus,
  TaxRemittanceStatus,
  VendorInvoiceStatus,
} from '@prisma/client';
import { AccountsPayableService } from '../accounts-payable.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

function buildPrismaMock() {
  return {
    entity: { findUnique: jest.fn() },
    vendor: { findUnique: jest.fn() },
    vendorInvoice: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    vendorInvoiceLine: { findMany: jest.fn() },
    vendorLedger: { create: jest.fn(), findMany: jest.fn() },
    paymentBatch: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    paymentVoucher: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    wHTDeduction: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    vATDeduction: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    taxCode: { findMany: jest.fn() },
  };
}

function buildPostingEngineMock() {
  return { postSystemEntry: jest.fn() };
}

describe('AccountsPayableService', () => {
  let service: AccountsPayableService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let postingEngine: ReturnType<typeof buildPostingEngineMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    postingEngine = buildPostingEngineMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsPayableService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = moduleRef.get(AccountsPayableService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createInvoice', () => {
    it('rejects a duplicate invoice number for the same vendor', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.vendor.findUnique.mockResolvedValue({ id: 'v1', isActive: true });
      prisma.vendorInvoice.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createInvoice(
          { entityId: 'e1', vendorId: 'v1', invoiceNumber: 'INV-1', invoiceDate: '2026-01-01', lines: [{ description: 'Rent', accountId: 'a1', quantity: 1, unitCost: 100 }] } as any,
          'u1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('postInvoice', () => {
    it('rejects posting a PO-backed invoice (must go through Procurement)', async () => {
      prisma.vendorInvoice.findUnique.mockResolvedValue({
        id: 'vi1',
        purchaseOrderId: 'po1',
        status: VendorInvoiceStatus.DRAFT,
        lines: [],
      });
      await expect(service.postInvoice('vi1', { apControlAccountId: 'ap-acct' } as any, 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('posts Dr line accounts / Cr AP control and writes a VendorLedger INVOICE entry', async () => {
      prisma.vendorInvoice.findUnique.mockResolvedValue({
        id: 'vi1',
        entityId: 'e1',
        vendorId: 'v1',
        invoiceNumber: 'INV-1',
        invoiceDate: new Date('2026-01-01'),
        purchaseOrderId: null,
        status: VendorInvoiceStatus.DRAFT,
        lines: [{ accountId: 'rent-acct', quantity: 1, unitCost: 500 }],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je1' });
      prisma.vendorInvoice.update.mockResolvedValue({});
      prisma.vendorLedger.create.mockResolvedValue({});

      await service.postInvoice('vi1', { apControlAccountId: 'ap-acct' } as any, 'u1');

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'rent-acct', debit: 500, credit: 0 }),
          expect.objectContaining({ accountId: 'ap-acct', debit: 0, credit: 500 }),
        ]),
      );
      expect(prisma.vendorLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entryType: 'INVOICE', credit: 500 }) }),
      );
    });
  });

  describe('createPaymentVoucher', () => {
    it('rejects allocating more than an invoice open balance', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.vendorInvoice.findMany.mockResolvedValue([
        { id: 'vi1', vendorId: 'v1', status: VendorInvoiceStatus.POSTED, amountPaid: 0 },
      ]);
      prisma.vendorInvoiceLine.findMany.mockResolvedValue([{ quantity: 1, unitCost: 100 }]);

      await expect(
        service.createPaymentVoucher(
          {
            entityId: 'e1',
            voucherNumber: 'PV-1',
            vendorId: 'v1',
            paymentDate: '2026-02-01',
            paymentMethod: 'BANK_TRANSFER',
            bankAccountId: 'bank1',
            allocations: [{ vendorInvoiceId: 'vi1', amountAllocated: 500 }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves whtTaxCodeId/vatTaxCodeId to a rate + authority account (Tax Center Core follow-up)', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.vendorInvoice.findMany.mockResolvedValue([
        { id: 'vi1', vendorId: 'v1', status: VendorInvoiceStatus.POSTED, amountPaid: 0 },
      ]);
      prisma.vendorInvoiceLine.findMany.mockResolvedValue([{ quantity: 1, unitCost: 1000 }]);
      prisma.paymentVoucher.findUnique.mockResolvedValue(null);
      prisma.taxCode.findMany.mockResolvedValue([
        { id: 'tc-wht', rate: 0.05, taxAuthorityAccountId: 'wht-authority' },
      ]);
      prisma.paymentVoucher.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result: any = await service.createPaymentVoucher(
        {
          entityId: 'e1',
          voucherNumber: 'PV-2',
          vendorId: 'v1',
          paymentDate: '2026-03-01',
          paymentMethod: 'BANK_TRANSFER',
          bankAccountId: 'bank1',
          allocations: [{ vendorInvoiceId: 'vi1', amountAllocated: 500, whtTaxCodeId: 'tc-wht' }],
        } as any,
        'u1',
      );

      expect(prisma.taxCode.findMany).toHaveBeenCalledWith({ where: { id: { in: ['tc-wht'] } } });
      const allocationData = result.allocations.create[0];
      expect(allocationData.whtDeduction.create.rate).toBe(0.05);
      expect(allocationData.whtDeduction.create.amount).toBeCloseTo(25, 2); // 500 * 0.05
      expect(allocationData.whtDeduction.create.taxAuthorityAccountId).toBe('wht-authority');
    });

    it('rejects an unknown whtTaxCodeId instead of silently skipping the deduction', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.vendorInvoice.findMany.mockResolvedValue([
        { id: 'vi1', vendorId: 'v1', status: VendorInvoiceStatus.POSTED, amountPaid: 0 },
      ]);
      prisma.vendorInvoiceLine.findMany.mockResolvedValue([{ quantity: 1, unitCost: 1000 }]);
      prisma.paymentVoucher.findUnique.mockResolvedValue(null);
      prisma.taxCode.findMany.mockResolvedValue([]); // tc-missing not found

      await expect(
        service.createPaymentVoucher(
          {
            entityId: 'e1',
            voucherNumber: 'PV-3',
            vendorId: 'v1',
            paymentDate: '2026-03-01',
            paymentMethod: 'BANK_TRANSFER',
            bankAccountId: 'bank1',
            allocations: [{ vendorInvoiceId: 'vi1', amountAllocated: 500, whtTaxCodeId: 'tc-missing' }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('leaves the pre-existing manual whtRate/whtTaxAuthorityAccountId path untouched when no taxCodeId is given', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.vendorInvoice.findMany.mockResolvedValue([
        { id: 'vi1', vendorId: 'v1', status: VendorInvoiceStatus.POSTED, amountPaid: 0 },
      ]);
      prisma.vendorInvoiceLine.findMany.mockResolvedValue([{ quantity: 1, unitCost: 1000 }]);
      prisma.paymentVoucher.findUnique.mockResolvedValue(null);
      prisma.paymentVoucher.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result: any = await service.createPaymentVoucher(
        {
          entityId: 'e1',
          voucherNumber: 'PV-4',
          vendorId: 'v1',
          paymentDate: '2026-03-01',
          paymentMethod: 'BANK_TRANSFER',
          bankAccountId: 'bank1',
          allocations: [{ vendorInvoiceId: 'vi1', amountAllocated: 500, whtRate: 0.1, whtTaxAuthorityAccountId: 'manual-authority' }],
        } as any,
        'u1',
      );

      expect(prisma.taxCode.findMany).not.toHaveBeenCalled();
      const allocationData = result.allocations.create[0];
      expect(allocationData.whtDeduction.create.rate).toBe(0.1);
      expect(allocationData.whtDeduction.create.taxAuthorityAccountId).toBe('manual-authority');
    });
  });

  describe('postPaymentVoucher', () => {
    it('nets WHT/VAT off the cash credit while debiting AP control for the full gross amount', async () => {
      prisma.paymentVoucher.findUnique.mockResolvedValue({
        id: 'pv1',
        entityId: 'e1',
        vendorId: 'v1',
        voucherNumber: 'PV-1',
        paymentDate: new Date('2026-02-01'),
        status: PaymentVoucherStatus.APPROVED,
        allocations: [
          {
            vendorInvoiceId: 'vi1',
            amountAllocated: 1000,
            whtDeduction: { amount: 50, taxAuthorityAccountId: 'wht-payable' },
            vatDeduction: { amount: 75, taxAuthorityAccountId: 'vat-payable' },
          },
        ],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je2' });
      prisma.vendorInvoice.update.mockResolvedValue({});
      prisma.vendorLedger.create.mockResolvedValue({});
      prisma.paymentVoucher.update.mockResolvedValue({});

      const result = await service.postPaymentVoucher('pv1', { apControlAccountId: 'ap-acct', cashGlAccountId: 'cash-acct' } as any, 'u2');

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'ap-acct', debit: 1000, credit: 0 }),
          expect.objectContaining({ accountId: 'cash-acct', debit: 0, credit: 875 }),
          expect.objectContaining({ accountId: 'wht-payable', debit: 0, credit: 50 }),
          expect.objectContaining({ accountId: 'vat-payable', debit: 0, credit: 75 }),
        ]),
      );
      expect(result.totalNetCash).toBe(875);
    });

    it('rejects posting a voucher that is not APPROVED', async () => {
      prisma.paymentVoucher.findUnique.mockResolvedValue({ id: 'pv1', status: PaymentVoucherStatus.DRAFT, allocations: [] });
      await expect(
        service.postPaymentVoucher('pv1', { apControlAccountId: 'ap-acct', cashGlAccountId: 'cash-acct' } as any, 'u2'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approvePaymentBatch', () => {
    it('rejects the preparer approving their own batch', async () => {
      prisma.paymentBatch.findUnique.mockResolvedValue({ id: 'b1', status: PaymentBatchStatus.DRAFT, createdById: 'u1' });
      await expect(service.approvePaymentBatch('b1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remitWHT', () => {
    it('rejects remitting an already-remitted deduction', async () => {
      prisma.wHTDeduction.findUnique.mockResolvedValue({ id: 'wht1', status: TaxRemittanceStatus.REMITTED });
      await expect(service.remitWHT('wht1', { cashGlAccountId: 'cash-acct' } as any, 'u1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getVendorAging', () => {
    it('buckets open invoice balances by days past due', async () => {
      const asOf = new Date('2026-03-01');
      prisma.vendorInvoice.findMany.mockResolvedValue([
        {
          id: 'vi1',
          vendorId: 'v1',
          vendor: { name: 'Acme Supplies' },
          invoiceNumber: 'INV-1',
          dueDate: new Date('2026-01-01'), // 59 days overdue
          amountPaid: 200,
          lines: [{ quantity: 1, unitCost: 1000 }],
        },
      ]);

      const result = await service.getVendorAging('e1', asOf.toISOString());

      expect(result).toHaveLength(1);
      expect(result[0].openBalance).toBe(800);
      expect(result[0].bucket).toBe('31-60');
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('listInvoices scopes results to the caller\'s viewable entities', async () => {
      prisma.vendorInvoice.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.listInvoices(scope, {});

      expect(prisma.vendorInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ entityId: { in: ['ent-1'] } }, expect.any(Object)] },
        }),
      );
    });

    it('findInvoice 404s when the invoice entity is outside the caller\'s scope', async () => {
      prisma.vendorInvoice.findUnique.mockResolvedValue({ id: 'inv1', entityId: 'ent-2' });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await expect(service.findInvoice('inv1', scope)).rejects.toThrow(NotFoundException);
    });
  });
});
