import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AllocationEventType, ReservationStatus, UnitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';

interface CreateInstallmentPlanDto {
  allocationId: string;
  installments: { dueDate: string; amountDue: number }[];
}

/**
 * FC-6.1 named this a "DTO type mismatch" against `ReserveUnitRequestDto`
 * (`dto/property-sales.dto.ts`) without resolving whether it was a real
 * runtime bug or an overly-strict type. FC-6.5 investigated directly:
 * every field matches except `expiresInHours`, which was `?`-optional
 * on the real DTO but required here. Reading `reserveUnit`'s own body
 * (below) shows it already treats this field defensively —
 * `dto.expiresInHours && dto.expiresInHours > 0 ? ... : DEFAULT_RESERVATION_HOURS`
 * — so an omitted value was always handled safely at runtime; only the
 * type annotation was wrong. Corrected to `?` to match both the real
 * DTO and the already-correct runtime behavior — not a behavior change.
 */
export interface ReserveUnitDto {
  unitId: string;
  customerId: string;
  entityId: string;
  projectId: string;
  expiresInHours?: number;
  reservationFee?: number;
}

export interface ConvertReservationDto {
  salePrice: number;
  allocationDate: string;
  invoiceNumber: string;
  revenueAccountId: string;
  arControlAccountId: string;
}

const DEFAULT_RESERVATION_HOURS = 72;

