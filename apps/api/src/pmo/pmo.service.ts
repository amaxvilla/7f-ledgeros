import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PmoDocStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';

interface CreateBoqDto {
  projectId: string;
  phaseId?: string;
  contractorId?: string;
  title: string;
  createdById: string;
  lines: { itemCode: string; description: string; unit: string; quantity: number; rate: number }[];
}

interface CreateWorkPackageDto {
  projectId: string;
  phaseId?: string;
  contractorId: string;
  code: string;
  name: string;
  description?: string;
  budgetAmount: number;
  createdById: string;
}

interface CreateProgressValuationDto {
  workPackageId: string;
  valuationDate: string;
  percentComplete: number;
  valuationAmount: number; // cumulative gross value of work done to date
  createdById: string;
}

interface GenerateCertificateDto {
  progressValuationId: string;
  certificateNumber: string;
  retentionPercent: number;
  issuedDate: string;
  createdById: string;
}

interface CreateVariationOrderDto {
  workPackageId: string;
  voNumber: string;
  description: string;
  amount: number;
  createdById: string;
}

// The workflow every PMO document type moves through.
const WORKFLOW_ORDER: PmoDocStatus[] = [
  PmoDocStatus.DRAFT,
  PmoDocStatus.REVIEWED,
  PmoDocStatus.APPROVED,
  PmoDocStatus.CERTIFIED,
];

