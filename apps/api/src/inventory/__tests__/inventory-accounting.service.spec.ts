import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryAccountingService } from '../accounting/inventory-accounting.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';
import { InventoryAccountConfiguration } from '../accounting/inventory-accounting.types';

function buildPrismaMock() {
  return {
    inventoryAccountingConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
    entityAccount: {
      findMany: jest.fn(),
    },
  };
}

function buildPostingEngineMock() {
  return {
    postSystemEntry: jest.fn(),
    postSystemEntryInTransaction: jest.fn(),
  };
}

function buildTransactionMock(prisma: ReturnType<typeof buildPrismaMock>) {
  return {
    inventoryAccountingConfig: prisma.inventoryAccountingConfig,
    account: prisma.account,
    entityAccount: prisma.entityAccount,
  } as unknown as Prisma.TransactionClient;
}

describe('InventoryAccountingService', () => {
  let service: InventoryAccountingService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let postingEngine: ReturnType<typeof buildPostingEngineMock>;

  const config: InventoryAccountConfiguration = {
    entityId: 'entity-1',
    inventoryAssetAccountId: 'acc-inventory',
    grniAccountId: 'acc-grni',
    cogsAccountId: 'acc-cogs',
    inventoryGainAccountId: 'acc-gain',
    inventoryLossAccountId: 'acc-loss',
    isActive: true,
  };

  const context = {
    entityId: 'entity-1',
    sourceType: 'INVENTORY',
    sourceId: 'source-1',
    postingDate: '2026-08-20',
    currency: 'NGN',
    description: 'Inventory accounting test',
  };

  const postedJournal = {
    id: 'je-1',
    lines: [],
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    postingEngine = buildPostingEngineMock();

    prisma.inventoryAccountingConfig.findUnique.mockResolvedValue(config);

    prisma.account.findMany.mockResolvedValue([
      { id: 'acc-inventory' },
      { id: 'acc-grni' },
      { id: 'acc-cogs' },
      { id: 'acc-gain' },
      { id: 'acc-loss' },
    ]);

    prisma.entityAccount.findMany.mockResolvedValue([
      { accountId: 'acc-inventory' },
      { accountId: 'acc-grni' },
      { accountId: 'acc-cogs' },
      { accountId: 'acc-gain' },
      { accountId: 'acc-loss' },
    ]);

    postingEngine.postSystemEntry.mockResolvedValue(postedJournal);
    postingEngine.postSystemEntryInTransaction.mockResolvedValue(postedJournal);

    service = new InventoryAccountingService(
      prisma as unknown as PrismaService,
      postingEngine as unknown as PostingEngineService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postInventoryEvent', () => {
    it('posts RECEIPT as inventory asset debit and GRNI credit', async () => {
      const result = await service.postInventoryEvent(
        'RECEIPT',
        context,
        125000,
        'system-user-1',
      );

      expect(result).toEqual({
        journalEntryId: 'je-1',
        totalDebit: 125000,
        totalCredit: 125000,
        balanced: true,
      });

      expect(postingEngine.postSystemEntry).toHaveBeenCalledTimes(1);

      const [dto, systemUserId] = postingEngine.postSystemEntry.mock.calls[0];

      expect(systemUserId).toBe('system-user-1');
      expect(dto.entityId).toBe('entity-1');
      expect(dto.sourceType).toBe('INVENTORY');
      expect(dto.sourceReference).toBe('source-1');
      expect(dto.description).toBe('Inventory accounting test');

      expect(dto.lines).toEqual([
        {
          accountId: 'acc-inventory',
          debit: 125000,
          credit: 0,
          memo: 'Inventory receipt',
        },
        {
          accountId: 'acc-grni',
          debit: 0,
          credit: 125000,
          memo: 'GRNI accrual',
        },
      ]);
    });

    it('posts ISSUE as COGS debit and inventory asset credit', async () => {
      await service.postInventoryEvent(
        'ISSUE',
        context,
        50000,
        'system-user-1',
      );

      const [dto] = postingEngine.postSystemEntry.mock.calls[0];

      expect(dto.lines).toEqual([
        {
          accountId: 'acc-cogs',
          debit: 50000,
          credit: 0,
          memo: 'Weighted-average COGS',
        },
        {
          accountId: 'acc-inventory',
          debit: 0,
          credit: 50000,
          memo: 'Inventory issue',
        },
      ]);
    });

    it('posts COUNT_VARIANCE as inventory gain', async () => {
      await service.postInventoryEvent(
        'COUNT_VARIANCE',
        context,
        7500,
        'system-user-1',
      );

      const [dto] = postingEngine.postSystemEntry.mock.calls[0];

      expect(dto.lines).toEqual([
        {
          accountId: 'acc-inventory',
          debit: 7500,
          credit: 0,
          memo: 'Inventory count gain',
        },
        {
          accountId: 'acc-gain',
          debit: 0,
          credit: 7500,
          memo: 'Inventory gain',
        },
      ]);
    });

    it('posts ADJUSTMENT as inventory loss debit and inventory asset credit', async () => {
      await service.postInventoryEvent(
        'ADJUSTMENT',
        context,
        9000,
        'system-user-1',
      );

      const [dto] = postingEngine.postSystemEntry.mock.calls[0];

      expect(dto.lines).toEqual([
        {
          accountId: 'acc-loss',
          debit: 9000,
          credit: 0,
          memo: 'Inventory adjustment loss',
        },
        {
          accountId: 'acc-inventory',
          debit: 0,
          credit: 9000,
          memo: 'Inventory adjustment',
        },
      ]);
    });

    it('posts VENDOR_INVOICE_CLEAR_GRNI as GRNI debit and inventory asset credit', async () => {
      await service.postInventoryEvent(
        'VENDOR_INVOICE_CLEAR_GRNI',
        context,
        33000,
        'system-user-1',
      );

      const [dto] = postingEngine.postSystemEntry.mock.calls[0];

      expect(dto.lines).toEqual([
        {
          accountId: 'acc-grni',
          debit: 33000,
          credit: 0,
          memo: 'Clear GRNI',
        },
        {
          accountId: 'acc-inventory',
          debit: 0,
          credit: 33000,
          memo: 'Inventory invoice clearing',
        },
      ]);
    });

    it('does not post TRANSFER because transfer accounting is intentionally delegated', async () => {
      const result = await service.postInventoryEvent(
        'TRANSFER',
        context,
        45000,
        'system-user-1',
      );

      expect(result).toBeNull();
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
      expect(postingEngine.postSystemEntryInTransaction).not.toHaveBeenCalled();
    });

    it('returns null for a zero inventory value without resolving configuration', async () => {
      const result = await service.postInventoryEvent(
        'RECEIPT',
        context,
        0,
        'system-user-1',
      );

      expect(result).toBeNull();
      expect(prisma.inventoryAccountingConfig.findUnique).not.toHaveBeenCalled();
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('returns null for a negative inventory value without resolving configuration', async () => {
      const result = await service.postInventoryEvent(
        'ISSUE',
        context,
        -100,
        'system-user-1',
      );

      expect(result).toBeNull();
      expect(prisma.inventoryAccountingConfig.findUnique).not.toHaveBeenCalled();
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('returns null for a non-finite inventory value', async () => {
      const result = await service.postInventoryEvent(
        'RECEIPT',
        context,
        Number.NaN,
        'system-user-1',
      );

      expect(result).toBeNull();
      expect(prisma.inventoryAccountingConfig.findUnique).not.toHaveBeenCalled();
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('rejects incomplete source context', async () => {
      await expect(
        service.postInventoryEvent(
          'RECEIPT',
          {
            ...context,
            sourceId: '',
          },
          1000,
          'system-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('rejects inactive accounting configuration', async () => {
      prisma.inventoryAccountingConfig.findUnique.mockResolvedValue({
        ...config,
        isActive: false,
      });

      await expect(
        service.postInventoryEvent(
          'RECEIPT',
          context,
          1000,
          'system-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('rejects an inventory configuration containing inactive or invalid accounts', async () => {
      prisma.account.findMany.mockResolvedValue([
        { id: 'acc-inventory' },
        { id: 'acc-grni' },
        { id: 'acc-cogs' },
        { id: 'acc-gain' },
      ]);

      await expect(
        service.postInventoryEvent(
          'RECEIPT',
          context,
          1000,
          'system-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('rejects an inventory account that is not activated for the entity', async () => {
      prisma.entityAccount.findMany.mockResolvedValue([
        { accountId: 'acc-inventory' },
        { accountId: 'acc-grni' },
        { accountId: 'acc-cogs' },
        { accountId: 'acc-gain' },
      ]);

      await expect(
        service.postInventoryEvent(
          'RECEIPT',
          context,
          1000,
          'system-user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();
    });

    it('uses the transaction-aware posting engine when a transaction client is supplied', async () => {
      const tx = buildTransactionMock(prisma);

      const result = await service.postInventoryEvent(
        'RECEIPT',
        context,
        15000,
        'system-user-1',
        tx,
      );

      expect(result).toEqual({
        journalEntryId: 'je-1',
        totalDebit: 15000,
        totalCredit: 15000,
        balanced: true,
      });

      expect(postingEngine.postSystemEntryInTransaction).toHaveBeenCalledTimes(1);
      expect(postingEngine.postSystemEntry).not.toHaveBeenCalled();

      const [txArg, dto, systemUserId] =
        postingEngine.postSystemEntryInTransaction.mock.calls[0];

      expect(txArg).toBe(tx);
      expect(systemUserId).toBe('system-user-1');
      expect(dto.lines).toEqual([
        {
          accountId: 'acc-inventory',
          debit: 15000,
          credit: 0,
          memo: 'Inventory receipt',
        },
        {
          accountId: 'acc-grni',
          debit: 0,
          credit: 15000,
          memo: 'GRNI accrual',
        },
      ]);
    });
  });
});