@Injectable()
export class RealEstateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly accountsReceivable: AccountsReceivableService,
  ) {}

  // ---- Estates ----

  async createEstate(entityId: string, code: string, name: string, description?: string, location?: string) {
    const existing = await this.prisma.estate.findUnique({ where: { entityId_code: { entityId, code } } });
    if (existing) throw new ConflictException(`Estate code "${code}" already exists for this entity`);
    return this.prisma.estate.create({ data: { entityId, code, name, description, location } });
  }

  findEstates(scope: SecurityScope, entityId?: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.estate.findMany({
      where: { AND: [rls, { entityId }] },
      include: { projects: true },
      orderBy: { code: 'asc' },
    });
  }

  // ---- Unit sale allocation ----

  async allocateUnit(unitId: string, customerId: string, salePrice: number, allocationDate: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException(`Unit ${unitId} not found`);
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException(`Unit ${unit.code} is not AVAILABLE (currently ${unit.status})`);
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);
    if (salePrice <= 0) throw new BadRequestException('Sale price must be positive');

    const [allocation] = await this.prisma.$transaction([
      this.prisma.unitSaleAllocation.create({
        data: {
          unitId,
          customerId,
          salePrice,
          allocationDate: new Date(allocationDate),
          status: UnitStatus.RESERVED,
        },
      }),
      this.prisma.unit.update({ where: { id: unitId }, data: { status: UnitStatus.RESERVED } }),
    ]);

    return allocation;
  }

  async updateUnitStatus(unitId: string, status: UnitStatus) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException(`Unit ${unitId} not found`);
    return this.prisma.unit.update({ where: { id: unitId }, data: { status } });
  }

  // ---- Installment schedules ----

  async createInstallmentSchedule(dto: CreateInstallmentPlanDto) {
    const allocation = await this.prisma.unitSaleAllocation.findUnique({
      where: { id: dto.allocationId },
      include: { installmentSchedule: true },
    });
    if (!allocation) throw new NotFoundException(`Allocation ${dto.allocationId} not found`);
    if (allocation.installmentSchedule) {
      throw new ConflictException('This allocation already has an installment schedule');
    }

    const totalScheduled = dto.installments.reduce((sum, i) => sum + i.amountDue, 0);
    if (Math.abs(totalScheduled - Number(allocation.salePrice)) > 0.01) {
      throw new BadRequestException(
        `Installment total (${totalScheduled}) does not match the sale price (${allocation.salePrice})`,
      );
    }

    return this.prisma.installmentSchedule.create({
      data: {
        unitId: allocation.unitId,
        customerId: allocation.customerId,
        allocationId: allocation.id,
        totalAmount: allocation.salePrice,
        lines: {
          create: dto.installments.map((i) => ({
            dueDate: new Date(i.dueDate),
            amountDue: i.amountDue,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async getSchedule(allocationId: string) {
    const schedule = await this.prisma.installmentSchedule.findUnique({
      where: { allocationId },
      include: { lines: { orderBy: { dueDate: 'asc' } }, unit: true, customer: true },
    });
    if (!schedule) throw new NotFoundException(`No installment schedule for allocation ${allocationId}`);
    return schedule;
  }

  /** Every unit + schedule + running balance for a given customer — the source data for a statement. */
  async getCustomerStatement(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    const allocations = await this.prisma.unitSaleAllocation.findMany({
      where: { customerId },
      include: {
        unit: { include: { floor: { include: { block: { include: { phase: { include: { project: true } } } } } } } },
        installmentSchedule: { include: { lines: { orderBy: { dueDate: 'asc' } } } },
      },
      orderBy: { allocationDate: 'asc' },
    });

    const positions = allocations.map((a) => {
      const lines = a.installmentSchedule?.lines ?? [];
      const totalPaid = lines.reduce((sum, l) => sum + Number(l.amountPaid), 0);
      const totalDue = lines.reduce((sum, l) => sum + Number(l.amountDue), 0);
      return {
        allocationId: a.id,
        unitCode: a.unit.code,
        salePrice: Number(a.salePrice),
        status: a.status,
        allocationDate: a.allocationDate,
        totalDue,
        totalPaid,
        outstandingBalance: totalDue - totalPaid,
        installments: lines,
      };
    });

    return {
      customer: { id: customer.id, code: customer.code, name: customer.name },
      positions,
      grandTotalOutstanding: positions.reduce((sum, p) => sum + p.outstandingBalance, 0),
    };
  }

  // =====================================================================
  // PHASE 4 — PROPERTY SALES COMPLETION
  // =====================================================================

  // ---- Reservations ----

  async reserveUnit(dto: ReserveUnitDto, userId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException(`Unit ${dto.unitId} not found`);
    if (unit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException(`Unit ${unit.code} is not AVAILABLE (currently ${unit.status})`);
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);

    const activeReservation = await this.prisma.unitReservation.findFirst({
      where: { unitId: dto.unitId, status: ReservationStatus.ACTIVE },
    });
    if (activeReservation) {
      throw new ConflictException(`Unit ${unit.code} already has an active reservation`);
    }

    const priorCancelledAllocation = await this.prisma.unitSaleAllocation.findFirst({
      where: { unitId: dto.unitId, isCancelled: true },
    });
    const isResale = !!priorCancelledAllocation;

    const expiresInHours =
      dto.expiresInHours && dto.expiresInHours > 0 ? dto.expiresInHours : DEFAULT_RESERVATION_HOURS;
    const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000);

    const [reservation] = await this.prisma.$transaction([
      this.prisma.unitReservation.create({
        data: {
          unitId: dto.unitId,
          customerId: dto.customerId,
          entityId: dto.entityId,
          projectId: dto.projectId,
          reservationFee: dto.reservationFee,
          expiresAt,
          isResale,
          createdById: userId,
        },
      }),
      this.prisma.unit.update({ where: { id: dto.unitId }, data: { status: UnitStatus.RESERVED } }),
    ]);

    await this.logEvent({
      unitId: dto.unitId,
      reservationId: reservation.id,
      eventType: AllocationEventType.RESERVED,
      toCustomerId: dto.customerId,
      createdById: userId,
    });

    return reservation;
  }

  /**
   * Expires every reservation past its expiresAt that's still ACTIVE, and
   * returns the units to AVAILABLE. Idempotent — safe to call repeatedly
   * (e.g. from a scheduled worker job); reservations already
   * CONVERTED/CANCELLED/EXPIRED are untouched. Intended to be invoked by
   * apps/worker on a schedule; not wired to a queue job in this pass (see
   * the Phase 4 report) — call it manually via the admin endpoint until then.
   */
  async expireStaleReservations(): Promise<{ expiredCount: number }> {
    const stale = await this.prisma.unitReservation.findMany({
      where: { status: ReservationStatus.ACTIVE, expiresAt: { lt: new Date() } },
    });

    for (const reservation of stale) {
      await this.prisma.$transaction([
        this.prisma.unitReservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.EXPIRED },
        }),
        this.prisma.unit.updateMany({
          where: { id: reservation.unitId, status: UnitStatus.RESERVED },
          data: { status: UnitStatus.AVAILABLE },
        }),
      ]);
      await this.logEvent({
        unitId: reservation.unitId,
        reservationId: reservation.id,
        eventType: AllocationEventType.RESERVATION_EXPIRED,
        fromCustomerId: reservation.customerId,
        createdById: reservation.createdById,
      });
    }

    return { expiredCount: stale.length };
  }

  async cancelReservation(reservationId: string, userId: string, reason: string) {
    const reservation = await this.prisma.unitReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} not found`);
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new ConflictException(`Cannot cancel a reservation with status ${reservation.status}`);
    }

    await this.prisma.$transaction([
      this.prisma.unitReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELLED, cancelledReason: reason, cancelledById: userId },
      }),
      this.prisma.unit.updateMany({
        where: { id: reservation.unitId, status: UnitStatus.RESERVED },
        data: { status: UnitStatus.AVAILABLE },
      }),
    ]);

    await this.logEvent({
      unitId: reservation.unitId,
      reservationId,
      eventType: AllocationEventType.RESERVATION_CANCELLED,
      fromCustomerId: reservation.customerId,
      notes: reason,
      createdById: userId,
    });

    return { reservationId, status: ReservationStatus.CANCELLED };
  }

  // ---- Conversion (reservation -> confirmed sale) ----

  /**
   * Converts an ACTIVE reservation into a confirmed sale: creates the
   * UnitSaleAllocation, then raises and posts an AR invoice through
   * AccountsReceivableService — reusing its existing createInvoice/
   * postInvoice flow (and therefore PostingEngineService) rather than
   * duplicating any GL posting logic here.
   */
  async convertReservationToSale(reservationId: string, dto: ConvertReservationDto, userId: string) {
    const reservation = await this.prisma.unitReservation.findUnique({
      where: { id: reservationId },
      include: { unit: true },
    });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} not found`);
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new ConflictException(`Cannot convert a reservation with status ${reservation.status}`);
    }
    if (reservation.expiresAt.getTime() < Date.now()) {
      throw new ConflictException('This reservation has expired — expire it and create a new reservation instead');
    }
    if (dto.salePrice <= 0) throw new BadRequestException('Sale price must be positive');

    const allocation = await this.prisma.unitSaleAllocation.create({
      data: {
        unitId: reservation.unitId,
        customerId: reservation.customerId,
        salePrice: dto.salePrice,
        allocationDate: new Date(dto.allocationDate),
        status: UnitStatus.ALLOCATED,
      },
    });

    await this.prisma.unitReservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONVERTED, convertedAllocationId: allocation.id },
    });
    await this.prisma.unit.update({ where: { id: reservation.unitId }, data: { status: UnitStatus.ALLOCATED } });

    // Reuses the existing AR module end-to-end — no bespoke posting logic here.
    const invoice = await this.accountsReceivable.createInvoice(
      {
        entityId: reservation.entityId,
        invoiceNumber: dto.invoiceNumber,
        customerId: reservation.customerId,
        allocationId: allocation.id,
        invoiceDate: dto.allocationDate,
        lines: [
          {
            description: `Unit sale — ${reservation.unit.code}`,
            accountId: dto.revenueAccountId,
            quantity: 1,
            unitPrice: dto.salePrice,
            projectId: reservation.projectId,
          },
        ],
      },
      userId,
    );
    const posted = await this.accountsReceivable.postInvoice(
      invoice.id,
      { arControlAccountId: dto.arControlAccountId },
      userId,
    );

    await this.logEvent({
      unitId: reservation.unitId,
      allocationId: allocation.id,
      reservationId,
      eventType: reservation.isResale ? AllocationEventType.RESOLD : AllocationEventType.CONVERTED_TO_SALE,
      toCustomerId: reservation.customerId,
      createdById: userId,
    });

    return { allocation, invoice, posting: posted };
  }

  // ---- Cancellation ----

  /**
   * Marks a sale cancelled and returns the unit to AVAILABLE. Does NOT
   * touch any AR invoice already posted for this allocation — that's
   * real financial history and, per this schema's deletion policy, is
   * never unwound automatically. A credit note / write-off against the
   * existing invoice is a separate, deliberate AR action this method does
   * not perform; see the Phase 4 report for why that's out of scope here.
   */
  async cancelAllocation(allocationId: string, userId: string, reason: string) {
    const allocation = await this.prisma.unitSaleAllocation.findUnique({ where: { id: allocationId } });
    if (!allocation) throw new NotFoundException(`Allocation ${allocationId} not found`);
    if (allocation.isCancelled) throw new ConflictException('This allocation is already cancelled');
    if (allocation.status === UnitStatus.HANDED_OVER || allocation.status === UnitStatus.SOLD) {
      throw new ConflictException(`Cannot cancel an allocation with status ${allocation.status}`);
    }

    await this.prisma.$transaction([
      this.prisma.unitSaleAllocation.update({
        where: { id: allocationId },
        data: { isCancelled: true, cancelledAt: new Date(), cancelledReason: reason, cancelledById: userId },
      }),
      this.prisma.unit.update({ where: { id: allocation.unitId }, data: { status: UnitStatus.AVAILABLE } }),
    ]);

    await this.logEvent({
      unitId: allocation.unitId,
      allocationId,
      eventType: AllocationEventType.SALE_CANCELLED,
      fromCustomerId: allocation.customerId,
      notes: reason,
      createdById: userId,
    });

    return { allocationId, cancelled: true };
  }

  // ---- Transfer & swap ----

  /**
   * Transfers an allocation to a different customer (same unit). Cancels
   * the original allocation and creates a new one linked via
   * transferredFromAllocationId, rather than mutating customerId in place,
   * so the full history survives. Any existing installment schedule / AR
   * invoice stays attached to the ORIGINAL (now-cancelled) allocation —
   * reassigning in-flight financial records to a new customer is a
   * deliberate AR/finance decision this method does not make automatically;
   * see the Phase 4 report.
   */
  async transferAllocation(allocationId: string, newCustomerId: string, userId: string, reason: string) {
    const original = await this.prisma.unitSaleAllocation.findUnique({ where: { id: allocationId } });
    if (!original) throw new NotFoundException(`Allocation ${allocationId} not found`);
    if (original.isCancelled) throw new ConflictException('Cannot transfer a cancelled allocation');
    if (original.status === UnitStatus.HANDED_OVER || original.status === UnitStatus.SOLD) {
      throw new ConflictException(`Cannot transfer an allocation with status ${original.status}`);
    }
    const newCustomer = await this.prisma.customer.findUnique({ where: { id: newCustomerId } });
    if (!newCustomer) throw new NotFoundException(`Customer ${newCustomerId} not found`);

    const [, replacement] = await this.prisma.$transaction([
      this.prisma.unitSaleAllocation.update({
        where: { id: allocationId },
        data: { isCancelled: true, cancelledAt: new Date(), cancelledReason: `TRANSFER: ${reason}`, cancelledById: userId },
      }),
      this.prisma.unitSaleAllocation.create({
        data: {
          unitId: original.unitId,
          customerId: newCustomerId,
          salePrice: original.salePrice,
          allocationDate: new Date(),
          status: original.status,
          transferredFromAllocationId: original.id,
        },
      }),
    ]);

    await this.logEvent({
      unitId: original.unitId,
      allocationId: replacement.id,
      eventType: AllocationEventType.TRANSFERRED,
      fromCustomerId: original.customerId,
      toCustomerId: newCustomerId,
      notes: reason,
      createdById: userId,
    });

    return { previousAllocationId: original.id, newAllocation: replacement };
  }

  /**
   * Swaps a customer from one unit to another. Same lineage/limitations as
   * transferAllocation — see its doc comment (installment schedule / AR
   * invoice reassignment is a deliberate follow-up action, not automatic).
   */
  async swapUnitAllocation(allocationId: string, newUnitId: string, userId: string, reason: string) {
    const original = await this.prisma.unitSaleAllocation.findUnique({ where: { id: allocationId } });
    if (!original) throw new NotFoundException(`Allocation ${allocationId} not found`);
    if (original.isCancelled) throw new ConflictException('Cannot swap a cancelled allocation');
    if (original.status === UnitStatus.HANDED_OVER || original.status === UnitStatus.SOLD) {
      throw new ConflictException(`Cannot swap an allocation with status ${original.status}`);
    }

    const newUnit = await this.prisma.unit.findUnique({ where: { id: newUnitId } });
    if (!newUnit) throw new NotFoundException(`Unit ${newUnitId} not found`);
    if (newUnit.status !== UnitStatus.AVAILABLE) {
      throw new ConflictException(`Unit ${newUnit.code} is not AVAILABLE (currently ${newUnit.status})`);
    }

    const [, , replacement] = await this.prisma.$transaction([
      this.prisma.unitSaleAllocation.update({
        where: { id: allocationId },
        data: { isCancelled: true, cancelledAt: new Date(), cancelledReason: `SWAP: ${reason}`, cancelledById: userId },
      }),
      this.prisma.unit.update({ where: { id: original.unitId }, data: { status: UnitStatus.AVAILABLE } }),
      this.prisma.unitSaleAllocation.create({
        data: {
          unitId: newUnitId,
          customerId: original.customerId,
          salePrice: original.salePrice,
          allocationDate: new Date(),
          status: original.status,
          transferredFromAllocationId: original.id,
        },
      }),
    ]);
    await this.prisma.unit.update({ where: { id: newUnitId }, data: { status: original.status } });

    await this.logEvent({
      unitId: newUnitId,
      allocationId: replacement.id,
      eventType: AllocationEventType.SWAPPED,
      fromCustomerId: original.customerId,
      toCustomerId: original.customerId,
      notes: `Swapped from unit ${original.unitId}: ${reason}`,
      createdById: userId,
    });

    return { previousAllocationId: original.id, newAllocation: replacement };
  }

  // ---- History & pipeline ----

  async getAllocationHistory(unitId: string) {
    return this.prisma.unitAllocationEvent.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
      include: { fromCustomer: true, toCustomer: true, createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  /** Lightweight pipeline counts, reusable by Dashboard/Reporting without duplicating this query there. */
  async getReservationPipelineSummary(entityId?: string) {
    const where = entityId ? { entityId } : {};
    const [active, expiringSoon, convertedThisMonth, cancelledThisMonth] = await Promise.all([
      this.prisma.unitReservation.count({ where: { ...where, status: ReservationStatus.ACTIVE } }),
      this.prisma.unitReservation.count({
        where: { ...where, status: ReservationStatus.ACTIVE, expiresAt: { lt: new Date(Date.now() + 48 * 3_600_000) } },
      }),
      this.prisma.unitReservation.count({
        where: { ...where, status: ReservationStatus.CONVERTED, createdAt: { gte: startOfMonth() } },
      }),
      this.prisma.unitReservation.count({
        where: { ...where, status: ReservationStatus.CANCELLED, createdAt: { gte: startOfMonth() } },
      }),
    ]);
    return { active, expiringSoon, convertedThisMonth, cancelledThisMonth };
  }

  private async logEvent(params: {
    unitId: string;
    allocationId?: string;
    reservationId?: string;
    eventType: AllocationEventType;
    fromCustomerId?: string;
    toCustomerId?: string;
    notes?: string;
    createdById: string;
  }) {
    await this.prisma.unitAllocationEvent.create({ data: params });
  }
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
