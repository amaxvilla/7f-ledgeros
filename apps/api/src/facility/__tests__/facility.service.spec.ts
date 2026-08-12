import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { FacilityStatus, MaintenanceRequestStatus, WorkflowInstanceStatus } from '@prisma/client';
import { FacilityService } from '../facility.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngineService } from '../../workflow/workflow.service';
import { AccountsPayableService } from '../../accounts-payable/accounts-payable.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';

function buildPrismaMock() {
  return {
    facility: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    maintenanceRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

describe('FacilityService', () => {
  let service: FacilityService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let workflow: { startInstance: jest.Mock; getInstance: jest.Mock };
  let accountsPayable: { createInvoice: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    workflow = { startInstance: jest.fn(), getInstance: jest.fn() };
    accountsPayable = { createInvoice: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FacilityService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkflowEngineService, useValue: workflow },
        { provide: AccountsPayableService, useValue: accountsPayable },
      ],
    }).compile();
    service = moduleRef.get(FacilityService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createFacility', () => {
    it('rejects a facility with neither projectId nor unitId', async () => {
      await expect(
        service.createFacility({ entityId: 'e1', name: 'Generator', category: 'MECHANICAL' }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a facility linked to a project', async () => {
      prisma.facility.create.mockResolvedValue({ id: 'fac-1' });
      await service.createFacility({ entityId: 'e1', projectId: 'p1', name: 'Generator', category: 'MECHANICAL' }, 'u1');
      expect(prisma.facility.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entityId: 'e1', projectId: 'p1', createdById: 'u1' }) }),
      );
    });
  });

  describe('requestDecommission / refreshDecommission', () => {
    it('rejects requesting decommission twice', async () => {
      prisma.facility.findUnique.mockResolvedValue({ id: 'fac-1', status: FacilityStatus.OPERATIONAL, workflowInstanceId: 'wf-1' });
      await expect(service.requestDecommission('fac-1', { reason: 'end of life' }, 'u1')).rejects.toThrow(ConflictException);
    });

    it('starts a workflow instance without changing status', async () => {
      prisma.facility.findUnique.mockResolvedValue({
        id: 'fac-1',
        status: FacilityStatus.OPERATIONAL,
        workflowInstanceId: null,
        entityId: 'e1',
      });
      workflow.startInstance.mockResolvedValue({ id: 'wf-1' });
      prisma.facility.update.mockResolvedValue({ id: 'fac-1', status: FacilityStatus.OPERATIONAL, workflowInstanceId: 'wf-1' });

      await service.requestDecommission('fac-1', { reason: 'end of life' }, 'u1');

      expect(workflow.startInstance).toHaveBeenCalledWith(
        expect.objectContaining({ workflowCode: 'FACILITY_DECOMMISSION', entityType: 'Facility', entityId: 'fac-1' }),
        'u1',
      );
      expect(prisma.facility.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ workflowInstanceId: 'wf-1' }) }),
      );
    });

    it('moves to DECOMMISSIONED once the workflow instance completes', async () => {
      prisma.facility.findUnique.mockResolvedValue({ id: 'fac-1', workflowInstanceId: 'wf-1' });
      workflow.getInstance.mockResolvedValue({ status: WorkflowInstanceStatus.APPROVED });
      prisma.facility.update.mockResolvedValue({ id: 'fac-1', status: FacilityStatus.DECOMMISSIONED });

      await service.refreshDecommission('fac-1');

      expect(prisma.facility.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: FacilityStatus.DECOMMISSIONED }) }),
      );
    });
  });

  describe('maintenance request lifecycle', () => {
    it('rejects assigning a request that is not OPEN', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'mr-1', status: MaintenanceRequestStatus.RESOLVED });
      await expect(service.assign('mr-1', { vendorId: 'v1' })).rejects.toThrow(ConflictException);
    });

    it('assigns an OPEN request and flips a linked OPERATIONAL facility to UNDER_MAINTENANCE', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        status: MaintenanceRequestStatus.OPEN,
        facilityId: 'fac-1',
        targetResolutionDate: null,
      });
      prisma.maintenanceRequest.update.mockResolvedValue({ id: 'mr-1', status: MaintenanceRequestStatus.ASSIGNED });
      prisma.facility.findUnique.mockResolvedValue({ id: 'fac-1', status: FacilityStatus.OPERATIONAL });

      await service.assign('mr-1', { vendorId: 'v1' });

      expect(prisma.facility.update).toHaveBeenCalledWith({
        where: { id: 'fac-1' },
        data: { status: FacilityStatus.UNDER_MAINTENANCE },
      });
    });

    it('rejects resolving a request that is not in an active state', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'mr-1', status: MaintenanceRequestStatus.OPEN });
      await expect(service.resolve('mr-1', {})).rejects.toThrow(ConflictException);
    });

    it('closes a RESOLVED request and restores an UNDER_MAINTENANCE facility to OPERATIONAL', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'mr-1', status: MaintenanceRequestStatus.RESOLVED, facilityId: 'fac-1' });
      prisma.maintenanceRequest.update.mockResolvedValue({ id: 'mr-1', status: MaintenanceRequestStatus.CLOSED });
      prisma.facility.findUnique.mockResolvedValue({ id: 'fac-1', status: FacilityStatus.UNDER_MAINTENANCE });

      await service.close('mr-1');

      expect(prisma.facility.update).toHaveBeenCalledWith({
        where: { id: 'fac-1' },
        data: { status: FacilityStatus.OPERATIONAL },
      });
    });
  });

  describe('billVendor', () => {
    it('rejects billing a request with no assigned vendor', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'mr-1', assignedVendorId: null });
      await expect(
        service.billVendor('mr-1', { invoiceNumber: 'INV-1', invoiceDate: '2026-07-01', expenseAccountId: 'acc-1' }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects billing a request that has already been billed', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'mr-1', assignedVendorId: 'v1', vendorInvoiceId: 'inv-1' });
      await expect(
        service.billVendor('mr-1', { invoiceNumber: 'INV-1', invoiceDate: '2026-07-01', expenseAccountId: 'acc-1' }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a VendorInvoice via AccountsPayableService and links it back', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue({
        id: 'mr-1',
        entityId: 'e1',
        assignedVendorId: 'v1',
        vendorInvoiceId: null,
        status: MaintenanceRequestStatus.RESOLVED,
        actualCost: 15000,
        costEstimate: null,
        description: 'Fix the lift motor',
      });
      accountsPayable.createInvoice.mockResolvedValue({ id: 'vinv-1' });
      prisma.maintenanceRequest.update.mockResolvedValue({ id: 'mr-1', vendorInvoiceId: 'vinv-1' });

      await service.billVendor('mr-1', { invoiceNumber: 'INV-1', invoiceDate: '2026-07-01', expenseAccountId: 'acc-1' }, 'u1');

      expect(accountsPayable.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'e1',
          vendorId: 'v1',
          lines: [expect.objectContaining({ accountId: 'acc-1', unitCost: 15000, quantity: 1 })],
        }),
        'u1',
      );
      expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({
        where: { id: 'mr-1' },
        data: { vendorInvoiceId: 'vinv-1' },
      });
    });
  });
});
