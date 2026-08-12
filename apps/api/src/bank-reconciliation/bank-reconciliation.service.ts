import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReconciliationMatchType, ReconciliationSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { ImportBankStatementDto } from './dto/import-bank-statement.dto';
import { CreateReconciliationSessionDto } from './dto/create-reconciliation-session.dto';
import { ManualMatchDto } from './dto/manual-match.dto';
import { RecordAdjustmentDto } from './dto/record-adjustment.dto';

const AMOUNT_TOLERANCE = 0.01;
const AUTO_MATCH_DATE_WINDOW_DAYS = 5;

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
  ) {}

  // -------------------------------------------------------------------
  // STATEMENT IMPORT
  // -------------------------------------------------------------------

  async importStatement(dto: ImportBankStatementDto, userId: string) {
    const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: dto.bankAccountId } });
    if (!bankAccount || !bankAccount.isActive) {
      throw new NotFoundException(`Bank account ${dto.bankAccountId} not found or inactive`);
    }

    return this.prisma.bankStatement.create({
      data: {
        entityId: dto.entityId,
        bankAccountId: dto.bankAccountId,
        statementDate: new Date(dto.statementDate),
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        openingBalance: dto.openingBalance,
        closingBalance: dto.closingBalance,
        importedById: userId,
        lines: {
          create: dto.lines.map((line) => ({
            transactionDate: new Date(line.transactionDate),
            description: line.description,
            reference: line.reference,
            amount: line.amount,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async findStatement(id: string) {
    const statement = await this.prisma.bankStatement.findUnique({ where: { id }, include: { lines: true } });
    if (!statement) throw new NotFoundException(`Bank statement ${id} not found`);
    return statement;
  }

  // -------------------------------------------------------------------
  // RECONCILIATION SESSIONS
  // -------------------------------------------------------------------

  async createSession(dto: CreateReconciliationSessionDto, userId: string) {
    const statement = await this.prisma.bankStatement.findUnique({ where: { id: dto.statementId } });
    if (!statement) throw new NotFoundException(`Bank statement ${dto.statementId} not found`);
    if (statement.bankAccountId !== dto.bankAccountId || statement.entityId !== dto.entityId) {
      throw new BadRequestException('Statement does not belong to this entity/bank account');
    }

    return this.prisma.reconciliationSession.create({
      data: {
        entityId: dto.entityId,
        bankAccountId: dto.bankAccountId,
        statementId: dto.statementId,
        bankGlAccountId: dto.bankGlAccountId,
        sessionDate: new Date(dto.sessionDate),
        status: ReconciliationSessionStatus.DRAFT,
        createdById: userId,
      },
    });
  }

  async findSession(id: string) {
    const session = await this.prisma.reconciliationSession.findUnique({
      where: { id },
      include: { statement: { include: { lines: true } }, matches: true },
    });
    if (!session) throw new NotFoundException(`Reconciliation session ${id} not found`);
    return session;
  }

  /**
   * Matches unmatched statement lines to unmatched JournalLine entries on
   * the session's bank GL account, within a date window and amount
   * tolerance. "Unmatched" on the book side means no ReconciliationMatch
   * row for this session already references that journalLineId.
   */
  async autoMatch(sessionId: string, userId: string) {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertDraft(session.status, 'auto-match');

    const [unmatchedLines, candidateJournalLines, existingMatches] = await Promise.all([
      this.prisma.bankStatementLine.findMany({ where: { statementId: session.statementId, isMatched: false } }),
      this.prisma.journalLine.findMany({
        where: {
          accountId: session.bankGlAccountId,
          journalEntry: { entityId: session.entityId, status: 'POSTED' },
        },
        include: { journalEntry: true },
      }),
      this.prisma.reconciliationMatch.findMany({ where: { sessionId } }),
    ]);

    const alreadyMatchedJournalLineIds = new Set(existingMatches.map((m) => m.journalLineId).filter(Boolean));
    const availableJournalLines = candidateJournalLines.filter((jl) => !alreadyMatchedJournalLineIds.has(jl.id));

    let matchedCount = 0;
    for (const statementLine of unmatchedLines) {
      // Bank GL account is debit-normal: a deposit (positive statement
      // amount) corresponds to a journal debit; a withdrawal (negative)
      // corresponds to a journal credit.
      const targetAmount = Math.abs(Number(statementLine.amount));
      const wantsDebit = Number(statementLine.amount) > 0;

      const match = availableJournalLines.find((jl) => {
        const journalAmount = wantsDebit ? Number(jl.debit) : Number(jl.credit);
        if (Math.abs(journalAmount - targetAmount) > AMOUNT_TOLERANCE) return false;
        const dayDiff = Math.abs(
          (statementLine.transactionDate.getTime() - jl.journalEntry.entryDate.getTime()) / 86_400_000,
        );
        return dayDiff <= AUTO_MATCH_DATE_WINDOW_DAYS;
      });

      if (match) {
        await this.prisma.reconciliationMatch.create({
          data: {
            sessionId,
            bankStatementLineId: statementLine.id,
            journalLineId: match.id,
            matchType: ReconciliationMatchType.AUTO,
            matchedAmount: targetAmount,
            createdById: userId,
          },
        });
        await this.prisma.bankStatementLine.update({ where: { id: statementLine.id }, data: { isMatched: true } });
        availableJournalLines.splice(availableJournalLines.indexOf(match), 1);
        matchedCount += 1;
      }
    }

    return { sessionId, matchedCount, remainingUnmatched: unmatchedLines.length - matchedCount };
  }

  async manualMatch(sessionId: string, dto: ManualMatchDto, userId: string) {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertDraft(session.status, 'manually match');

    const statementLine = await this.prisma.bankStatementLine.findUnique({ where: { id: dto.bankStatementLineId } });
    if (!statementLine || statementLine.statementId !== session.statementId) {
      throw new NotFoundException(`Statement line ${dto.bankStatementLineId} not found on this session's statement`);
    }
    if (statementLine.isMatched) throw new ConflictException('Statement line is already matched');

    const journalLine = await this.prisma.journalLine.findUnique({ where: { id: dto.journalLineId } });
    if (!journalLine) throw new NotFoundException(`Journal line ${dto.journalLineId} not found`);

    const match = await this.prisma.reconciliationMatch.create({
      data: {
        sessionId,
        bankStatementLineId: dto.bankStatementLineId,
        journalLineId: dto.journalLineId,
        matchType: ReconciliationMatchType.MANUAL,
        matchedAmount: Math.abs(Number(statementLine.amount)),
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.prisma.bankStatementLine.update({ where: { id: dto.bankStatementLineId }, data: { isMatched: true } });
    return match;
  }

  /**
   * Raises the GL entry for a bank charge or interest income found on
   * the statement but not yet in the books (Dr/Cr the bank GL account
   * itself, so it now appears as a book-side line too), then matches
   * the new journal line to the statement line that prompted it.
   */
  async recordAdjustment(sessionId: string, dto: RecordAdjustmentDto, userId: string) {
    const session = await this.getSessionOrThrow(sessionId);
    this.assertDraft(session.status, 'record an adjustment for');

    const statementLine = await this.prisma.bankStatementLine.findUnique({ where: { id: dto.bankStatementLineId } });
    if (!statementLine || statementLine.statementId !== session.statementId) {
      throw new NotFoundException(`Statement line ${dto.bankStatementLineId} not found on this session's statement`);
    }
    if (statementLine.isMatched) throw new ConflictException('Statement line is already matched');

    const amount = Math.abs(Number(statementLine.amount));
    const isDeposit = Number(statementLine.amount) > 0; // interest income is a deposit; bank charge is a withdrawal
    if (dto.adjustmentType === 'INTEREST_INCOME' && !isDeposit) {
      throw new BadRequestException('Interest income adjustments must be raised against a deposit (positive) line');
    }
    if (dto.adjustmentType === 'BANK_CHARGE' && isDeposit) {
      throw new BadRequestException('Bank charge adjustments must be raised against a withdrawal (negative) line');
    }

    const bankLine = isDeposit
      ? { accountId: session.bankGlAccountId, debit: amount, credit: 0 }
      : { accountId: session.bankGlAccountId, debit: 0, credit: amount };
    const contraLine = isDeposit
      ? { accountId: dto.contraAccountId, debit: 0, credit: amount }
      : { accountId: dto.contraAccountId, debit: amount, credit: 0 };

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: session.entityId,
        entryDate: statementLine.transactionDate.toISOString(),
        description: `${dto.adjustmentType === 'BANK_CHARGE' ? 'Bank charge' : 'Interest income'} — ${statementLine.description}`,
        sourceType: 'BANK_IMPORT',
        sourceReference: statementLine.id,
        lines: [bankLine, contraLine],
      } as never,
      userId,
    );

    const postedWithLines = posted as { id: string; lines?: { id: string; accountId: string }[] };
    const newBankJournalLineId = postedWithLines.lines?.find((l) => l.accountId === session.bankGlAccountId)?.id;

    const match = await this.prisma.reconciliationMatch.create({
      data: {
        sessionId,
        bankStatementLineId: dto.bankStatementLineId,
        journalLineId: newBankJournalLineId,
        matchType: ReconciliationMatchType.ADJUSTMENT,
        matchedAmount: amount,
        notes: `${dto.adjustmentType} auto-posted during reconciliation`,
        createdById: userId,
      },
    });

    await this.prisma.bankStatementLine.update({ where: { id: dto.bankStatementLineId }, data: { isMatched: true } });

    return { match, journalEntry: posted };
  }

  async approveSession(id: string, userId: string) {
    const session = await this.prisma.reconciliationSession.findUnique({
      where: { id },
      include: { statement: { include: { lines: true } } },
    });
    if (!session) throw new NotFoundException(`Reconciliation session ${id} not found`);
    this.assertDraft(session.status, 'approve');
    if (session.createdById === userId) {
      throw new BadRequestException('The preparer of a reconciliation session cannot also approve it');
    }

    const unmatched = session.statement.lines.filter((l) => !l.isMatched);
    if (unmatched.length > 0) {
      throw new BadRequestException(
        `Cannot approve: ${unmatched.length} statement line(s) are still unmatched. Match or record an adjustment for each first.`,
      );
    }

    return this.prisma.reconciliationSession.update({
      where: { id },
      data: { status: ReconciliationSessionStatus.APPROVED, approvedById: userId, approvedAt: new Date() },
    });
  }

  /**
   * Reconciliation status summary: statement-side unmatched lines
   * ("outstanding lodgements" if a deposit, "unpresented cheques" if a
   * withdrawal — the item is on the bank statement but has no GL match
   * yet is the opposite read: it's on the BOOKS but not yet cleared BY
   * the bank) plus book-side journal lines on the bank account with no
   * matching statement line at all.
   */
  async getSessionSummary(id: string) {
    const session = await this.findSession(id);
    const unmatchedStatementLines = session.statement.lines.filter((l) => !l.isMatched);

    const matchedJournalLineIds = new Set(session.matches.map((m) => m.journalLineId).filter(Boolean));
    const bookLines = await this.prisma.journalLine.findMany({
      where: {
        accountId: session.bankGlAccountId,
        journalEntry: {
          entityId: session.entityId,
          status: 'POSTED',
          entryDate: { gte: session.statement.periodStart, lte: session.statement.periodEnd },
        },
      },
      include: { journalEntry: true },
    });
    const unmatchedBookLines = bookLines.filter((jl) => !matchedJournalLineIds.has(jl.id));

    return {
      sessionId: id,
      status: session.status,
      matchedCount: session.matches.length,
      unmatchedStatementLines: unmatchedStatementLines.map((l) => ({
        id: l.id,
        transactionDate: l.transactionDate,
        description: l.description,
        amount: Number(l.amount),
        classification: Number(l.amount) > 0 ? 'outstanding_lodgement' : 'unpresented_item',
      })),
      unmatchedBookLines: unmatchedBookLines.map((l) => ({
        id: l.id,
        entryDate: l.journalEntry.entryDate,
        debit: Number(l.debit),
        credit: Number(l.credit),
        classification: Number(l.debit) > 0 ? 'deposit_in_transit' : 'unpresented_cheque',
      })),
    };
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async getSessionOrThrow(id: string) {
    const session = await this.prisma.reconciliationSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Reconciliation session ${id} not found`);
    return session;
  }

  private assertDraft(status: ReconciliationSessionStatus, action: string) {
    if (status !== ReconciliationSessionStatus.DRAFT) {
      throw new ConflictException(`Cannot ${action} a session with status ${status}`);
    }
  }
}