@Injectable()
export class PmoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // BOQ
  // -------------------------------------------------------------------

  async createBoq(dto: CreateBoqDto) {
    if (dto.lines.length === 0) throw new BadRequestException('BOQ needs at least one line');
    return this.prisma.boq.create({
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        contractorId: dto.contractorId,
        title: dto.title,
        createdById: dto.createdById,
        status: PmoDocStatus.DRAFT,
        lines: {
          create: dto.lines.map((l) => ({
            itemCode: l.itemCode,
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            rate: l.rate,
            amount: l.quantity * l.rate,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findBoqs(scope: SecurityScope, projectId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['project'] });
    return this.prisma.boq.findMany({
      where: { AND: [rls, { projectId }] },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  advanceBoqStatus(id: string, target: PmoDocStatus) {
    return this.advanceGeneric('boq', id, target);
  }

  // -------------------------------------------------------------------
  // Work Packages
  // -------------------------------------------------------------------

  async createWorkPackage(dto: CreateWorkPackageDto) {
    const existing = await this.prisma.workPackage.findUnique({
      where: { projectId_code: { projectId: dto.projectId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Work package code "${dto.code}" already exists on this project`);
    if (dto.budgetAmount <= 0) throw new BadRequestException('Budget amount must be positive');

    return this.prisma.workPackage.create({
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        contractorId: dto.contractorId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        budgetAmount: dto.budgetAmount,
        createdById: dto.createdById,
        status: PmoDocStatus.DRAFT,
      },
    });
  }

  findWorkPackages(scope: SecurityScope, projectId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['project'] });
    return this.prisma.workPackage.findMany({
      where: { AND: [rls, { projectId }] },
      include: { contractor: { include: { vendor: true } } },
      orderBy: { code: 'asc' },
    });
  }

  advanceWorkPackageStatus(id: string, target: PmoDocStatus) {
    return this.advanceGeneric('workPackage', id, target);
  }

  // -------------------------------------------------------------------
  // Progress Valuations & Interim Payment Certificates
  // -------------------------------------------------------------------

  async createProgressValuation(dto: CreateProgressValuationDto) {
    if (dto.percentComplete < 0 || dto.percentComplete > 100) {
      throw new BadRequestException('Percent complete must be between 0 and 100');
    }
    const workPackage = await this.prisma.workPackage.findUnique({ where: { id: dto.workPackageId } });
    if (!workPackage) throw new NotFoundException(`Work package ${dto.workPackageId} not found`);

    const lastValuation = await this.prisma.progressValuation.findFirst({
      where: { workPackageId: dto.workPackageId },
      orderBy: { valuationNumber: 'desc' },
    });
    const valuationNumber = (lastValuation?.valuationNumber ?? 0) + 1;

    return this.prisma.progressValuation.create({
      data: {
        workPackageId: dto.workPackageId,
        valuationNumber,
        valuationDate: new Date(dto.valuationDate),
        percentComplete: dto.percentComplete,
        valuationAmount: dto.valuationAmount,
        createdById: dto.createdById,
        status: PmoDocStatus.DRAFT,
      },
    });
  }

  findProgressValuations(workPackageId: string) {
    return this.prisma.progressValuation.findMany({
      where: { workPackageId },
      include: { certificate: true },
      orderBy: { valuationNumber: 'asc' },
    });
  }

  advanceProgressValuationStatus(id: string, target: PmoDocStatus) {
    return this.advanceGeneric('progressValuation', id, target);
  }

  /**
   * Standard interim-certificate arithmetic:
   *   retentionAmount = grossValuationAmount * retentionPercent%
   *   netCumulative    = grossValuationAmount - retentionAmount
   *   netPayable       = netCumulative - (sum of net payable on all prior
   *                       CERTIFIED certificates for this work package)
   * `grossValuationAmount` is the *cumulative* value of work done to date,
   * matching how ProgressValuation.valuationAmount is recorded.
   */
  async generateCertificate(dto: GenerateCertificateDto) {
    if (dto.retentionPercent < 0 || dto.retentionPercent > 100) {
      throw new BadRequestException('Retention percent must be between 0 and 100');
    }

    const valuation = await this.prisma.progressValuation.findUnique({
      where: { id: dto.progressValuationId },
      include: { certificate: true, workPackage: true },
    });
    if (!valuation) throw new NotFoundException(`Progress valuation ${dto.progressValuationId} not found`);
    if (valuation.status !== PmoDocStatus.APPROVED) {
      throw new ConflictException('Progress valuation must be APPROVED before a certificate can be issued');
    }
    if (valuation.certificate) {
      throw new ConflictException('This progress valuation already has a certificate');
    }

    const priorCertificates = await this.prisma.interimPaymentCertificate.findMany({
      where: {
        status: PmoDocStatus.CERTIFIED,
        progressValuation: { workPackageId: valuation.workPackageId },
      },
    });
    const previousCertifiedAmount = priorCertificates.reduce((sum, c) => sum + Number(c.netPayableAmount), 0);

    const grossValuationAmount = Number(valuation.valuationAmount);
    const retentionAmount = (grossValuationAmount * dto.retentionPercent) / 100;
    const netCumulative = grossValuationAmount - retentionAmount;
    const netPayableAmount = netCumulative - previousCertifiedAmount;

    return this.prisma.interimPaymentCertificate.create({
      data: {
        progressValuationId: dto.progressValuationId,
        certificateNumber: dto.certificateNumber,
        grossValuationAmount,
        retentionPercent: dto.retentionPercent,
        retentionAmount,
        previousCertifiedAmount,
        netPayableAmount,
        issuedDate: new Date(dto.issuedDate),
        createdById: dto.createdById,
        status: PmoDocStatus.DRAFT,
      },
    });
  }

  /**
   * Certifying an IPC also rolls its retention into the work package's
   * running Retention record, creating it on first use.
   */
  async advanceCertificateStatus(id: string, target: PmoDocStatus) {
    const updated = await this.advanceGeneric('interimPaymentCertificate', id, target);

    if (target === PmoDocStatus.CERTIFIED) {
      const cert = await this.prisma.interimPaymentCertificate.findUniqueOrThrow({
        where: { id },
        include: { progressValuation: true },
      });
      const workPackageId = cert.progressValuation.workPackageId;

      const existing = await this.prisma.retention.findUnique({ where: { workPackageId } });
      if (existing) {
        await this.prisma.retention.update({
          where: { workPackageId },
          data: { totalHeld: Number(existing.totalHeld) + Number(cert.retentionAmount) },
        });
      } else {
        await this.prisma.retention.create({
          data: {
            workPackageId,
            retentionPercent: cert.retentionPercent,
            totalHeld: cert.retentionAmount,
          },
        });
      }
    }

    return updated;
  }

  // -------------------------------------------------------------------
  // Variation Orders
  // -------------------------------------------------------------------

  async createVariationOrder(dto: CreateVariationOrderDto) {
    const existing = await this.prisma.variationOrder.findUnique({
      where: { workPackageId_voNumber: { workPackageId: dto.workPackageId, voNumber: dto.voNumber } },
    });
    if (existing) throw new ConflictException(`Variation order "${dto.voNumber}" already exists on this work package`);

    return this.prisma.variationOrder.create({
      data: {
        workPackageId: dto.workPackageId,
        voNumber: dto.voNumber,
        description: dto.description,
        amount: dto.amount,
        createdById: dto.createdById,
        status: PmoDocStatus.DRAFT,
      },
    });
  }

  findVariationOrders(workPackageId: string) {
    return this.prisma.variationOrder.findMany({ where: { workPackageId }, orderBy: { voNumber: 'asc' } });
  }

  advanceVariationOrderStatus(id: string, target: PmoDocStatus) {
    return this.advanceGeneric('variationOrder', id, target);
  }

  // -------------------------------------------------------------------
  // Retention
  // -------------------------------------------------------------------

  async getRetention(workPackageId: string) {
    const retention = await this.prisma.retention.findUnique({
      where: { workPackageId },
      include: { releases: { orderBy: { releaseDate: 'asc' } } },
    });
    if (!retention) throw new NotFoundException(`No retention record for work package ${workPackageId}`);
    return retention;
  }

  async releaseRetention(retentionId: string, amount: number, releaseDate: string, createdById: string) {
    if (amount <= 0) throw new BadRequestException('Release amount must be positive');
    const retention = await this.prisma.retention.findUnique({ where: { id: retentionId } });
    if (!retention) throw new NotFoundException(`Retention ${retentionId} not found`);

    const available = Number(retention.totalHeld) - Number(retention.totalReleased);
    if (amount > available + 0.01) {
      throw new BadRequestException(`Cannot release ${amount}: only ${available} of retention is available`);
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.retentionRelease.create({
        data: { retentionId, amount, releaseDate: new Date(releaseDate), createdById },
      }),
      this.prisma.retention.update({
        where: { id: retentionId },
        data: { totalReleased: Number(retention.totalReleased) + amount },
      }),
    ]);

    return updated;
  }

  // -------------------------------------------------------------------
  // Final Account
  // -------------------------------------------------------------------

  /**
   * Simplified final-account roll-up: original contract sum (the work
   * package's initial budget) plus approved/certified variations, set
   * against the latest certified cumulative valuation and retention
   * currently held. A production QS final account would additionally
   * reconcile against measured-and-agreed quantities line by line.
   */
  async computeFinalAccount(workPackageId: string, createdById: string) {
    const workPackage = await this.prisma.workPackage.findUnique({ where: { id: workPackageId } });
    if (!workPackage) throw new NotFoundException(`Work package ${workPackageId} not found`);

    const existing = await this.prisma.finalAccount.findUnique({ where: { workPackageId } });
    if (existing) throw new ConflictException('A final account already exists for this work package');

    const variationOrders = await this.prisma.variationOrder.findMany({
      where: { workPackageId, status: { in: [PmoDocStatus.APPROVED, PmoDocStatus.CERTIFIED] } },
    });
    const totalVariations = variationOrders.reduce((sum, v) => sum + Number(v.amount), 0);

    const latestCertifiedIpc = await this.prisma.interimPaymentCertificate.findFirst({
      where: { status: PmoDocStatus.CERTIFIED, progressValuation: { workPackageId } },
      orderBy: { issuedDate: 'desc' },
    });
    const totalCertified = latestCertifiedIpc ? Number(latestCertifiedIpc.grossValuationAmount) : 0;

    const retention = await this.prisma.retention.findUnique({ where: { workPackageId } });
    const totalRetentionHeld = retention ? Number(retention.totalHeld) - Number(retention.totalReleased) : 0;

    const originalContractSum = Number(workPackage.budgetAmount);
    const finalAccountAmount = originalContractSum + totalVariations;

    return this.prisma.finalAccount.create({
      data: {
        workPackageId,
        originalContractSum,
        totalVariations,
        totalCertified,
        totalRetentionHeld,
        finalAccountAmount,
        createdById,
        status: PmoDocStatus.DRAFT,
      },
    });
  }

  advanceFinalAccountStatus(id: string, target: PmoDocStatus) {
    return this.advanceGeneric('finalAccount', id, target);
  }

  // -------------------------------------------------------------------
  // Generic workflow transition, shared by every PMO document type
  // -------------------------------------------------------------------

  private async advanceGeneric(
    model: 'boq' | 'workPackage' | 'progressValuation' | 'interimPaymentCertificate' | 'variationOrder' | 'finalAccount',
    id: string,
    target: PmoDocStatus,
  ) {
    const record = await (this.prisma[model] as any).findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`${model} ${id} not found`);

    if (target === PmoDocStatus.REJECTED) {
      if (record.status === PmoDocStatus.CERTIFIED) {
        throw new ConflictException('A certified document cannot be rejected — issue a variation instead');
      }
      return (this.prisma[model] as any).update({ where: { id }, data: { status: PmoDocStatus.REJECTED } });
    }

    const currentIndex = WORKFLOW_ORDER.indexOf(record.status);
    const targetIndex = WORKFLOW_ORDER.indexOf(target);
    if (currentIndex === -1 || targetIndex !== currentIndex + 1) {
      throw new ConflictException(
        `Cannot move ${model} from ${record.status} to ${target} — workflow only advances one step at a time (${WORKFLOW_ORDER.join(' -> ')})`,
      );
    }

    return (this.prisma[model] as any).update({ where: { id }, data: { status: target } });
  }
}
