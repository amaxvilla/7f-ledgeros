import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';

interface RecordCustomerPaymentDto {
  installmentLineId: string;
  amount: number;
  entryDate: string;
  bankAccountGlId: string; // GL account for the bank/cash account receiving the payment
  deferredRevenueGlId: string; // GL account for deferred revenue liability
  systemUserId: string;
}

interface RecognizeOnHandoverDto {
  entityId: string;
  unitId: string;
  entryDate: string;
  salePrice: number;
  costOfUnit: number;
  deferredRevenueGlId: string;
  propertySalesRevenueGlId: string;
  costOfSalesGlId: string;
  propertyInventoryGlId: string;
  systemUserId: string;
}

@Injectable()
export class RevenueRecognitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  /**
   * On customer payment:
   *   Dr Bank
   *   Cr Deferred Revenue
   * Cash received against a unit sale is not yet earned revenue under
   * IFRS 15 until control of the unit transfers at handover — until then
   * it sits in deferred revenue.
   *
   * Fixing a verified defect (Release O follow-up): this used to accept
   * `entityId` from the client and post the GL entry into WHATEVER entity
   * the caller claimed, with zero cross-check against the installment
   * line's actual entity (Unit → Floor → Block → Phase → Project →
   * entityId, the same chain accounts-receivable.service.ts and
   * real-estate.service.ts already resolve elsewhere). A caller with
   * access to Entity A could pay down an installment that actually
   * belongs to Entity B and have the journal entry land in Entity A's
   * books. `entityId` is no longer accepted from the client at all — it's
   * derived from the installment line every time, then checked against
   * the caller's RLS scope, matching the pattern
   * accounts-receivable/accounts-payable/budgeting/procurement already
   * use for existing-row access (`canAccess()`, not `@RlsBodyCheck`,
   * exactly per that decorator's own documented boundary).
   */
  async recordCustomerPayment(dto: RecordCustomerPaymentDto, scope: SecurityScope) {
    if (dto.amount <= 0) throw new BadRequestException('Payment amount must be positive');

    const line = await this.prisma.installmentLine.findUnique({
      where: { id: dto.installmentLineId },
      include: {
        schedule: {
          include: {
            unit: { include: { floor: { include: { block: { include: { phase: { include: { project: true } } } } } } } },
            customer: true,
          },
        },
      },
    });
    if (!line) throw new NotFoundException(`Installment line ${dto.installmentLineId} not found`);

    const entityId = line.schedule.unit.floor.block.phase.project.entityId;
    if (!this.rowLevelSecurity.canAccess(scope, { entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Installment line ${dto.installmentLineId} not found`);
    }

    const remaining = Number(line.amountDue) - Number(line.amountPaid);
    if (dto.amount > remaining + 0.01) {
      throw new BadRequestException(
        `Payment of ${dto.amount} exceeds the remaining balance of ${remaining} on this installment`,
      );
    }

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId,
        entryDate: dto.entryDate,
        description: `Customer payment — ${line.schedule.customer.name} / Unit ${line.schedule.unit.code}`,
        sourceType: 'REVENUE_RECOGNITION',
        sourceReference: line.id,
        lines: [
          {
            accountId: dto.bankAccountGlId,
            debit: dto.amount,
            credit: 0,
            unitId: line.schedule.unitId,
            customerId: line.schedule.customerId,
          },
          {
            accountId: dto.deferredRevenueGlId,
            debit: 0,
            credit: dto.amount,
            unitId: line.schedule.unitId,
            customerId: line.schedule.customerId,
          },
        ],
      } as never,
      dto.systemUserId,
    );

    const newAmountPaid = Number(line.amountPaid) + dto.amount;
    const isFullyPaid = Math.abs(newAmountPaid - Number(line.amountDue)) < 0.01;

    await this.prisma.installmentLine.update({
      where: { id: line.id },
      data: {
        amountPaid: newAmountPaid,
        paidAt: isFullyPaid ? new Date(dto.entryDate) : line.paidAt,
      },
    });

    return { journalEntry: posted, installmentLineId: line.id, newAmountPaid, isFullyPaid };
  }

  /**
   * On handover:
   *   Dr Deferred Revenue      Cr Property Sales Revenue
   *   Dr Cost of Sales         Cr Property Inventory
   * Revenue and its matching cost are recognized together, and the unit
   * moves to HANDED_OVER.
   */
  async recognizeOnHandover(dto: RecognizeOnHandoverDto) {
    if (dto.salePrice <= 0) throw new BadRequestException('Sale price must be positive');
    if (dto.costOfUnit < 0) throw new BadRequestException('Cost of unit cannot be negative');

    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException(`Unit ${dto.unitId} not found`);
    if (unit.status === UnitStatus.HANDED_OVER || unit.status === UnitStatus.SOLD) {
      throw new BadRequestException(`Unit ${unit.code} has already been handed over`);
    }

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: dto.entityId,
        entryDate: dto.entryDate,
        description: `Revenue recognition on handover — Unit ${unit.code}`,
        sourceType: 'REVENUE_RECOGNITION',
        sourceReference: unit.id,
        lines: [
          { accountId: dto.deferredRevenueGlId, debit: dto.salePrice, credit: 0, unitId: unit.id },
          { accountId: dto.propertySalesRevenueGlId, debit: 0, credit: dto.salePrice, unitId: unit.id },
          { accountId: dto.costOfSalesGlId, debit: dto.costOfUnit, credit: 0, unitId: unit.id },
          { accountId: dto.propertyInventoryGlId, debit: 0, credit: dto.costOfUnit, unitId: unit.id },
        ],
      } as never,
      dto.systemUserId,
    );

    await this.prisma.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.HANDED_OVER } });
    await this.prisma.unitSaleAllocation.updateMany({
      where: { unitId: unit.id },
      data: { status: UnitStatus.HANDED_OVER },
    });

    return { journalEntry: posted, unitId: unit.id };
  }
}
