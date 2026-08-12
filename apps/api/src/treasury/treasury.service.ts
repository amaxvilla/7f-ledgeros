import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, MaturityInstruction, PlacementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';

interface CreateLoanFacilityDto {
  entityId: string;
  lenderName: string;
  facilityAmount: number;
  currency?: string;
  interestRatePercent: number;
  startDate: string;
  maturityDate: string;
}

interface CreateDrawdownDto {
  loanFacilityId: string;
  amount: number;
  drawdownDate: string;
  createdById: string;
}

interface GenerateRepaymentScheduleDto {
  loanFacilityId: string;
  numberOfInstallments: number;
  firstDueDate: string;
  frequencyMonths: number; // e.g. 1 = monthly, 3 = quarterly
}

interface RecordRepaymentDto {
  repaymentLineId: string;
  principalPaid: number;
  interestPaid: number;
  paidAt: string;
}

interface CreatePlacementDto {
  entityId: string;
  institutionName: string;
  principalAmount: number;
  interestRatePercent: number;
  placementDate: string;
  maturityDate: string;
  maturityInstruction?: MaturityInstruction;
}

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // ---- Bank & Cash accounts ----

  async createBankAccount(entityId: string, accountName: string, accountNumber: string, bankName: string, currency = 'NGN') {
    const existing = await this.prisma.bankAccount.findUnique({
      where: { entityId_accountNumber: { entityId, accountNumber } },
    });
    if (existing) throw new ConflictException(`Account number ${accountNumber} already exists for this entity`);
    return this.prisma.bankAccount.create({ data: { entityId, accountName, accountNumber, bankName, currency } });
  }

  findBankAccounts(scope: SecurityScope, entityId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.bankAccount.findMany({ where: { AND: [rls, { entityId }] } });
  }

  createCashAccount(entityId: string, name: string, custodian?: string, currency = 'NGN') {
    return this.prisma.cashAccount.create({ data: { entityId, name, custodian, currency } });
  }

  findCashAccounts(scope: SecurityScope, entityId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.cashAccount.findMany({ where: { AND: [rls, { entityId }] } });
  }

  // ---- Loan Facilities ----

  async createLoanFacility(dto: CreateLoanFacilityDto) {
    if (dto.facilityAmount <= 0) throw new BadRequestException('Facility amount must be positive');
    if (new Date(dto.maturityDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Maturity date must be after the start date');
    }
    return this.prisma.loanFacility.create({
      data: {
        entityId: dto.entityId,
        lenderName: dto.lenderName,
        facilityAmount: dto.facilityAmount,
        currency: dto.currency ?? 'NGN',
        interestRatePercent: dto.interestRatePercent,
        startDate: new Date(dto.startDate),
        maturityDate: new Date(dto.maturityDate),
        status: LoanStatus.ACTIVE,
      },
    });
  }

  findLoanFacilities(scope: SecurityScope, entityId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.loanFacility.findMany({
      where: { AND: [rls, { entityId }] },
      include: { drawdowns: true, repaymentSchedule: true },
    });
  }

  async getLoanPosition(loanFacilityId: string) {
    const facility = await this.prisma.loanFacility.findUnique({
      where: { id: loanFacilityId },
      include: { drawdowns: true, repaymentSchedule: true, interestAccruals: true },
    });
    if (!facility) throw new NotFoundException(`Loan facility ${loanFacilityId} not found`);

    const totalDrawn = facility.drawdowns.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalPrincipalRepaid = facility.repaymentSchedule.reduce((sum, r) => sum + Number(r.principalPaid), 0);
    const totalInterestAccrued = facility.interestAccruals.reduce((sum, a) => sum + Number(a.amount), 0);
    const totalInterestRepaid = facility.repaymentSchedule.reduce((sum, r) => sum + Number(r.interestPaid), 0);

    return {
      loanFacilityId,
      facilityAmount: Number(facility.facilityAmount),
      totalDrawn,
      undrawnBalance: Number(facility.facilityAmount) - totalDrawn,
      totalPrincipalRepaid,
      outstandingPrincipal: totalDrawn - totalPrincipalRepaid,
      totalInterestAccrued,
      totalInterestRepaid,
      outstandingInterest: totalInterestAccrued - totalInterestRepaid,
    };
  }

  // ---- Drawdowns ----

  async createDrawdown(dto: CreateDrawdownDto) {
    if (dto.amount <= 0) throw new BadRequestException('Drawdown amount must be positive');

    const facility = await this.prisma.loanFacility.findUnique({
      where: { id: dto.loanFacilityId },
      include: { drawdowns: true },
    });
    if (!facility) throw new NotFoundException(`Loan facility ${dto.loanFacilityId} not found`);
    if (facility.status !== LoanStatus.ACTIVE) {
      throw new ConflictException(`Loan facility is ${facility.status}, cannot draw down`);
    }

    const alreadyDrawn = facility.drawdowns.reduce((sum, d) => sum + Number(d.amount), 0);
    if (alreadyDrawn + dto.amount > Number(facility.facilityAmount) + 0.01) {
      throw new BadRequestException(
        `Drawdown of ${dto.amount} would exceed the undrawn balance of ${Number(facility.facilityAmount) - alreadyDrawn}`,
      );
    }

    return this.prisma.drawdown.create({
      data: {
        loanFacilityId: dto.loanFacilityId,
        amount: dto.amount,
        drawdownDate: new Date(dto.drawdownDate),
        createdById: dto.createdById,
      },
    });
  }

  // ---- Repayment schedule ----

  /**
   * Splits the currently drawn principal evenly across N installments on
   * a fixed frequency, with simple (non-amortizing) interest per
   * installment based on the facility's annual rate. A production system
   * would offer amortizing/reducing-balance schedules as an option; this
   * gives QS/Finance a working baseline schedule to start from.
   */
  async generateRepaymentSchedule(dto: GenerateRepaymentScheduleDto) {
    if (dto.numberOfInstallments <= 0) throw new BadRequestException('Number of installments must be positive');

    const facility = await this.prisma.loanFacility.findUnique({
      where: { id: dto.loanFacilityId },
      include: { drawdowns: true, repaymentSchedule: true },
    });
    if (!facility) throw new NotFoundException(`Loan facility ${dto.loanFacilityId} not found`);
    if (facility.repaymentSchedule.length > 0) {
      throw new ConflictException('A repayment schedule already exists for this facility');
    }

    const totalDrawn = facility.drawdowns.reduce((sum, d) => sum + Number(d.amount), 0);
    if (totalDrawn <= 0) throw new BadRequestException('Cannot schedule repayments before any drawdown');

    const principalPerInstallment = totalDrawn / dto.numberOfInstallments;
    const annualRate = Number(facility.interestRatePercent) / 100;
    const periodicRate = annualRate * (dto.frequencyMonths / 12);
    const interestPerInstallment = totalDrawn * periodicRate; // flat, on the original drawn balance

    const lines = Array.from({ length: dto.numberOfInstallments }).map((_, i) => {
      const dueDate = new Date(dto.firstDueDate);
      dueDate.setUTCMonth(dueDate.getUTCMonth() + i * dto.frequencyMonths);
      return {
        loanFacilityId: dto.loanFacilityId,
        dueDate,
        principalDue: principalPerInstallment,
        interestDue: interestPerInstallment,
      };
    });

    await this.prisma.repaymentLine.createMany({ data: lines });
    return this.prisma.repaymentLine.findMany({
      where: { loanFacilityId: dto.loanFacilityId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async recordRepayment(dto: RecordRepaymentDto) {
    const line = await this.prisma.repaymentLine.findUnique({ where: { id: dto.repaymentLineId } });
    if (!line) throw new NotFoundException(`Repayment line ${dto.repaymentLineId} not found`);
    if (line.paidAt) throw new ConflictException('This installment has already been recorded as paid');

    const principalRemaining = Number(line.principalDue) - Number(line.principalPaid);
    const interestRemaining = Number(line.interestDue) - Number(line.interestPaid);
    if (dto.principalPaid > principalRemaining + 0.01 || dto.interestPaid > interestRemaining + 0.01) {
      throw new BadRequestException('Payment exceeds the amount due on this installment');
    }

    const newPrincipalPaid = Number(line.principalPaid) + dto.principalPaid;
    const newInterestPaid = Number(line.interestPaid) + dto.interestPaid;
    const isFullySettled =
      Math.abs(newPrincipalPaid - Number(line.principalDue)) < 0.01 &&
      Math.abs(newInterestPaid - Number(line.interestDue)) < 0.01;

    return this.prisma.repaymentLine.update({
      where: { id: dto.repaymentLineId },
      data: {
        principalPaid: newPrincipalPaid,
        interestPaid: newInterestPaid,
        paidAt: isFullySettled ? new Date(dto.paidAt) : null,
      },
    });
  }

  // ---- Interest accruals ----

  async recordInterestAccrual(loanFacilityId: string, accrualDate: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Accrual amount must be positive');
    const facility = await this.prisma.loanFacility.findUnique({ where: { id: loanFacilityId } });
    if (!facility) throw new NotFoundException(`Loan facility ${loanFacilityId} not found`);

    return this.prisma.interestAccrual.create({
      data: { loanFacilityId, accrualDate: new Date(accrualDate), amount },
    });
  }

  // ---- Investment placements ----

  async createPlacement(dto: CreatePlacementDto) {
    if (dto.principalAmount <= 0) throw new BadRequestException('Principal amount must be positive');
    if (new Date(dto.maturityDate) <= new Date(dto.placementDate)) {
      throw new BadRequestException('Maturity date must be after the placement date');
    }
    return this.prisma.investmentPlacement.create({
      data: {
        entityId: dto.entityId,
        institutionName: dto.institutionName,
        principalAmount: dto.principalAmount,
        interestRatePercent: dto.interestRatePercent,
        placementDate: new Date(dto.placementDate),
        maturityDate: new Date(dto.maturityDate),
        maturityInstruction: dto.maturityInstruction ?? MaturityInstruction.PAYOUT,
        status: PlacementStatus.ACTIVE,
      },
    });
  }

  findPlacements(entityId?: string, status?: PlacementStatus) {
    return this.prisma.investmentPlacement.findMany({
      where: { ...(entityId ? { entityId } : {}), ...(status ? { status } : {}) },
      orderBy: { maturityDate: 'asc' },
    });
  }

  /**
   * Applies a placement's maturity instruction: PAYOUT closes it out;
   * either rollover option opens a fresh placement continuing from the
   * elected base (principal only, or principal + accrued interest).
   */
  async processMaturity(placementId: string, actualInterestEarned: number) {
    const placement = await this.prisma.investmentPlacement.findUnique({ where: { id: placementId } });
    if (!placement) throw new NotFoundException(`Placement ${placementId} not found`);
    if (placement.status !== PlacementStatus.ACTIVE) {
      throw new ConflictException(`Placement is already ${placement.status}`);
    }

    if (placement.maturityInstruction === MaturityInstruction.PAYOUT) {
      return this.prisma.investmentPlacement.update({
        where: { id: placementId },
        data: { status: PlacementStatus.MATURED },
      });
    }

    const rolloverPrincipal =
      placement.maturityInstruction === MaturityInstruction.ROLLOVER_PRINCIPAL_AND_INTEREST
        ? Number(placement.principalAmount) + actualInterestEarned
        : Number(placement.principalAmount);

    const [, rolled] = await this.prisma.$transaction([
      this.prisma.investmentPlacement.update({
        where: { id: placementId },
        data: { status: PlacementStatus.MATURED },
      }),
      this.prisma.investmentPlacement.create({
        data: {
          entityId: placement.entityId,
          institutionName: placement.institutionName,
          principalAmount: rolloverPrincipal,
          interestRatePercent: placement.interestRatePercent,
          placementDate: placement.maturityDate,
          maturityDate: this.addDays(placement.maturityDate, this.daysBetween(placement.placementDate, placement.maturityDate)),
          maturityInstruction: placement.maturityInstruction,
          status: PlacementStatus.ACTIVE,
        },
      }),
    ]);

    return rolled;
  }

  private daysBetween(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
