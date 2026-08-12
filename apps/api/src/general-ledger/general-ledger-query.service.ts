import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeneralLedgerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: { entityId?: string; status?: string; fiscalPeriodId?: string }) {
    return this.prisma.journalEntry.findMany({
      where: {
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
        ...(filter.status ? { status: filter.status as never } : {}),
        ...(filter.fiscalPeriodId ? { fiscalPeriodId: filter.fiscalPeriodId } : {}),
      },
      include: { lines: true, entity: true, fiscalPeriod: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { account: true, project: true, unit: true, vendor: true, customer: true } },
        entity: true,
        fiscalPeriod: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        postedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!entry) throw new NotFoundException(`Journal entry ${id} not found`);
    return entry;
  }

  /** Sums posted journal lines by account for an entity, optionally scoped to one fiscal period. */
  async getTrialBalance(entityId: string, fiscalPeriodId?: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        entityId,
        journalEntry: {
          status: 'POSTED',
          ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
        },
      },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { accountId: string; code: string; name: string; debit: number; credit: number }
    >();

    for (const line of lines) {
      const key = line.accountId;
      const existing = byAccount.get(key) ?? {
        accountId: key,
        code: line.account.code,
        name: line.account.name,
        debit: 0,
        credit: 0,
      };
      existing.debit += Number(line.debit);
      existing.credit += Number(line.credit);
      byAccount.set(key, existing);
    }

    const rows = Array.from(byAccount.values()).sort((a, b) => a.code.localeCompare(b.code));
    const totals = rows.reduce(
      (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
      { debit: 0, credit: 0 },
    );

    return { entityId, fiscalPeriodId: fiscalPeriodId ?? null, rows, totals };
  }
}
