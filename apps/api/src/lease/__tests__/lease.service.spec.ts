import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LeaseStatus, TenantStatus } from '@prisma/client';
import { LeaseService } from '../lease.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { AccountsReceivableService } from '../../accounts-receivable/accounts-receivable.service';

describe('LeaseService', () => {
  let service: LeaseService;
  let prisma: any;
  let accountsReceivable: any;

  beforeEach(async () => {
    prisma = {
      unit: { findUnique: jest.fn() },
      customer: { findUnique: jest.fn() },
      tenant: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      lease: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      leaseRentInvoice: { create: jest.fn(), findUnique: jest.fn() },
    };
    accountsReceivable = { createInvoice: jest.fn(), postInvoice: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaseService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsReceivableService, useValue: accountsReceivable },
      ],
    }).compile();

    service = moduleRef.get(LeaseService);
  });

  describe('createTenant', () => {
    const dto = { entityId: 'e1', customerId: 'c1', unitId: 'u1', moveInDate: '2026-08-01' };

    it('rejects when the unit does not exist', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);
      await expect(service.createTenant(dto as any, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects when the customer is inactive', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: false });
      await expect(service.createTenant(dto as any, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects when the unit already has an active tenant', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.tenant.findFirst.mockResolvedValue({ id: 'existing-tenant' });
      await expect(service.createTenant(dto as any, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('creates an ACTIVE tenant when everything checks out', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', isActive: true });
      prisma.tenant.findFirst.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });

      const result = await service.createTenant(dto as any, 'user-1');

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TenantStatus.ACTIVE, createdById: 'user-1' }) }),
      );
      expect(result).toEqual({ id: 't1', status: TenantStatus.ACTIVE });
    });
  });

  describe('endTenancy', () => {
    it('rejects ending a tenancy that already has a DRAFT or ACTIVE lease', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });
      prisma.lease.findFirst.mockResolvedValue({ id: 'lease-1', status: LeaseStatus.ACTIVE });

      await expect(service.endTenancy('t1', { moveOutDate: '2026-09-01' } as any)).rejects.toThrow(BadRequestException);
    });

    it('ends the tenancy when there is no open lease', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE });
      prisma.lease.findFirst.mockResolvedValue(null);
      prisma.tenant.update.mockResolvedValue({ id: 't1', status: TenantStatus.FORMER });

      const result = await service.endTenancy('t1', { moveOutDate: '2026-09-01' } as any);

      expect(result.status).toBe(TenantStatus.FORMER);
    });
  });

  describe('createLease', () => {
    const dto = {
      entityId: 'e1',
      tenantId: 't1',
      unitId: 'u1',
      leaseNumber: 'LSE-0001',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: 500_000,
    };

    it('rejects when the tenant is not ACTIVE', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.FORMER, unitId: 'u1' });
      await expect(service.createLease(dto as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when the lease unit does not match the tenant unit', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE, unitId: 'different-unit' });
      await expect(service.createLease(dto as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate lease number for the entity', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE, unitId: 'u1' });
      prisma.lease.findUnique.mockResolvedValue({ id: 'existing-lease' });
      await expect(service.createLease(dto as any, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('rejects when the unit already has an open lease', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE, unitId: 'u1' });
      prisma.lease.findUnique.mockResolvedValue(null);
      prisma.lease.findFirst.mockResolvedValue({ id: 'open-lease' });
      await expect(service.createLease(dto as any, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('creates a DRAFT lease when everything checks out', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', status: TenantStatus.ACTIVE, unitId: 'u1' });
      prisma.lease.findUnique.mockResolvedValue(null);
      prisma.lease.findFirst.mockResolvedValue(null);
      prisma.lease.create.mockResolvedValue({ id: 'lease-1', status: LeaseStatus.DRAFT });

      const result = await service.createLease(dto as any, 'user-1');

      expect(prisma.lease.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: LeaseStatus.DRAFT, leaseNumber: 'LSE-0001' }) }),
      );
      expect(result).toEqual({ id: 'lease-1', status: LeaseStatus.DRAFT });
    });
  });

  describe('generateRentInvoice', () => {
    it('rejects billing rent for a lease that is not ACTIVE', async () => {
      prisma.lease.findUnique.mockResolvedValue({ id: 'lease-1', status: LeaseStatus.DRAFT });
      await expect(
        service.generateRentInvoice('lease-1', { invoiceNumber: 'RENT-1', periodStart: '2026-08-01', periodEnd: '2026-08-31', invoiceDate: '2026-08-01', revenueAccountId: 'gl1' } as any, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the AR invoice via AccountsReceivableService and links it to the lease', async () => {
      prisma.lease.findUnique.mockResolvedValue({ id: 'lease-1', status: LeaseStatus.ACTIVE, entityId: 'e1', tenantId: 't1', leaseNumber: 'LSE-0001', rentAmount: 500_000 });
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', customerId: 'c1' });
      accountsReceivable.createInvoice.mockResolvedValue({ id: 'inv-1' });
      prisma.leaseRentInvoice.create.mockResolvedValue({ id: 'rent-inv-1', arInvoiceId: 'inv-1' });

      const result = await service.generateRentInvoice(
        'lease-1',
        { invoiceNumber: 'RENT-1', periodStart: '2026-08-01', periodEnd: '2026-08-31', invoiceDate: '2026-08-01', revenueAccountId: 'gl1' } as any,
        'user-1',
      );

      expect(accountsReceivable.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'e1', customerId: 'c1', lines: [expect.objectContaining({ accountId: 'gl1', unitPrice: 500_000 })] }),
        'user-1',
      );
      expect(prisma.leaseRentInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leaseId: 'lease-1', arInvoiceId: 'inv-1' }) }),
      );
      expect(result).toEqual({ id: 'rent-inv-1', arInvoiceId: 'inv-1' });
    });
  });

  describe('postRentInvoice', () => {
    it('rejects an unknown lease rent invoice', async () => {
      prisma.leaseRentInvoice.findUnique.mockResolvedValue(null);
      await expect(service.postRentInvoice('missing', { arControlAccountId: 'gl2' } as any, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('posts the underlying AR invoice via AccountsReceivableService', async () => {
      prisma.leaseRentInvoice.findUnique.mockResolvedValue({ id: 'rent-inv-1', arInvoiceId: 'inv-1' });
      accountsReceivable.postInvoice.mockResolvedValue({ invoiceId: 'inv-1', journalEntry: { id: 'je-1' } });

      const result = await service.postRentInvoice('rent-inv-1', { arControlAccountId: 'gl2' } as any, 'user-1');

      expect(accountsReceivable.postInvoice).toHaveBeenCalledWith('inv-1', { arControlAccountId: 'gl2' }, 'user-1');
      expect(result).toEqual({ invoiceId: 'inv-1', journalEntry: { id: 'je-1' } });
    });
  });
});
