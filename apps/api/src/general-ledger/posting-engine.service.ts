import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { JournalEntryStatus, PeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import {
  JournalPostedEvent,
  JournalReversedEvent,
  PeriodLockedEvent,
} from './events/general-ledger.events';

const CENTS_TOLERANCE = 0.005; // guards against floating point drift on decimal math

@Injectable()
export class PostingEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // -------------------------------------------------------------------
  // DRAFT CREATION
  // -------------------------------------------------------------------

  async createDraft(dto: CreateJournalEntryDto, userId: string, tx?: Prisma.TransactionClient) {
    this.assertBalanced(dto.lines);
    this.assertNoZeroLines(dto.lines);

    const client = (tx ?? this.prisma) as unknown as PrismaService;

    const entity = await client.entity.findUnique({ where: { id: dto.entityId } });
    if (!entity || !entity.isActive) {
      throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);
    }

    const fiscalPeriod = await this.getOrCreateFiscalPeriod(dto.entityId, new Date(dto.entryDate), tx);
    if (fiscalPeriod.status === PeriodStatus.LOCKED) {
      throw new ConflictException(
        `Fiscal period ${fiscalPeriod.name} is locked for entity ${entity.code}`,
      );
    }

    await this.assertLinesPostable(dto.entityId, dto.lines, tx);

    const draftNumber = `DRAFT-${randomUUID()}`;

    return client.journalEntry.create({
      data: {
        journalNumber: draftNumber,
        entityId: dto.entityId,
        fiscalPeriodId: fiscalPeriod.id,
        entryDate: new Date(dto.entryDate),
        description: dto.description,
        sourceType: dto.sourceType ?? 'MANUAL',
        sourceReference: dto.sourceReference,
        status: JournalEntryStatus.DRAFT,
        createdById: userId,
        lines: {
          create: dto.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
            entityId: dto.entityId,
            projectId: line.projectId,
            phaseId: line.phaseId,
            blockId: line.blockId,
            floorId: line.floorId,
            unitId: line.unitId,
            departmentId: line.departmentId,
            costCenterId: line.costCenterId,
            fundingSourceId: line.fundingSourceId,
            vendorId: line.vendorId,
            customerId: line.customerId,
          })),
        },
      },
      include: { lines: true },
    });
  }

  // -------------------------------------------------------------------
  // WORKFLOW: DRAFT -> PENDING_APPROVAL -> APPROVED -> POSTED
  // -------------------------------------------------------------------

  async submitForApproval(journalEntryId: string) {
    const entry = await this.getEntryOrThrow(journalEntryId);
    this.assertStatus(entry.status, [JournalEntryStatus.DRAFT], 'submit for approval');

    return this.prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: { status: JournalEntryStatus.PENDING_APPROVAL },
    });
  }

  async approve(journalEntryId: string, approverId: string) {
    const entry = await this.getEntryOrThrow(journalEntryId);
    this.assertStatus(entry.status, [JournalEntryStatus.PENDING_APPROVAL], 'approve');

    if (entry.createdById === approverId) {
      throw new BadRequestException('The preparer of a journal entry cannot also approve it');
    }

    return this.prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: {
        status: JournalEntryStatus.APPROVED,
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });
  }

  async reject(journalEntryId: string) {
    const entry = await this.getEntryOrThrow(journalEntryId);
    this.assertStatus(
      entry.status,
      [JournalEntryStatus.PENDING_APPROVAL],
      'reject',
    );
    return this.prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: { status: JournalEntryStatus.REJECTED },
    });
  }

  /**
   * The heart of the kernel: atomically validates, numbers, and posts a
   * journal entry. Everything happens inside a single DB transaction so a
   * failure at any step leaves no partial state.
   */
  async post(journalEntryId: string, postedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: { lines: true, entity: true, fiscalPeriod: true },
      });
      if (!entry) throw new NotFoundException(`Journal entry ${journalEntryId} not found`);

      this.assertStatus(entry.status, [JournalEntryStatus.APPROVED], 'post');

      if (entry.fiscalPeriod.status !== PeriodStatus.OPEN) {
        throw new ConflictException(
          `Cannot post into fiscal period ${entry.fiscalPeriod.name}: period is ${entry.fiscalPeriod.status}`,
        );
      }

      const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
      if (Math.abs(totalDebit - totalCredit) > CENTS_TOLERANCE) {
        throw new BadRequestException(
          `Entry is not balanced at posting time: debit ${totalDebit} vs credit ${totalCredit}`,
        );
      }

      const fiscalYear = entry.entryDate.getUTCFullYear();
      const sequenceRows = await tx.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO journal_number_sequences ("entityId", "fiscalYear", "lastNumber")
        VALUES (${entry.entityId}, ${fiscalYear}, 1)
        ON CONFLICT ("entityId", "fiscalYear")
        DO UPDATE SET "lastNumber" = journal_number_sequences."lastNumber" + 1
        RETURNING "lastNumber"
      `;
      const sequenceNumber = sequenceRows[0].lastNumber;
      const journalNumber = `${entry.entity.code}-JE-${fiscalYear}-${String(sequenceNumber).padStart(6, '0')}`;

      const posted = await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: {
          journalNumber,
          status: JournalEntryStatus.POSTED,
          postedById,
          postedAt: new Date(),
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId: postedById,
          action: 'JOURNAL_POSTED',
          entityType: 'JournalEntry',
          entityId: posted.id,
          afterState: { journalNumber, totalDebit, totalCredit, lineCount: posted.lines.length },
        },
      });

      this.events.emit(
        JournalPostedEvent.eventName,
        new JournalPostedEvent(posted.id, journalNumber, posted.entityId),
      );

      return posted;
    });
  }

  // -------------------------------------------------------------------
  // REVERSAL
  // -------------------------------------------------------------------

  async reverse(journalEntryId: string, userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.journalEntry.findUnique({
        where: { id: journalEntryId },
        include: { lines: true, entity: true, fiscalPeriod: true },
      });
      if (!original) throw new NotFoundException(`Journal entry ${journalEntryId} not found`);
      this.assertStatus(original.status, [JournalEntryStatus.POSTED], 'reverse');

      const reversalPeriod = await this.getOrCreateFiscalPeriod(
        original.entityId,
        new Date(),
        tx as unknown as Prisma.TransactionClient,
      );
      if (reversalPeriod.status !== PeriodStatus.OPEN) {
        throw new ConflictException(
          `Cannot post reversal: current fiscal period ${reversalPeriod.name} is ${reversalPeriod.status}`,
        );
      }

      const draftNumber = `DRAFT-${randomUUID()}`;
      const reversal = await tx.journalEntry.create({
        data: {
          journalNumber: draftNumber,
          entityId: original.entityId,
          fiscalPeriodId: reversalPeriod.id,
          entryDate: new Date(),
          description: `Reversal of ${original.journalNumber}${reason ? `: ${reason}` : ''}`,
          sourceType: 'SYSTEM_REVERSAL',
          sourceReference: original.journalNumber,
          status: JournalEntryStatus.APPROVED, // system-generated reversals skip maker/checker
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          reversalOfId: original.id,
          lines: {
            create: original.lines.map((line) => ({
              lineNumber: line.lineNumber,
              accountId: line.accountId,
              debit: line.credit, // swapped
              credit: line.debit, // swapped
              memo: `Reversal: ${line.memo ?? ''}`.trim(),
              entityId: line.entityId,
              projectId: line.projectId,
              phaseId: line.phaseId,
              blockId: line.blockId,
              floorId: line.floorId,
              unitId: line.unitId,
              departmentId: line.departmentId,
              costCenterId: line.costCenterId,
              fundingSourceId: line.fundingSourceId,
              vendorId: line.vendorId,
              customerId: line.customerId,
            })),
          },
        },
      });

      const fiscalYear = reversal.entryDate.getUTCFullYear();
      const sequenceRows = await tx.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO journal_number_sequences ("entityId", "fiscalYear", "lastNumber")
        VALUES (${original.entityId}, ${fiscalYear}, 1)
        ON CONFLICT ("entityId", "fiscalYear")
        DO UPDATE SET "lastNumber" = journal_number_sequences."lastNumber" + 1
        RETURNING "lastNumber"
      `;
      const journalNumber = `${original.entity.code}-JE-${fiscalYear}-${String(
        sequenceRows[0].lastNumber,
      ).padStart(6, '0')}`;

      const postedReversal = await tx.journalEntry.update({
        where: { id: reversal.id },
        data: { journalNumber, status: JournalEntryStatus.POSTED, postedById: userId, postedAt: new Date() },
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: { status: JournalEntryStatus.REVERSED },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'JOURNAL_REVERSED',
          entityType: 'JournalEntry',
          entityId: original.id,
          afterState: { reversalJournalNumber: journalNumber, reason: reason ?? null },
        },
      });

      this.events.emit(
        JournalReversedEvent.eventName,
        new JournalReversedEvent(original.id, postedReversal.id, original.entityId),
      );

      return postedReversal;
    });
  }

  // -------------------------------------------------------------------
  // SYSTEM-GENERATED ENTRIES (auto-post, no maker/checker)
  // -------------------------------------------------------------------

  /**
   * For entries a subsystem generates and posts automatically — revenue
   * recognition, payroll journals, bank imports — where a human
   * maker/checker step doesn't apply. Still runs every kernel validation
   * (balance, open period, activated accounts) and still writes an audit
   * log and emits `journal.posted`; it simply skips DRAFT/APPROVAL states.
   */
  async postSystemEntryInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateJournalEntryDto,
    systemUserId: string,
  ) {
    this.assertBalanced(dto.lines);
    this.assertNoZeroLines(dto.lines);

    const entity = await tx.entity.findUnique({
      where: { id: dto.entityId },
    });

    if (!entity || !entity.isActive) {
      throw new NotFoundException(
        `Entity ${dto.entityId} not found or inactive`,
      );
    }

    const fiscalPeriod = await this.getOrCreateFiscalPeriod(
      dto.entityId,
      new Date(dto.entryDate),
      tx,
    );

    if (fiscalPeriod.status !== PeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post into fiscal period ${fiscalPeriod.name}: period is ${fiscalPeriod.status}`,
      );
    }

    await this.assertLinesPostable(dto.entityId, dto.lines, tx);

    const entryDate = new Date(dto.entryDate);
    const fiscalYear = entryDate.getUTCFullYear();

    const sequenceRows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO journal_number_sequences ("entityId", "fiscalYear", "lastNumber")
      VALUES (${dto.entityId}, ${fiscalYear}, 1)
      ON CONFLICT ("entityId", "fiscalYear")
      DO UPDATE SET "lastNumber" = journal_number_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;

    const journalNumber =
      `${entity.code}-JE-${fiscalYear}-${String(sequenceRows[0].lastNumber).padStart(6, '0')}`;

    const posted = await tx.journalEntry.create({
      data: {
        journalNumber,
        entityId: dto.entityId,
        fiscalPeriodId: fiscalPeriod.id,
        entryDate,
        description: dto.description,
        sourceType: dto.sourceType ?? 'MANUAL',
        sourceReference: dto.sourceReference,
        status: JournalEntryStatus.POSTED,
        createdById: systemUserId,
        approvedById: systemUserId,
        approvedAt: new Date(),
        postedById: systemUserId,
        postedAt: new Date(),
        lines: {
          create: dto.lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
            entityId: dto.entityId,
            projectId: line.projectId,
            phaseId: line.phaseId,
            blockId: line.blockId,
            floorId: line.floorId,
            unitId: line.unitId,
            departmentId: line.departmentId,
            costCenterId: line.costCenterId,
            fundingSourceId: line.fundingSourceId,
            vendorId: line.vendorId,
            customerId: line.customerId,
          })),
        },
      },
      include: { lines: true },
    });

    await tx.auditLog.create({
      data: {
        userId: systemUserId,
        action: 'JOURNAL_POSTED_SYSTEM',
        entityType: 'JournalEntry',
        entityId: posted.id,
        afterState: {
          journalNumber,
          sourceType: dto.sourceType,
          lineCount: posted.lines.length,
        },
      },
    });

    this.events.emit(
      JournalPostedEvent.eventName,
      new JournalPostedEvent(
        posted.id,
        journalNumber,
        posted.entityId,
      ),
    );

    return posted;
  }
  async postSystemEntry(dto: CreateJournalEntryDto, systemUserId: string) {
    this.assertBalanced(dto.lines);
    this.assertNoZeroLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      const entity = await tx.entity.findUnique({ where: { id: dto.entityId } });
      if (!entity || !entity.isActive) {
        throw new NotFoundException(`Entity ${dto.entityId} not found or inactive`);
      }

      const fiscalPeriod = await this.getOrCreateFiscalPeriod(
        dto.entityId,
        new Date(dto.entryDate),
        tx as unknown as Prisma.TransactionClient,
      );
      if (fiscalPeriod.status !== PeriodStatus.OPEN) {
        throw new ConflictException(
          `Cannot post into fiscal period ${fiscalPeriod.name}: period is ${fiscalPeriod.status}`,
        );
      }

      await this.assertLinesPostable(dto.entityId, dto.lines, tx as unknown as Prisma.TransactionClient);

      const entryDate = new Date(dto.entryDate);
      const fiscalYear = entryDate.getUTCFullYear();
      const sequenceRows = await tx.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO journal_number_sequences ("entityId", "fiscalYear", "lastNumber")
        VALUES (${dto.entityId}, ${fiscalYear}, 1)
        ON CONFLICT ("entityId", "fiscalYear")
        DO UPDATE SET "lastNumber" = journal_number_sequences."lastNumber" + 1
        RETURNING "lastNumber"
      `;
      const journalNumber = `${entity.code}-JE-${fiscalYear}-${String(sequenceRows[0].lastNumber).padStart(6, '0')}`;

      const posted = await tx.journalEntry.create({
        data: {
          journalNumber,
          entityId: dto.entityId,
          fiscalPeriodId: fiscalPeriod.id,
          entryDate,
          description: dto.description,
          sourceType: dto.sourceType ?? 'MANUAL',
          sourceReference: dto.sourceReference,
          status: JournalEntryStatus.POSTED,
          createdById: systemUserId,
          approvedById: systemUserId,
          approvedAt: new Date(),
          postedById: systemUserId,
          postedAt: new Date(),
          lines: {
            create: dto.lines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              memo: line.memo,
              entityId: dto.entityId,
              projectId: line.projectId,
              phaseId: line.phaseId,
              blockId: line.blockId,
              floorId: line.floorId,
              unitId: line.unitId,
              departmentId: line.departmentId,
              costCenterId: line.costCenterId,
              fundingSourceId: line.fundingSourceId,
              vendorId: line.vendorId,
              customerId: line.customerId,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId: systemUserId,
          action: 'JOURNAL_POSTED_SYSTEM',
          entityType: 'JournalEntry',
          entityId: posted.id,
          afterState: { journalNumber, sourceType: dto.sourceType, lineCount: posted.lines.length },
        },
      });

      this.events.emit(
        JournalPostedEvent.eventName,
        new JournalPostedEvent(posted.id, journalNumber, posted.entityId),
      );

      return posted;
    });
  }

  // -------------------------------------------------------------------
  // PERIOD LOCKING
  // -------------------------------------------------------------------

  async lockPeriod(fiscalPeriodId: string, userId: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { id: fiscalPeriodId },
      include: { journalEntries: true },
    });
    if (!period) throw new NotFoundException(`Fiscal period ${fiscalPeriodId} not found`);

    const unresolved = period.journalEntries.filter(
      (e) =>
        e.status === JournalEntryStatus.DRAFT ||
        e.status === JournalEntryStatus.PENDING_APPROVAL ||
        e.status === JournalEntryStatus.APPROVED,
    );
    if (unresolved.length > 0) {
      throw new ConflictException(
        `Cannot lock period ${period.name}: ${unresolved.length} entries are not yet posted or rejected`,
      );
    }

    const locked = await this.prisma.fiscalPeriod.update({
      where: { id: fiscalPeriodId },
      data: { status: PeriodStatus.LOCKED },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PERIOD_LOCKED',
        entityType: 'FiscalPeriod',
        entityId: fiscalPeriodId,
      },
    });

    this.events.emit(PeriodLockedEvent.eventName, new PeriodLockedEvent(fiscalPeriodId, period.entityId));

    return locked;
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private assertBalanced(lines: { debit: number; credit: number }[]) {
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > CENTS_TOLERANCE) {
      throw new BadRequestException(
        `Journal entry is not balanced: total debit ${totalDebit} does not equal total credit ${totalCredit}`,
      );
    }
    if (totalDebit === 0 && totalCredit === 0) {
      throw new BadRequestException('Journal entry has no value — all lines are zero');
    }
  }

  private assertNoZeroLines(lines: { debit: number; credit: number }[]) {
    lines.forEach((line, idx) => {
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(`Line ${idx + 1} cannot have both a debit and a credit`);
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new BadRequestException(`Line ${idx + 1} must have either a debit or a credit amount`);
      }
    });
  }

  private async assertLinesPostable(
    entityId: string,
    lines: { accountId: string }[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = (tx ?? this.prisma) as unknown as PrismaService;
    const accountIds = Array.from(new Set(lines.map((l) => l.accountId)));
    const activations = await client.entityAccount.findMany({
      where: { entityId, accountId: { in: accountIds }, isActive: true },
      include: { account: true },
    });

    const activeMap = new Map(activations.map((a) => [a.accountId, a.account]));

    for (const accountId of accountIds) {
      const account = activeMap.get(accountId);
      if (!account) {
        throw new BadRequestException(
          `Account ${accountId} is not activated for this entity's chart of accounts`,
        );
      }
      if (!account.isPostable) {
        throw new BadRequestException(`Account ${account.code} (${account.name}) is a header account and cannot be posted to`);
      }
      if (!account.isActive) {
        throw new BadRequestException(`Account ${account.code} is inactive`);
      }
    }
  }

  private assertStatus(
    current: JournalEntryStatus,
    allowed: JournalEntryStatus[],
    action: string,
  ) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `Cannot ${action} a journal entry with status ${current}. Expected one of: ${allowed.join(', ')}`,
      );
    }
  }

  private async getEntryOrThrow(journalEntryId: string) {
    const entry = await this.prisma.journalEntry.findUnique({ where: { id: journalEntryId } });
    if (!entry) throw new NotFoundException(`Journal entry ${journalEntryId} not found`);
    return entry;
  }

  /** Finds the calendar-month fiscal period for an entity, creating it if absent. */
  private async getOrCreateFiscalPeriod(
    entityId: string,
    date: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const name = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));

    const existing = await client.fiscalPeriod.findUnique({
      where: { entityId_name: { entityId, name } },
    });
    if (existing) return existing;

    return client.fiscalPeriod.create({
      data: { entityId, name, startDate, endDate, status: PeriodStatus.OPEN },
    });
  }
}
