import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ARInvoiceStatus, ReceiptStatus } from '@prisma/client';
import { AccountsReceivableService } from '../accounts-receivable.service';
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
    customer: { findUnique: jest.fn() },
    aRInvoice: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    receipt: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    customerLedger: { create: jest.fn(), findMany: jest.fn() },
    installmentLine: { findMany: jest.fn() },
    taxCode: { findMany: jest.fn() },
  };
}

describe('AccountsReceivableService', () => {
  let service: AccountsReceivableService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let postingEngine: { postSystemEntry: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    postingEngine = { postSystemEntry: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsReceivableService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = moduleRef.get(AccountsReceivableService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createInvoice — Release L: Output VAT on AR Invoices', () => {
    it('resolves vatTaxCodeId to a rate + authority account and snapshots vatAmount onto the line', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.aRInvoice.findUnique.mockResolvedValue(null);
      prisma.taxCode.findMany.mockResolvedValue([
        { id: 'tc-vat', code: 'VAT-STD', taxType: 'VAT', rate: 0.075, taxAuthorityAccountId: 'vat-authority' },
      ]);
      prisma.aRInvoice.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result: any = await service.createInvoice(
        {
          entityId: 'e1',
          invoiceNumber: 'ARI-VAT-1',
          customerId: 'c1',
          invoiceDate: '2026-03-01',
          lines: [{ description: 'Consulting', accountId: 'revenue-acct', quantity: 1, unitPrice: 1000, vatTaxCodeId: 'tc-vat' }],
        } as any,
        'u1',
      );

      expect(prisma.taxCode.findMany).toHaveBeenCalledWith({ where: { id: { in: ['tc-vat'] } } });
      const lineData = result.lines.create[0];
      expect(lineData.vatRate).toBe(0.075);
      expect(lineData.vatAmount).toBeCloseTo(75, 2); // 1000 * 0.075
      expect(lineData.vatAuthorityAccountId).toBe('vat-authority');
    });

    it('rejects an unknown vatTaxCodeId', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.aRInvoice.findUnique.mockResolvedValue(null);
      prisma.taxCode.findMany.mockResolvedValue([]);

      await expect(
        service.createInvoice(
          {
            entityId: 'e1',
            invoiceNumber: 'ARI-VAT-2',
            customerId: 'c1',
            invoiceDate: '2026-03-01',
            lines: [{ description: 'X', accountId: 'revenue-acct', quantity: 1, unitPrice: 1000, vatTaxCodeId: 'missing' }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a tax code that is not a VAT type (e.g. a WHT code used by mistake)', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.aRInvoice.findUnique.mockResolvedValue(null);
      prisma.taxCode.findMany.mockResolvedValue([
        { id: 'tc-wht', code: 'WHT-SERVICES-5', taxType: 'WHT', rate: 0.05, taxAuthorityAccountId: 'wht-authority' },
      ]);

      await expect(
        service.createInvoice(
          {
            entityId: 'e1',
            invoiceNumber: 'ARI-VAT-3',
            customerId: 'c1',
            invoiceDate: '2026-03-01',
            lines: [{ description: 'X', accountId: 'revenue-acct', quantity: 1, unitPrice: 1000, vatTaxCodeId: 'tc-wht' }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves a line with no vatTaxCodeId completely untouched (existing behavior)', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.aRInvoice.findUnique.mockResolvedValue(null);
      prisma.aRInvoice.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result: any = await service.createInvoice(
        {
          entityId: 'e1',
          invoiceNumber: 'ARI-NOVAT',
          customerId: 'c1',
          invoiceDate: '2026-03-01',
          lines: [{ description: 'X', accountId: 'revenue-acct', quantity: 1, unitPrice: 1000 }],
        } as any,
        'u1',
      );

      expect(prisma.taxCode.findMany).not.toHaveBeenCalled();
      const lineData = result.lines.create[0];
      expect(lineData.vatRate).toBeUndefined();
      expect(lineData.vatAmount).toBeUndefined();
      expect(lineData.vatAuthorityAccountId).toBeUndefined();
    });
  });

  describe('postInvoice', () => {
    it('posts Dr AR control / Cr revenue lines and writes a CustomerLedger INVOICE entry', async () => {
      prisma.aRInvoice.findUnique.mockResolvedValue({
        id: 'ai1',
        entityId: 'e1',
        customerId: 'c1',
        invoiceNumber: 'ARI-1',
        invoiceDate: new Date('2026-02-01'),
        status: ARInvoiceStatus.DRAFT,
        lines: [{ accountId: 'revenue-acct', quantity: 1, unitPrice: 2000, projectId: null, phaseId: null }],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je1' });
      prisma.aRInvoice.update.mockResolvedValue({});
      prisma.customerLedger.create.mockResolvedValue({});

      await service.postInvoice('ai1', { arControlAccountId: 'ar-acct' } as any, 'u1');

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'ar-acct', debit: 2000, credit: 0 }),
          expect.objectContaining({ accountId: 'revenue-acct', debit: 0, credit: 2000 }),
        ]),
      );
      expect(prisma.customerLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entryType: 'INVOICE', debit: 2000 }) }),
      );
    });

    it('Release L: posts a VAT-inclusive AR control debit + a separate VAT-authority credit line, and the journal balances', async () => {
      prisma.aRInvoice.findUnique.mockResolvedValue({
        id: 'ai2',
        entityId: 'e1',
        customerId: 'c1',
        invoiceNumber: 'ARI-VAT-1',
        invoiceDate: new Date('2026-03-01'),
        status: ARInvoiceStatus.DRAFT,
        lines: [
          {
            accountId: 'revenue-acct',
            quantity: 1,
            unitPrice: 1000,
            projectId: null,
            phaseId: null,
            vatRate: 0.075,
            vatAmount: 75,
            vatAuthorityAccountId: 'vat-authority',
          },
        ],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-vat' });
      prisma.aRInvoice.update.mockResolvedValue({});
      prisma.customerLedger.create.mockResolvedValue({});

      await service.postInvoice('ai2', { arControlAccountId: 'ar-acct' } as any, 'u1');

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'ar-acct', debit: 1075, credit: 0 }), // subtotal + VAT
          expect.objectContaining({ accountId: 'revenue-acct', debit: 0, credit: 1000 }), // revenue ex-VAT
          expect.objectContaining({ accountId: 'vat-authority', debit: 0, credit: 75 }), // VAT payable
        ]),
      );
      const totalDebits = call.lines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredits = call.lines.reduce((s: number, l: any) => s + l.credit, 0);
      expect(totalDebits).toBeCloseTo(totalCredits, 2);

      expect(prisma.customerLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ debit: 1075 }) }), // customer owes incl. VAT
      );
    });
  });

  describe('createReceipt', () => {
    it('rejects allocating more than an invoice open balance', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.aRInvoice.findMany.mockResolvedValue([
        {
          id: 'ai1',
          customerId: 'c1',
          status: ARInvoiceStatus.POSTED,
          amountReceived: 0,
          lines: [{ quantity: 1, unitPrice: 1000 }],
        },
      ]);

      await expect(
        service.createReceipt(
          {
            entityId: 'e1',
            receiptNumber: 'RCT-1',
            customerId: 'c1',
            receiptDate: '2026-02-10',
            paymentMethod: 'BANK_TRANSFER',
            bankAccountId: 'bank1',
            allocations: [{ arInvoiceId: 'ai1', amountAllocated: 5000 }],
          } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Release L: includes VAT in the open-balance check, so a VAT-inclusive payment is accepted', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'e1', isActive: true });
      prisma.aRInvoice.findMany.mockResolvedValue([
        {
          id: 'ai1',
          customerId: 'c1',
          status: ARInvoiceStatus.POSTED,
          amountReceived: 0,
          lines: [{ quantity: 1, unitPrice: 1000, vatAmount: 75 }], // open = 1075, not 1000
        },
      ]);
      prisma.receipt.findUnique.mockResolvedValue(null);
      prisma.receipt.create.mockResolvedValue({});

      // Would have been rejected as "exceeds open balance" under the
      // pre-VAT total of 1000; must succeed once VAT is included.
      await expect(
        service.createReceipt(
          {
            entityId: 'e1',
            receiptNumber: 'RCT-VAT-1',
            customerId: 'c1',
            receiptDate: '2026-03-10',
            paymentMethod: 'BANK_TRANSFER',
            bankAccountId: 'bank1',
            allocations: [{ arInvoiceId: 'ai1', amountAllocated: 1075 }],
          } as any,
          'u1',
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('postReceipt', () => {
    it('posts Dr Cash / Cr AR control for the total allocated amount', async () => {
      prisma.receipt.findUnique.mockResolvedValue({
        id: 'r1',
        entityId: 'e1',
        customerId: 'c1',
        receiptNumber: 'RCT-1',
        receiptDate: new Date('2026-02-10'),
        status: ReceiptStatus.DRAFT,
        allocations: [{ arInvoiceId: 'ai1', amountAllocated: 500 }],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je2' });
      prisma.aRInvoice.update.mockResolvedValue({});
      prisma.customerLedger.create.mockResolvedValue({});
      prisma.receipt.update.mockResolvedValue({});

      const result = await service.postReceipt('r1', { arControlAccountId: 'ar-acct', cashGlAccountId: 'cash-acct' } as any, 'u2');

      const call = postingEngine.postSystemEntry.mock.calls[0][0];
      expect(call.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ accountId: 'cash-acct', debit: 500, credit: 0 }),
          expect.objectContaining({ accountId: 'ar-acct', debit: 0, credit: 500 }),
        ]),
      );
      expect(result.total).toBe(500);
    });

    it('rejects posting a receipt that is not DRAFT', async () => {
      prisma.receipt.findUnique.mockResolvedValue({ id: 'r1', status: ReceiptStatus.POSTED, allocations: [] });
      await expect(
        service.postReceipt('r1', { arControlAccountId: 'ar-acct', cashGlAccountId: 'cash-acct' } as any, 'u2'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getAging', () => {
    it('buckets open invoice balances by days past due', async () => {
      prisma.aRInvoice.findMany.mockResolvedValue([
        {
          id: 'ai1',
          customerId: 'c1',
          customer: { name: 'Jane Doe' },
          invoiceNumber: 'ARI-1',
          dueDate: new Date('2026-01-01'),
          amountReceived: 0,
          lines: [{ quantity: 1, unitPrice: 1000 }],
        },
      ]);

      const result = await service.getAging('e1', '2026-01-15T00:00:00.000Z');
      expect(result[0].bucket).toBe('1-30');
      expect(result[0].openBalance).toBe(1000);
    });

    it('Release L: includes VAT in the open balance', async () => {
      prisma.aRInvoice.findMany.mockResolvedValue([
        {
          id: 'ai2',
          customerId: 'c1',
          customer: { name: 'Jane Doe' },
          invoiceNumber: 'ARI-VAT-1',
          dueDate: new Date('2026-01-01'),
          amountReceived: 0,
          lines: [{ quantity: 1, unitPrice: 1000, vatAmount: 75 }],
        },
      ]);

      const result = await service.getAging('e1', '2026-01-15T00:00:00.000Z');
      expect(result[0].openBalance).toBe(1075);
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('listInvoices scopes results to the caller\'s viewable entities', async () => {
      prisma.aRInvoice.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.listInvoices(scope, {});

      expect(prisma.aRInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ entityId: { in: ['ent-1'] } }, expect.any(Object)] },
        }),
      );
    });

    it('findInvoice 404s when the invoice entity is outside the caller\'s scope', async () => {
      prisma.aRInvoice.findUnique.mockResolvedValue({ id: 'ai1', entityId: 'ent-2' });
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await expect(service.findInvoice('ai1', scope)).rejects.toThrow('AR invoice ai1 not found');
    });
  });
});
