import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalEntryStatus, ReconciliationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';

interface CreateIntercompanyDto {
  initiatorEntityId: string;
  counterpartyEntityId: string;
  amount: number;
  currency?: string;
  description: string;
  entryDate: string;
  /** Group-chart account codes — resolved to the standard due-to/due-from control accounts. */
  initiatorAccountId: string; // e.g. the expense/revenue account on the initiator's side
  dueFromAccountId: string; // initiator's "Due from [counterparty]" receivable control account
  dueToAccountId: string; // counterparty's "Due to [initiator]" payable control account
  counterpartyAccountId: string; // the mirrored expense/revenue account on the counterparty's side
  createdById: string;
}

@Injectable()
export class IntercompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
  ) {}

  /**
   * Creates the initiator's journal entry plus an automatic mirror entry on
   * the counterparty's books, linked via an IntercompanyTransaction record
   * for reconciliation tracking and later elimination at consolidation.
   */
  async create(dto: CreateIntercompanyDto) {
    if (dto.initiatorEntityId === dto.counterpartyEntityId) {
      throw new BadRequestException(
        'Intercompany transactions require two distinct entities',
      );
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Intercompany amount must be positive');
    }

    const connection = await this.prisma.intercompanyConnection.findFirst({
      where: {
        initiatorEntityId: dto.initiatorEntityId,
        counterpartyEntityId: dto.counterpartyEntityId,
        isActive: true,
      },
    });

    if (!connection) {
      throw new BadRequestException(
        `No active intercompany connection exists between initiator entity ${dto.initiatorEntityId} and counterparty entity ${dto.counterpartyEntityId}`,
      );
    }

    // ---- Initiator side: Dr [expense/asset] / Cr Due-from-counterparty
    const initiatorDraft = await this.postingEngine.createDraft(
      {
        entityId: dto.initiatorEntityId,
        entryDate: dto.entryDate,
        description: dto.description,
        sourceType: 'INTERCOMPANY',
        lines: [
          { accountId: dto.dueFromAccountId, debit: dto.amount, credit: 0 },
          { accountId: dto.initiatorAccountId, debit: 0, credit: dto.amount },
        ],
      } as never,
      dto.createdById,
    );

    // ---- Mirror side: Dr [account] / Cr Due-to-initiator
    const mirrorDraft = await this.postingEngine.createDraft(
      {
        entityId: dto.counterpartyEntityId,
        entryDate: dto.entryDate,
        description: `[Intercompany mirror] ${dto.description}`,
        sourceType: 'INTERCOMPANY',
        sourceReference: initiatorDraft.id,
        lines: [
          { accountId: dto.counterpartyAccountId, debit: dto.amount, credit: 0 },
          { accountId: dto.dueToAccountId, debit: 0, credit: dto.amount },
        ],
      } as never,
      dto.createdById,
    );

    return this.prisma.intercompanyTransaction.create({
      data: {
        connectionId: connection.id,
        initiatorEntityId: dto.initiatorEntityId,
        counterpartyEntityId: dto.counterpartyEntityId,
        journalEntryId: initiatorDraft.id,
        mirrorJournalEntryId: mirrorDraft.id,
        amount: dto.amount,
        currency: dto.currency ?? 'NGN',
        description: dto.description,
        reconciliationStatus: ReconciliationStatus.UNRECONCILED,
      },
      include: { journalEntry: true },
    });
  }

  findAll(filter?: { entityId?: string; status?: ReconciliationStatus }) {
    return this.prisma.intercompanyTransaction.findMany({
      where: {
        ...(filter?.entityId
          ? { OR: [{ initiatorEntityId: filter.entityId }, { counterpartyEntityId: filter.entityId }] }
          : {}),
        ...(filter?.status ? { reconciliationStatus: filter.status } : {}),
      },
      include: { initiatorEntity: true, counterpartyEntity: true, journalEntry: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Reconciliation: both the initiator entry and its mirror must be posted
   * (both books agree) before the pair can be marked RECONCILED.
   */
  async reconcile(id: string) {
    const ic = await this.prisma.intercompanyTransaction.findUnique({
      where: { id },
      include: { journalEntry: true },
    });
    if (!ic) throw new NotFoundException(`Intercompany transaction ${id} not found`);
    if (!ic.mirrorJournalEntryId) {
      throw new BadRequestException('No mirror entry recorded for this transaction');
    }

    const mirror = await this.prisma.journalEntry.findUnique({ where: { id: ic.mirrorJournalEntryId } });
    if (!mirror) throw new NotFoundException('Mirror journal entry not found');

    const bothPosted =
      ic.journalEntry.status === JournalEntryStatus.POSTED && mirror.status === JournalEntryStatus.POSTED;

    return this.prisma.intercompanyTransaction.update({
      where: { id },
      data: {
        reconciliationStatus: bothPosted
          ? ReconciliationStatus.RECONCILED
          : ReconciliationStatus.PARTIALLY_RECONCILED,
      },
    });
  }

  async flagDisputed(id: string) {
    await this.prisma.intercompanyTransaction.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException(`Intercompany transaction ${id} not found`);
    });
    return this.prisma.intercompanyTransaction.update({
      where: { id },
      data: { reconciliationStatus: ReconciliationStatus.DISPUTED },
    });
  }
}
