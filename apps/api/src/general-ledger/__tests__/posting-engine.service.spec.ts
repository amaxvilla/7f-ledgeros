import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { JournalEntryStatus, PeriodStatus } from '@prisma/client';
import { PostingEngineService } from '../posting-engine.service';
import { PrismaService } from '../../prisma/prisma.service';

// A hand-rolled mock keeps these tests fast and independent of a live
// Postgres instance. Each test wires only the Prisma calls it needs.
function buildPrismaMock() {
  return {
    entity: { findUnique: jest.fn() },
    fiscalPeriod: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    entityAccount: { findMany: jest.fn() },
    journalEntry: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
}

describe('PostingEngineService', () => {
  let service: PostingEngineService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let events: EventEmitter2;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PostingEngineService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = moduleRef.get(PostingEngineService);
    events = moduleRef.get(EventEmitter2);
    jest.spyOn(events, 'emit');
  });

  afterEach(() => jest.clearAllMocks());

  describe('createDraft — balance validation', () => {
    const baseDto = {
      entityId: 'entity-1',
      entryDate: '2026-07-15',
      description: 'Test entry',
      lines: [
        { accountId: 'acc-cash', debit: 1000, credit: 0 },
        { accountId: 'acc-revenue', debit: 0, credit: 1000 },
      ],
    };

    it('rejects an unbalanced entry', async () => {
      const unbalanced = {
        ...baseDto,
        lines: [
          { accountId: 'acc-cash', debit: 1000, credit: 0 },
          { accountId: 'acc-revenue', debit: 0, credit: 900 },
        ],
      };

      await expect(service.createDraft(unbalanced as never, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.entity.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a line with both a debit and a credit', async () => {
      const invalid = {
        ...baseDto,
        lines: [
          { accountId: 'acc-cash', debit: 500, credit: 500 },
          { accountId: 'acc-revenue', debit: 0, credit: 0 },
        ],
      };

      await expect(service.createDraft(invalid as never, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an all-zero entry', async () => {
      const zero = {
        ...baseDto,
        lines: [
          { accountId: 'acc-cash', debit: 0, credit: 0 },
          { accountId: 'acc-revenue', debit: 0, credit: 0 },
        ],
      };
      await expect(service.createDraft(zero as never, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('accepts a balanced entry, resolves an open period, and validates account activation', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'entity-1', code: '7FC', isActive: true });
      prisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'period-1',
        name: '2026-07',
        status: PeriodStatus.OPEN,
      });
      prisma.entityAccount.findMany.mockResolvedValue([
        { accountId: 'acc-cash', account: { id: 'acc-cash', code: '1000', isPostable: true, isActive: true } },
        { accountId: 'acc-revenue', account: { id: 'acc-revenue', code: '4000', isPostable: true, isActive: true } },
      ]);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1', status: JournalEntryStatus.DRAFT });

      const result = await service.createDraft(baseDto as never, 'user-1');

      expect(result).toEqual({ id: 'je-1', status: JournalEntryStatus.DRAFT });
      expect(prisma.journalEntry.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.journalEntry.create.mock.calls[0][0];
      expect(createArgs.data.journalNumber).toMatch(/^DRAFT-/);
      expect(createArgs.data.status).toBe(JournalEntryStatus.DRAFT);
    });

    it('rejects posting to an account not activated for the entity', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'entity-1', code: '7FC', isActive: true });
      prisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'period-1',
        name: '2026-07',
        status: PeriodStatus.OPEN,
      });
      // Only one of the two accounts comes back as activated.
      prisma.entityAccount.findMany.mockResolvedValue([
        { accountId: 'acc-cash', account: { id: 'acc-cash', code: '1000', isPostable: true, isActive: true } },
      ]);

      await expect(service.createDraft(baseDto as never, 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('rejects drafting into a locked period', async () => {
      prisma.entity.findUnique.mockResolvedValue({ id: 'entity-1', code: '7FC', isActive: true });
      prisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'period-1',
        name: '2026-07',
        status: PeriodStatus.LOCKED,
      });

      await expect(service.createDraft(baseDto as never, 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('rejects self-approval by the preparer (maker/checker separation)', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'je-1',
        status: JournalEntryStatus.PENDING_APPROVAL,
        createdById: 'user-1',
      });

      await expect(service.approve('je-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
    });

    it('allows a different user to approve', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'je-1',
        status: JournalEntryStatus.PENDING_APPROVAL,
        createdById: 'user-1',
      });
      prisma.journalEntry.update.mockResolvedValue({ id: 'je-1', status: JournalEntryStatus.APPROVED });

      const result = await service.approve('je-1', 'user-2');
      expect(result.status).toBe(JournalEntryStatus.APPROVED);
    });

    it('rejects approving an entry not in PENDING_APPROVAL', async () => {
      prisma.journalEntry.findUnique.mockResolvedValue({
        id: 'je-1',
        status: JournalEntryStatus.DRAFT,
        createdById: 'user-1',
      });
      await expect(service.approve('je-1', 'user-2')).rejects.toThrow(ConflictException);
    });
  });

  describe('post', () => {
    it('assigns a sequential journal number and posts atomically', async () => {
      const txMock = {
        journalEntry: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'je-1',
            entityId: 'entity-1',
            entryDate: new Date('2026-07-15T00:00:00Z'),
            status: JournalEntryStatus.APPROVED,
            entity: { id: 'entity-1', code: '7FC' },
            fiscalPeriod: { id: 'period-1', name: '2026-07', status: PeriodStatus.OPEN },
            lines: [
              { debit: 1000, credit: 0 },
              { debit: 0, credit: 1000 },
            ],
          }),
          update: jest.fn().mockResolvedValue({
            id: 'je-1',
            journalNumber: '7FC-JE-2026-000001',
            status: JournalEntryStatus.POSTED,
            entityId: 'entity-1',
            lines: [],
          }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        $queryRaw: jest.fn().mockResolvedValue([{ lastNumber: 1 }]),
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      const result = await service.post('je-1', 'approver-1');

      expect(result.journalNumber).toBe('7FC-JE-2026-000001');
      expect(txMock.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ journalNumber: '7FC-JE-2026-000001', status: JournalEntryStatus.POSTED }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith('journal.posted', expect.anything());
    });

    it('refuses to post into a non-open period', async () => {
      const txMock = {
        journalEntry: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'je-1',
            entityId: 'entity-1',
            status: JournalEntryStatus.APPROVED,
            entity: { id: 'entity-1', code: '7FC' },
            fiscalPeriod: { id: 'period-1', name: '2026-06', status: PeriodStatus.LOCKED },
            lines: [],
          }),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      await expect(service.post('je-1', 'approver-1')).rejects.toThrow(ConflictException);
    });

    it('refuses to post an entry that is not APPROVED', async () => {
      const txMock = {
        journalEntry: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'je-1',
            status: JournalEntryStatus.DRAFT,
            entity: { id: 'entity-1', code: '7FC' },
            fiscalPeriod: { id: 'period-1', name: '2026-07', status: PeriodStatus.OPEN },
            lines: [],
          }),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      await expect(service.post('je-1', 'approver-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('lockPeriod', () => {
    it('refuses to lock a period with unposted entries', async () => {
      prisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'period-1',
        name: '2026-07',
        entityId: 'entity-1',
        journalEntries: [{ status: JournalEntryStatus.DRAFT }],
      });

      await expect(service.lockPeriod('period-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('locks a period once all entries are posted or resolved', async () => {
      prisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'period-1',
        name: '2026-07',
        entityId: 'entity-1',
        journalEntries: [{ status: JournalEntryStatus.POSTED }, { status: JournalEntryStatus.REJECTED }],
      });
      prisma.fiscalPeriod.update.mockResolvedValue({ id: 'period-1', status: PeriodStatus.LOCKED });

      const result = await service.lockPeriod('period-1', 'user-1');
      expect(result.status).toBe(PeriodStatus.LOCKED);
      expect(events.emit).toHaveBeenCalledWith('period.locked', expect.anything());
    });
  });
});
