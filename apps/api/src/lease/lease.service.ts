import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaseStatus, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import {
  CreateLeaseDto,
  CreateTenantDto,
  EndTenancyDto,
  GenerateRentInvoiceDto,
  PostRentInvoiceDto,
  RenewLeaseDto,
  TerminateLeaseDto,
} from './dto/lease.dto';

const OPEN_LEASE_STATUSES: LeaseStatus[] = [LeaseStatus.DRAFT, LeaseStatus.ACTIVE];

@Injectable()
export class LeaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly accountsReceivable: AccountsReceivableService,
  ) {}

  // =====================================================================
  // TENANTS
  // =====================================================================

  async createTenant(dto: CreateTenantDto, createdById: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException(`Unit ${dto.unitId} not found`);

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer || !customer.isActive) throw new NotFoundException(`Customer ${dto.customerId} not found or inactive`);

    const existingActive = await this.prisma.tenant.findFirst({
      where: { unitId: dto.unitId, status: TenantStatus.ACTIVE },
    });
    if (existingActive) throw new ConflictException(`Unit ${dto.unitId} already has an active tenant`);

    return this.prisma.tenant.create({
      data: {
        entityId: dto.entityId,
        customerId: dto.customerId,
        unitId: dto.unitId,
        moveInDate: new Date(dto.moveInDate),
        notes: dto.notes,
        status: TenantStatus.ACTIVE,
        createdById,
      },
    });
  }

  findTenants(scope: SecurityScope, filters: { entityId?: string; unitId?: string; status?: TenantStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.tenant.findMany({
      where: { AND: [rls, filters] },
      include: { customer: true, unit: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { customer: true, unit: true, leases: { orderBy: { createdAt: 'desc' } } },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  private async requireTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async endTenancy(id: string, dto: EndTenancyDto) {
    const tenant = await this.requireTenant(id);
    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new ConflictException(`Only an ACTIVE tenancy can be ended (currently ${tenant.status})`);
    }
    const openLease = await this.prisma.lease.findFirst({
      where: { tenantId: id, status: { in: OPEN_LEASE_STATUSES } },
    });
    if (openLease) {
      throw new BadRequestException('This tenant has a DRAFT or ACTIVE lease — terminate it before ending the tenancy');
    }
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.FORMER, moveOutDate: new Date(dto.moveOutDate) },
    });
  }

  // =====================================================================
  // LEASES
  // =====================================================================

  async createLease(dto: CreateLeaseDto, createdById: string) {
    const tenant = await this.requireTenant(dto.tenantId);
    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new BadRequestException('Cannot create a lease for a tenant who is not ACTIVE');
    }
    if (tenant.unitId !== dto.unitId) {
      throw new BadRequestException('The lease unit must match the unit the tenant occupies');
    }

    const existing = await this.prisma.lease.findUnique({
      where: { entityId_leaseNumber: { entityId: dto.entityId, leaseNumber: dto.leaseNumber } },
    });
    if (existing) throw new ConflictException(`Lease "${dto.leaseNumber}" already exists for this entity`);

    const openLeaseOnUnit = await this.prisma.lease.findFirst({
      where: { unitId: dto.unitId, status: { in: OPEN_LEASE_STATUSES } },
    });
    if (openLeaseOnUnit) throw new ConflictException(`Unit ${dto.unitId} already has a DRAFT or ACTIVE lease`);

    return this.prisma.lease.create({
      data: {
        entityId: dto.entityId,
        tenantId: dto.tenantId,
        unitId: dto.unitId,
        leaseNumber: dto.leaseNumber,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        rentAmount: dto.rentAmount,
        rentFrequency: dto.rentFrequency,
        depositAmount: dto.depositAmount,
        status: LeaseStatus.DRAFT,
        createdById,
      },
    });
  }

  findLeases(scope: SecurityScope, filters: { entityId?: string; tenantId?: string; status?: LeaseStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.lease.findMany({
      where: { AND: [rls, filters] },
      include: { tenant: { include: { customer: true } }, unit: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLease(id: string) {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        tenant: { include: { customer: true } },
        unit: true,
        rentInvoices: { include: { arInvoice: true }, orderBy: { periodStart: 'desc' } },
      },
    });
    if (!lease) throw new NotFoundException(`Lease ${id} not found`);
    return lease;
  }

  private async requireLease(id: string) {
    const lease = await this.prisma.lease.findUnique({ where: { id } });
    if (!lease) throw new NotFoundException(`Lease ${id} not found`);
    return lease;
  }

  async activateLease(id: string) {
    const lease = await this.requireLease(id);
    if (lease.status !== LeaseStatus.DRAFT) {
      throw new ConflictException(`Only a DRAFT lease can be activated (currently ${lease.status})`);
    }
    return this.prisma.lease.update({ where: { id }, data: { status: LeaseStatus.ACTIVE } });
  }

  async renewLease(id: string, dto: RenewLeaseDto) {
    const lease = await this.requireLease(id);
    if (lease.status !== LeaseStatus.ACTIVE && lease.status !== LeaseStatus.EXPIRED) {
      throw new ConflictException(`Only an ACTIVE or EXPIRED lease can be renewed (currently ${lease.status})`);
    }
    return this.prisma.lease.update({
      where: { id },
      data: {
        status: LeaseStatus.ACTIVE,
        endDate: new Date(dto.newEndDate),
        rentAmount: dto.newRentAmount ?? lease.rentAmount,
      },
    });
  }

  async markExpired(id: string) {
    const lease = await this.requireLease(id);
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new ConflictException(`Only an ACTIVE lease can be marked EXPIRED (currently ${lease.status})`);
    }
    return this.prisma.lease.update({ where: { id }, data: { status: LeaseStatus.EXPIRED } });
  }

  async terminateLease(id: string, dto: TerminateLeaseDto) {
    const lease = await this.requireLease(id);
    if (lease.status !== LeaseStatus.DRAFT && lease.status !== LeaseStatus.ACTIVE) {
      throw new ConflictException(`Only a DRAFT or ACTIVE lease can be terminated (currently ${lease.status})`);
    }
    return this.prisma.lease.update({
      where: { id },
      data: {
        status: LeaseStatus.TERMINATED,
        terminatedAt: dto.terminatedAt ? new Date(dto.terminatedAt) : new Date(),
        terminationReason: dto.reason,
      },
    });
  }

  // =====================================================================
  // RENT INVOICING — thin wrapper around AccountsReceivableService; no
  // GL posting logic is duplicated here.
  // =====================================================================

  /**
   * Creates the ARInvoice for one rent period (DRAFT, unposted) via
   * AccountsReceivableService.createInvoice and links it to the lease.
   * allocationId is intentionally omitted — ARInvoice already supports
   * non-sale invoices for exactly this reason.
   */
  async generateRentInvoice(leaseId: string, dto: GenerateRentInvoiceDto, userId: string) {
    const lease = await this.requireLease(leaseId);
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new ConflictException(`Can only bill rent for an ACTIVE lease (currently ${lease.status})`);
    }
    const tenant = await this.requireTenant(lease.tenantId);

    const invoice = await this.accountsReceivable.createInvoice(
      {
        entityId: lease.entityId,
        invoiceNumber: dto.invoiceNumber,
        customerId: tenant.customerId,
        invoiceDate: dto.invoiceDate,
        dueDate: dto.dueDate,
        lines: [
          {
            description: `Rent ${dto.periodStart} to ${dto.periodEnd} — lease ${lease.leaseNumber}`,
            accountId: dto.revenueAccountId,
            quantity: 1,
            unitPrice: Number(lease.rentAmount),
          },
        ],
      },
      userId,
    );

    const rentInvoice = await this.prisma.leaseRentInvoice.create({
      data: {
        leaseId,
        arInvoiceId: invoice.id,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
      },
      include: { arInvoice: true },
    });

    return rentInvoice;
  }

  async postRentInvoice(leaseRentInvoiceId: string, dto: PostRentInvoiceDto, userId: string) {
    const rentInvoice = await this.prisma.leaseRentInvoice.findUnique({ where: { id: leaseRentInvoiceId } });
    if (!rentInvoice) throw new NotFoundException(`Lease rent invoice ${leaseRentInvoiceId} not found`);

    return this.accountsReceivable.postInvoice(rentInvoice.arInvoiceId, { arControlAccountId: dto.arControlAccountId }, userId);
  }

  // =====================================================================
  // DASHBOARD
  // =====================================================================

  /** Reused by DashboardService for the lease/rent-roll widget. */
  async getLeaseDashboardSummary(entityId?: string) {
    const leases = await this.prisma.lease.findMany({ where: { entityId } });
    const byStatus = leases.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});

    const sixtyDaysOut = new Date();
    sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
    const expiringSoon = await this.prisma.lease.count({
      where: { entityId, status: LeaseStatus.ACTIVE, endDate: { lte: sixtyDaysOut } },
    });

    // Only MONTHLY leases are summed into a rent-roll figure here — a
    // QUARTERLY/ANNUALLY mix would need frequency normalization that's
    // out of scope for this dashboard widget.
    const monthlyRentRoll = leases
      .filter((l) => l.status === LeaseStatus.ACTIVE && l.rentFrequency === 'MONTHLY')
      .reduce((sum, l) => sum + Number(l.rentAmount), 0);

    return { totalLeases: leases.length, byStatus, expiringWithin60Days: expiringSoon, monthlyRentRoll };
  }
}
