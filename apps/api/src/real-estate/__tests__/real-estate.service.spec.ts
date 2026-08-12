import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationStatus, UnitStatus } from '@prisma/client';
import { RealEstateService } from '../real-estate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';
import { AccountsReceivableService } from '../../accounts-receivable/accounts-receivable.service';

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

/**
 * NOTE: this module had zero test coverage before Phase 2. The RLS block
 * below covers the RLS wiring added in that slice (findEstates);
 * createEstate and the installment-plan methods are pre-existing and still
 * untested — that gap predates this change and is worth closing separately.
 * The "Phase 4" block covers the Property Sales completion methods added
 * in this slice.
 */
describe('RealEstateService', () => {
  let service: RealEstateService;
  let prisma: any;
  let accountsReceivable: any;

  beforeEach(async () => {
    prisma = {
      estate: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      unit: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      customer: { findUnique: jest.fn() },
      unitReservation: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      unitSaleAllocation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      unitAllocationEvent: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };
    accountsReceivable = {
      createInvoice: jest.fn(),
      postInvoice: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RealEstateService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsReceivableService, useValue: accountsReceivable },
      ],
    }).compile();

    service = moduleRef.get(RealEstateService);
  });

  describe('Row Level Security (Phase 2)', () => {
    it("findEstates scopes results to the caller's viewable entities", async () => {
      prisma.estate.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      };

      await service.findEstates(scope, undefined);

      expect(prisma.estate.findMany).toHaveBeenCalledWith({
        where: { AND: [{ entityId: { in: ['ent-1'] } }, { entityId: undefined }] },
        include: { projects: true },
        orderBy: { code: 'asc' },
      });
    });

    it('findEstates is unrestricted for a system admin', async () => {
      prisma.estate.findMany.mockResolvedValue([]);
      await service.findEstates(buildUnrestrictedScope(), undefined);

      expect(prisma.estate.findMany).toHaveBeenCalledWith({
        where: { AND: [{}, { entityId: undefined }] },
        include: { projects: true },
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('Phase 4 — Property Sales completion', () => {
    const baseUnit = { id: 'unit-1', code: 'A-1-01', status: UnitStatus.AVAILABLE };
    const baseReservationDto = {
      unitId: 'unit-1',
      customerId: 'cust-1',
      entityId: 'ent-1',
      projectId: 'proj-1',
      expiresInHours: 72,
    };

    describe('reserveUnit', () => {
      it('rejects reserving a unit that is not AVAILABLE', async () => {
        prisma.unit.findUnique.mockResolvedValue({ ...baseUnit, status: UnitStatus.RESERVED });

        await expect(service.reserveUnit(baseReservationDto, 'user-1')).rejects.toThrow(ConflictException);
      });

      it('rejects a second active reservation on the same unit', async () => {
        prisma.unit.findUnique.mockResolvedValue(baseUnit);
        prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
        prisma.unitReservation.findFirst.mockResolvedValue({ id: 'existing-res', status: ReservationStatus.ACTIVE });

        await expect(service.reserveUnit(baseReservationDto, 'user-1')).rejects.toThrow(ConflictException);
      });

      it('creates a reservation, marks the unit RESERVED, and logs a RESERVED event', async () => {
        prisma.unit.findUnique.mockResolvedValue(baseUnit);
        prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
        prisma.unitReservation.findFirst.mockResolvedValue(null);
        prisma.unitSaleAllocation.findFirst.mockResolvedValue(null); // no prior cancelled allocation -> not a resale
        prisma.unitReservation.create.mockResolvedValue({ id: 'res-1', ...baseReservationDto, isResale: false });
        prisma.unit.update.mockResolvedValue({ ...baseUnit, status: UnitStatus.RESERVED });

        const result = await service.reserveUnit(baseReservationDto, 'user-1');

        expect(result.id).toBe('res-1');
        expect(prisma.unitReservation.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ unitId: 'unit-1', isResale: false }) }),
        );
        expect(prisma.unitAllocationEvent.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ eventType: 'RESERVED' }) }),
        );
      });

      it('flags a reservation as a resale when the unit has a prior cancelled allocation', async () => {
        prisma.unit.findUnique.mockResolvedValue(baseUnit);
        prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
        prisma.unitReservation.findFirst.mockResolvedValue(null);
        prisma.unitSaleAllocation.findFirst.mockResolvedValue({ id: 'old-alloc', isCancelled: true });
        prisma.unitReservation.create.mockResolvedValue({ id: 'res-2', isResale: true });
        prisma.unit.update.mockResolvedValue(baseUnit);

        await service.reserveUnit(baseReservationDto, 'user-1');

        expect(prisma.unitReservation.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ isResale: true }) }),
        );
      });

      // FC-6.5 — regression test for the fix above: `expiresInHours` is
      // genuinely optional (both on the real DTO and, now, on this
      // interface); this exercises the DEFAULT_RESERVATION_HOURS
      // fallback path directly, which no existing test in this describe
      // block reached (every other case here always supplies 72
      // explicitly via `baseReservationDto`).
      it('defaults expiresAt to 72 hours out when expiresInHours is omitted', async () => {
        const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();
        jest.useFakeTimers({ now: NOW });

        const { expiresInHours: _omitted, ...dtoWithoutExpiry } = baseReservationDto;
        prisma.unit.findUnique.mockResolvedValue(baseUnit);
        prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
        prisma.unitReservation.findFirst.mockResolvedValue(null);
        prisma.unitSaleAllocation.findFirst.mockResolvedValue(null);
        prisma.unitReservation.create.mockResolvedValue({ id: 'res-3', isResale: false });
        prisma.unit.update.mockResolvedValue(baseUnit);

        await service.reserveUnit(dtoWithoutExpiry, 'user-1');

        const expectedExpiresAt = new Date(NOW + 72 * 3_600_000);
        expect(prisma.unitReservation.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ expiresAt: expectedExpiresAt }) }),
        );

        jest.useRealTimers();
      });
    });

    describe('expireStaleReservations', () => {
      it('expires stale ACTIVE reservations and returns their units to AVAILABLE', async () => {
        prisma.unitReservation.findMany.mockResolvedValue([
          { id: 'res-1', unitId: 'unit-1', customerId: 'cust-1', createdById: 'user-1' },
        ]);

        const result = await service.expireStaleReservations();

        expect(result).toEqual({ expiredCount: 1 });
        expect(prisma.unitReservation.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'res-1' }, data: { status: 'EXPIRED' } }),
        );
        expect(prisma.unit.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'unit-1', status: UnitStatus.RESERVED } }),
        );
      });

      it('is a no-op when there are no stale reservations', async () => {
        prisma.unitReservation.findMany.mockResolvedValue([]);
        const result = await service.expireStaleReservations();
        expect(result).toEqual({ expiredCount: 0 });
        expect(prisma.unitReservation.update).not.toHaveBeenCalled();
      });
    });

    describe('convertReservationToSale', () => {
      const activeReservation = {
        id: 'res-1',
        unitId: 'unit-1',
        customerId: 'cust-1',
        entityId: 'ent-1',
        projectId: 'proj-1',
        status: ReservationStatus.ACTIVE,
        isResale: false,
        expiresAt: new Date(Date.now() + 3_600_000),
        unit: { id: 'unit-1', code: 'A-1-01' },
      };
      const convertDto = {
        salePrice: 50_000_000,
        allocationDate: '2026-07-26',
        invoiceNumber: 'INV-001',
        revenueAccountId: 'acc-revenue',
        arControlAccountId: 'acc-ar',
      };

      it('rejects converting a non-ACTIVE reservation', async () => {
        prisma.unitReservation.findUnique.mockResolvedValue({ ...activeReservation, status: ReservationStatus.EXPIRED });
        await expect(service.convertReservationToSale('res-1', convertDto, 'user-1')).rejects.toThrow(ConflictException);
      });

      it('rejects converting an expired-but-still-ACTIVE-flagged reservation', async () => {
        prisma.unitReservation.findUnique.mockResolvedValue({ ...activeReservation, expiresAt: new Date(Date.now() - 1000) });
        await expect(service.convertReservationToSale('res-1', convertDto, 'user-1')).rejects.toThrow(ConflictException);
      });

      it('creates the allocation and reuses AccountsReceivableService for the AR invoice + posting', async () => {
        prisma.unitReservation.findUnique.mockResolvedValue(activeReservation);
        prisma.unitSaleAllocation.create.mockResolvedValue({ id: 'alloc-1', unitId: 'unit-1', customerId: 'cust-1' });
        prisma.unitReservation.update.mockResolvedValue({});
        prisma.unit.update.mockResolvedValue({});
        accountsReceivable.createInvoice.mockResolvedValue({ id: 'inv-1' });
        accountsReceivable.postInvoice.mockResolvedValue({ invoiceId: 'inv-1', journalEntry: { id: 'je-1' } });

        const result = await service.convertReservationToSale('res-1', convertDto, 'user-1');

        expect(accountsReceivable.createInvoice).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: 'ent-1',
            allocationId: 'alloc-1',
            lines: [expect.objectContaining({ accountId: 'acc-revenue', unitPrice: 50_000_000, projectId: 'proj-1' })],
          }),
          'user-1',
        );
        expect(accountsReceivable.postInvoice).toHaveBeenCalledWith('inv-1', { arControlAccountId: 'acc-ar' }, 'user-1');
        expect(result.invoice.id).toBe('inv-1');
        expect(prisma.unitAllocationEvent.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ eventType: 'CONVERTED_TO_SALE' }) }),
        );
      });
    });

    describe('cancelAllocation', () => {
      it('rejects cancelling an already-cancelled allocation', async () => {
        prisma.unitSaleAllocation.findUnique.mockResolvedValue({ id: 'alloc-1', isCancelled: true });
        await expect(service.cancelAllocation('alloc-1', 'user-1', 'reason')).rejects.toThrow(ConflictException);
      });

      it('rejects cancelling a HANDED_OVER allocation', async () => {
        prisma.unitSaleAllocation.findUnique.mockResolvedValue({
          id: 'alloc-1',
          isCancelled: false,
          status: UnitStatus.HANDED_OVER,
        });
        await expect(service.cancelAllocation('alloc-1', 'user-1', 'reason')).rejects.toThrow(ConflictException);
      });

      it('cancels the allocation and returns the unit to AVAILABLE', async () => {
        prisma.unitSaleAllocation.findUnique.mockResolvedValue({
          id: 'alloc-1',
          unitId: 'unit-1',
          customerId: 'cust-1',
          isCancelled: false,
          status: UnitStatus.ALLOCATED,
        });

        const result = await service.cancelAllocation('alloc-1', 'user-1', 'Customer withdrew');

        expect(result).toEqual({ allocationId: 'alloc-1', cancelled: true });
        expect(prisma.unit.update).toHaveBeenCalledWith({ where: { id: 'unit-1' }, data: { status: UnitStatus.AVAILABLE } });
      });
    });

    describe('transferAllocation', () => {
      it('rejects transferring an allocation that is not found', async () => {
        prisma.unitSaleAllocation.findUnique.mockResolvedValue(null);
        await expect(service.transferAllocation('missing', 'cust-2', 'user-1', 'reason')).rejects.toThrow(NotFoundException);
      });

      it('cancels the original allocation and creates a linked replacement for the new customer', async () => {
        prisma.unitSaleAllocation.findUnique.mockResolvedValue({
          id: 'alloc-1',
          unitId: 'unit-1',
          customerId: 'cust-1',
          salePrice: 50_000_000,
          status: UnitStatus.ALLOCATED,
          isCancelled: false,
        });
        prisma.customer.findUnique.mockResolvedValue({ id: 'cust-2' });
        prisma.unitSaleAllocation.update.mockResolvedValue({});
        prisma.unitSaleAllocation.create.mockResolvedValue({ id: 'alloc-2', unitId: 'unit-1', customerId: 'cust-2' });

        const result = await service.transferAllocation('alloc-1', 'cust-2', 'user-1', 'Legal transfer');

        expect(result.previousAllocationId).toBe('alloc-1');
        expect(result.newAllocation.id).toBe('alloc-2');
        expect(prisma.unitSaleAllocation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ customerId: 'cust-2', transferredFromAllocationId: 'alloc-1' }),
          }),
        );
      });
    });

    describe('swapUnitAllocation', () => {
      it('rejects swapping into a unit that is not AVAILABLE', async () => {
        prisma.unitSaleAllocation.findUnique.mockResolvedValue({
          id: 'alloc-1',
          unitId: 'unit-1',
          customerId: 'cust-1',
          status: UnitStatus.ALLOCATED,
          isCancelled: false,
        });
        prisma.unit.findUnique.mockResolvedValue({ id: 'unit-2', code: 'B-2-02', status: UnitStatus.RESERVED });

        await expect(service.swapUnitAllocation('alloc-1', 'unit-2', 'user-1', 'reason')).rejects.toThrow(ConflictException);
      });
    });
  });
});
