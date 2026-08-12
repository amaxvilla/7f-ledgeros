import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MortgageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { RevenueRecognitionService } from '../revenue-recognition/revenue-recognition.service';
import {
  ApproveMortgageDto,
  CreateMortgageApplicationDto,
  DeclineMortgageDto,
  DisburseMortgageDto,
} from './dto/mortgage.dto';

@Injectable()
export class MortgageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly revenueRecognition: RevenueRecognitionService,
  ) {}

  async createApplication(dto: CreateMortgageApplicationDto, createdById: string) {
    const allocation = await this.prisma.unitSaleAllocation.findUnique({ where: { id: dto.allocationId } });
    if (!allocation) throw new NotFoundException(`Unit sale allocation ${dto.allocationId} not found`);

    return this.prisma.mortgageApplication.create({
      data: {
        allocationId: dto.allocationId,
        entityId: dto.entityId,
        lenderName: dto.lenderName,
        amountApplied: dto.amountApplied,
        interestRatePercent: dto.interestRatePercent,
        tenorMonths: dto.tenorMonths,
        notes: dto.notes,
        createdById,
      },
    });
  }

  findApplications(scope: SecurityScope, filters: { entityId?: string; status?: MortgageStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.mortgageApplication.findMany({
      where: { AND: [rls, filters] },
      include: { allocation: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplication(id: string) {
    const application = await this.prisma.mortgageApplication.findUnique({
      where: { id },
      include: { allocation: true },
    });
    if (!application) throw new NotFoundException(`Mortgage application ${id} not found`);
    return application;
  }

  private async requireApplication(id: string) {
    const application = await this.prisma.mortgageApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException(`Mortgage application ${id} not found`);
    return application;
  }

  async submitApplication(id: string) {
    const application = await this.requireApplication(id);
    if (application.status !== MortgageStatus.DRAFT) {
      throw new ConflictException(`Only a DRAFT application can be submitted (currently ${application.status})`);
    }
    return this.prisma.mortgageApplication.update({ where: { id }, data: { status: MortgageStatus.SUBMITTED } });
  }

  async approveApplication(id: string, dto: ApproveMortgageDto) {
    const application = await this.requireApplication(id);
    if (application.status !== MortgageStatus.SUBMITTED) {
      throw new ConflictException(`Only a SUBMITTED application can be approved (currently ${application.status})`);
    }
    return this.prisma.mortgageApplication.update({
      where: { id },
      data: {
        status: MortgageStatus.APPROVED,
        amountApproved: dto.amountApproved,
        interestRatePercent: dto.interestRatePercent ?? application.interestRatePercent,
        tenorMonths: dto.tenorMonths ?? application.tenorMonths,
        approvalDate: new Date(),
      },
    });
  }

  async declineApplication(id: string, dto: DeclineMortgageDto) {
    const application = await this.requireApplication(id);
    if (application.status !== MortgageStatus.SUBMITTED) {
      throw new ConflictException(`Only a SUBMITTED application can be declined (currently ${application.status})`);
    }
    return this.prisma.mortgageApplication.update({
      where: { id },
      data: { status: MortgageStatus.DECLINED, declineReason: dto.reason },
    });
  }

  /**
   * Records the lender's disbursement as an ordinary customer payment
   * against the sale's installment schedule, reusing
   * RevenueRecognitionService.recordCustomerPayment() (Phase 4, unchanged)
   * rather than re-implementing the Dr Bank / Cr Deferred Revenue posting
   * here — the mortgage bank account is just another source of cash.
   */
  async disburse(id: string, dto: DisburseMortgageDto, systemUserId: string, scope: SecurityScope) {
    const application = await this.requireApplication(id);
    if (application.status !== MortgageStatus.APPROVED) {
      throw new ConflictException(`Only an APPROVED application can be disbursed (currently ${application.status})`);
    }
    if (application.amountApproved && dto.disbursedAmount > Number(application.amountApproved)) {
      throw new BadRequestException('Disbursed amount cannot exceed the approved amount');
    }

    // Release O follow-up: entityId is no longer sent — RevenueRecognitionService
    // now derives it itself from the installment line and checks the
    // caller's RLS scope, so it's forwarded here rather than trusted from
    // application.entityId (which, incidentally, is exactly the kind of
    // caller-supplied value that fix was closing off).
    const journalEntry = await this.revenueRecognition.recordCustomerPayment(
      {
        installmentLineId: dto.installmentLineId,
        amount: dto.disbursedAmount,
        entryDate: dto.entryDate,
        bankAccountGlId: dto.bankAccountGlId,
        deferredRevenueGlId: dto.deferredRevenueGlId,
        systemUserId,
      } as never,
      scope,
    );

    const updated = await this.prisma.mortgageApplication.update({
      where: { id },
      data: {
        status: MortgageStatus.DISBURSED,
        disbursedAmount: dto.disbursedAmount,
        disbursementDate: new Date(dto.entryDate),
      },
    });

    return { application: updated, journalEntry };
  }

  async closeApplication(id: string) {
    const application = await this.requireApplication(id);
    if (application.status !== MortgageStatus.DISBURSED) {
      throw new ConflictException(`Only a DISBURSED application can be closed (currently ${application.status})`);
    }
    return this.prisma.mortgageApplication.update({ where: { id }, data: { status: MortgageStatus.CLOSED } });
  }

  /** Mortgage exposure summary for a dashboard widget — counts by status plus approved/disbursed totals. */
  async getMortgagePipelineSummary(entityId?: string) {
    const applications = await this.prisma.mortgageApplication.findMany({ where: { entityId } });
    const byStatus = applications.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});
    const totalApproved = applications.reduce((sum, a) => sum + (a.amountApproved ? Number(a.amountApproved) : 0), 0);
    const totalDisbursed = applications.reduce((sum, a) => sum + (a.disbursedAmount ? Number(a.disbursedAmount) : 0), 0);
    return {
      totalApplications: applications.length,
      byStatus,
      totalAmountApproved: totalApproved,
      totalDisbursed,
      totalOutstanding: totalApproved - totalDisbursed,
    };
  }
}
