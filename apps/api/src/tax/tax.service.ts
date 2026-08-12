import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TaxRemittanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsPayableService } from '../accounts-payable/accounts-payable.service';
import { CreateTaxCodeDto, RemitTaxPeriodDto, TaxPositionQueryDto } from './dto/tax.dto';

/**
 * Tax Center Core. This module is a reference-data + reporting layer on
 * top of the WHT/VAT withholding mechanics that already live in
 * Accounts Payable (WHTDeduction / VATDeduction) — it does not
 * duplicate their posting logic. Bulk remittance below calls straight
 * into AccountsPayableService.remitWHT/remitVAT so there is exactly one
 * place that posts a remittance journal entry.
 */
@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsPayable: AccountsPayableService,
  ) {}

  // ---- Tax Codes (reference data) ----

  async createTaxCode(dto: CreateTaxCodeDto) {
    const existing = await this.prisma.taxCode.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Tax code "${dto.code}" already exists`);
    return this.prisma.taxCode.create({ data: { ...dto } });
  }

  findTaxCodes(taxType?: 'WHT' | 'VAT') {
    return this.prisma.taxCode.findMany({ where: { isActive: true, taxType }, orderBy: { code: 'asc' } });
  }

  // ---- Consolidated Tax Position / Return ----

  /**
   * Filing-ready summary of WHT and VAT withheld within [periodStart,
   * periodEnd], reusing AP's existing getWHTSchedule/getVATSchedule
   * (unbounded by date) and filtering to the period here rather than
   * changing those methods' signatures.
   */
  async getTaxPosition(dto: TaxPositionQueryDto) {
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);

    const [whtAll, vatAll] = await Promise.all([
      this.accountsPayable.getWHTSchedule(dto.entityId),
      this.accountsPayable.getVATSchedule(dto.entityId),
    ]);

    const inPeriod = <T extends { createdAt: Date }>(rows: T[]) =>
      rows.filter((r) => r.createdAt >= start && r.createdAt <= end);

    const whtInPeriod = inPeriod(whtAll);
    const vatInPeriod = inPeriod(vatAll);

    const summarize = (rows: { amount: unknown; status: TaxRemittanceStatus; taxAuthorityAccountId: string }[]) => {
      let pending = 0;
      let remitted = 0;
      const byAuthorityAccount: Record<string, number> = {};
      for (const r of rows) {
        const amt = Number(r.amount);
        if (r.status === TaxRemittanceStatus.PENDING) pending += amt;
        else remitted += amt;
        byAuthorityAccount[r.taxAuthorityAccountId] = (byAuthorityAccount[r.taxAuthorityAccountId] ?? 0) + amt;
      }
      return { count: rows.length, pendingAmount: round2(pending), remittedAmount: round2(remitted), byAuthorityAccount };
    };

    return {
      entityId: dto.entityId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      wht: summarize(whtInPeriod),
      vat: summarize(vatInPeriod),
    };
  }

  /** Lighter aggregation for the Dashboard widget — pending totals only, no period filter. */
  async getTaxOverview(entityId: string) {
    const [whtPending, vatPending] = await Promise.all([
      this.accountsPayable.getWHTSchedule(entityId, TaxRemittanceStatus.PENDING),
      this.accountsPayable.getVATSchedule(entityId, TaxRemittanceStatus.PENDING),
    ]);
    return {
      entityId,
      whtPendingCount: whtPending.length,
      whtPendingAmount: round2(whtPending.reduce((s, d) => s + Number(d.amount), 0)),
      vatPendingCount: vatPending.length,
      vatPendingAmount: round2(vatPending.reduce((s, d) => s + Number(d.amount), 0)),
    };
  }

  // ---- Bulk period remittance (reuses AccountsPayableService, no duplicate posting) ----

  async remitPeriod(dto: RemitTaxPeriodDto, userId: string) {
    const position = await this.getTaxPosition({
      entityId: dto.entityId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
    });

    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);
    const schedule =
      dto.taxType === 'WHT'
        ? await this.accountsPayable.getWHTSchedule(dto.entityId, TaxRemittanceStatus.PENDING)
        : await this.accountsPayable.getVATSchedule(dto.entityId, TaxRemittanceStatus.PENDING);
    const pendingInPeriod = schedule.filter((d) => d.createdAt >= start && d.createdAt <= end);

    if (pendingInPeriod.length === 0) {
      throw new NotFoundException(`No pending ${dto.taxType} deductions in this period for entity ${dto.entityId}`);
    }

    const remitted: unknown[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const deduction of pendingInPeriod) {
      try {
        const result =
          dto.taxType === 'WHT'
            ? await this.accountsPayable.remitWHT(deduction.id, { cashGlAccountId: dto.cashGlAccountId }, userId)
            : await this.accountsPayable.remitVAT(deduction.id, { cashGlAccountId: dto.cashGlAccountId }, userId);
        remitted.push(result);
      } catch (err) {
        failed.push({ id: deduction.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return {
      entityId: dto.entityId,
      taxType: dto.taxType,
      attempted: pendingInPeriod.length,
      remittedCount: remitted.length,
      failedCount: failed.length,
      failed,
      totalAttempted: dto.taxType === 'WHT' ? position.wht.pendingAmount : position.vat.pendingAmount,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
