import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FacilityStatus,
  MaintenanceRequestStatus,
  WorkflowInstanceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow.service';
import { AccountsPayableService } from '../accounts-payable/accounts-payable.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  CreateFacilityDto,
  RecordServiceDto,
  SetOutOfServiceDto,
  RequestDecommissionDto,
  CreateMaintenanceRequestDto,
  AssignMaintenanceRequestDto,
  HoldMaintenanceRequestDto,
  ResolveMaintenanceRequestDto,
  CancelMaintenanceRequestDto,
  BillMaintenanceVendorDto,
} from './dto/facility.dto';

/** Workflow code for decommissioning a Facility — same submit/refresh
 *  integration shape as MortgageService/HandoverService already use. */
const FACILITY_DECOMMISSION_WORKFLOW_CODE = 'FACILITY_DECOMMISSION';

const ACTIVE_FACILITY_STATUSES: FacilityStatus[] = [
  FacilityStatus.OPERATIONAL,
  FacilityStatus.UNDER_MAINTENANCE,
  FacilityStatus.OUT_OF_SERVICE,
];

const OPEN_MAINTENANCE_STATUSES: MaintenanceRequestStatus[] = [
  MaintenanceRequestStatus.OPEN,
  MaintenanceRequestStatus.ASSIGNED,
  MaintenanceRequestStatus.IN_PROGRESS,
  MaintenanceRequestStatus.ON_HOLD,
];

@Injectable()
export class FacilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowEngineService,
    private readonly accountsPayable: AccountsPayableService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // FACILITIES
  // -------------------------------------------------------------------

  async createFacility(dto: CreateFacilityDto, createdById: string) {
    if (!dto.projectId && !dto.unitId) {
      throw new ConflictException('A facility must be linked to either a projectId (common area) or a unitId (in-unit asset)');
    }
    return this.prisma.facility.create({
      data: {
        entityId: dto.entityId,
        projectId: dto.projectId,
        unitId: dto.unitId,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        vendorId: dto.vendorId,
        installDate: dto.installDate ? new Date(dto.installDate) : undefined,
        nextServiceDueAt: dto.nextServiceDueAt ? new Date(dto.nextServiceDueAt) : undefined,
        createdById,
      },
    });
  }

  findFacilities(scope: SecurityScope, filters: { entityId?: string; status?: FacilityStatus; projectId?: string; unitId?: string }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity'] });
    return this.prisma.facility.findMany({
      where: { AND: [rls, filters] },
      include: { maintenanceRequests: { where: { status: { in: OPEN_MAINTENANCE_STATUSES } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFacility(id: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
      include: { maintenanceRequests: { orderBy: { createdAt: 'desc' } } },
    });
    if (!facility) throw new NotFoundException(`Facility ${id} not found`);
    return facility;
  }

  private async requireFacility(id: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundException(`Facility ${id} not found`);
    return facility;
  }

  async recordService(id: string, dto: RecordServiceDto) {
    const facility = await this.requireFacility(id);
    if (facility.status === FacilityStatus.DECOMMISSIONED) {
      throw new ConflictException('Cannot record service against a decommissioned facility');
    }
    return this.prisma.facility.update({
      where: { id },
      data: {
        status: FacilityStatus.OPERATIONAL,
        lastServicedAt: new Date(dto.servicedAt),
        nextServiceDueAt: dto.nextServiceDueAt ? new Date(dto.nextServiceDueAt) : facility.nextServiceDueAt,
      },
    });
  }

  async setOutOfService(id: string, dto: SetOutOfServiceDto) {
    const facility = await this.requireFacility(id);
    if (facility.status === FacilityStatus.DECOMMISSIONED) {
      throw new ConflictException('Cannot change status of a decommissioned facility');
    }
    return this.prisma.facility.update({
      where: { id },
      data: { status: FacilityStatus.OUT_OF_SERVICE, decommissionReason: dto.reason ?? facility.decommissionReason },
    });
  }

  /** Sends the facility into the Workflow Engine for decommission
   *  approval — mirrors MortgageService.submitForApproval(). The
   *  facility's own status is left untouched until the workflow
   *  completes (see refreshDecommission), so it keeps showing its real
   *  operational state while the approval is in flight. */
  async requestDecommission(id: string, dto: RequestDecommissionDto, userId: string) {
    const facility = await this.requireFacility(id);
    if (!ACTIVE_FACILITY_STATUSES.includes(facility.status)) {
      throw new ConflictException(`Cannot request decommission for a facility with status ${facility.status}`);
    }
    if (facility.workflowInstanceId) {
      throw new ConflictException('A decommission request is already in progress for this facility');
    }

    const instance = await this.workflow.startInstance(
      {
        workflowCode: FACILITY_DECOMMISSION_WORKFLOW_CODE,
        entityType: 'Facility',
        entityId: facility.id,
        context: { entityId: facility.entityId },
      },
      userId,
    );

    return this.prisma.facility.update({
      where: { id },
      data: { workflowInstanceId: instance.id, decommissionReason: dto.reason },
    });
  }

  /** Polls the linked workflow instance — mirrors
   *  MortgageService.refreshApproval()/HandoverService.refreshApproval(). */
  async refreshDecommission(id: string) {
    const facility = await this.requireFacility(id);
    if (!facility.workflowInstanceId) return facility;

    const instance = await this.workflow.getInstance(facility.workflowInstanceId);

    if (instance.status === WorkflowInstanceStatus.APPROVED) {
      return this.prisma.facility.update({
        where: { id },
        data: { status: FacilityStatus.DECOMMISSIONED, decommissionedAt: new Date(), workflowInstanceId: null },
      });
    }
    if (instance.status === WorkflowInstanceStatus.REJECTED || instance.status === WorkflowInstanceStatus.RETURNED) {
      return this.prisma.facility.update({
        where: { id },
        data: { workflowInstanceId: null },
      });
    }
    return facility;
  }

  // -------------------------------------------------------------------
  // MAINTENANCE REQUESTS
  // -------------------------------------------------------------------

  async createMaintenanceRequest(dto: CreateMaintenanceRequestDto, reportedById: string) {
    if (dto.facilityId) {
      const facility = await this.requireFacility(dto.facilityId);
      if (facility.status === FacilityStatus.DECOMMISSIONED) {
        throw new ConflictException('Cannot raise a maintenance request against a decommissioned facility');
      }
    }
    return this.prisma.maintenanceRequest.create({
      data: {
        entityId: dto.entityId,
        facilityId: dto.facilityId,
        unitId: dto.unitId,
        tenantId: dto.tenantId,
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        source: dto.source ?? 'INTERNAL',
        description: dto.description,
        targetResolutionDate: dto.targetResolutionDate ? new Date(dto.targetResolutionDate) : undefined,
        costEstimate: dto.costEstimate,
        reportedById,
      },
    });
  }

  findMaintenanceRequests(
    scope: SecurityScope,
    filters: { entityId?: string; status?: MaintenanceRequestStatus; facilityId?: string; unitId?: string; tenantId?: string },
  ) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity'] });
    return this.prisma.maintenanceRequest.findMany({
      where: { AND: [rls, filters] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMaintenanceRequest(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Maintenance request ${id} not found`);
    return request;
  }

  private async requireMaintenanceRequest(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`Maintenance request ${id} not found`);
    return request;
  }

  async assign(id: string, dto: AssignMaintenanceRequestDto) {
    const request = await this.requireMaintenanceRequest(id);
    if (request.status !== MaintenanceRequestStatus.OPEN) {
      throw new ConflictException(`Only an OPEN request can be assigned (current status: ${request.status})`);
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.ASSIGNED,
        assignedVendorId: dto.vendorId,
        assignedAt: new Date(),
        targetResolutionDate: dto.targetResolutionDate ? new Date(dto.targetResolutionDate) : request.targetResolutionDate,
      },
    });
    if (request.facilityId) {
      const facility = await this.prisma.facility.findUnique({ where: { id: request.facilityId } });
      if (facility && facility.status === FacilityStatus.OPERATIONAL) {
        await this.prisma.facility.update({ where: { id: request.facilityId }, data: { status: FacilityStatus.UNDER_MAINTENANCE } });
      }
    }
    return updated;
  }

  async startWork(id: string) {
    const request = await this.requireMaintenanceRequest(id);
    if (request.status !== MaintenanceRequestStatus.ASSIGNED) {
      throw new ConflictException(`Only an ASSIGNED request can move to IN_PROGRESS (current status: ${request.status})`);
    }
    return this.prisma.maintenanceRequest.update({ where: { id }, data: { status: MaintenanceRequestStatus.IN_PROGRESS } });
  }

  async hold(id: string, dto: HoldMaintenanceRequestDto) {
    const request = await this.requireMaintenanceRequest(id);
    if (!([MaintenanceRequestStatus.ASSIGNED, MaintenanceRequestStatus.IN_PROGRESS] as MaintenanceRequestStatus[]).includes(request.status)) {
      throw new ConflictException(`Cannot place a request with status ${request.status} on hold`);
    }
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.ON_HOLD, resolutionNotes: dto.reason ?? request.resolutionNotes },
    });
  }

  async resume(id: string) {
    const request = await this.requireMaintenanceRequest(id);
    if (request.status !== MaintenanceRequestStatus.ON_HOLD) {
      throw new ConflictException(`Only an ON_HOLD request can resume (current status: ${request.status})`);
    }
    return this.prisma.maintenanceRequest.update({ where: { id }, data: { status: MaintenanceRequestStatus.IN_PROGRESS } });
  }

  async resolve(id: string, dto: ResolveMaintenanceRequestDto) {
    const request = await this.requireMaintenanceRequest(id);
    if (!([MaintenanceRequestStatus.ASSIGNED, MaintenanceRequestStatus.IN_PROGRESS, MaintenanceRequestStatus.ON_HOLD] as MaintenanceRequestStatus[]).includes(request.status)) {
      throw new ConflictException(`Cannot resolve a request with status ${request.status}`);
    }
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceRequestStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes: dto.resolutionNotes ?? request.resolutionNotes,
        actualCost: dto.actualCost ?? request.actualCost,
      },
    });
  }

  /** Closes a RESOLVED request. If the facility is unit-linked, restores
   *  it to OPERATIONAL — reusing FacilityService's own recordService()
   *  data shape rather than writing a second status-flip inline. */
  async close(id: string) {
    const request = await this.requireMaintenanceRequest(id);
    if (request.status !== MaintenanceRequestStatus.RESOLVED) {
      throw new ConflictException(`Only a RESOLVED request can be closed (current status: ${request.status})`);
    }
    const closed = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.CLOSED, closedAt: new Date() },
    });
    if (request.facilityId) {
      const facility = await this.prisma.facility.findUnique({ where: { id: request.facilityId } });
      if (facility && facility.status === FacilityStatus.UNDER_MAINTENANCE) {
        await this.prisma.facility.update({ where: { id: request.facilityId }, data: { status: FacilityStatus.OPERATIONAL } });
      }
    }
    return closed;
  }

  async cancel(id: string, dto: CancelMaintenanceRequestDto) {
    const request = await this.requireMaintenanceRequest(id);
    if (!OPEN_MAINTENANCE_STATUSES.includes(request.status)) {
      throw new ConflictException(`Cannot cancel a request with status ${request.status}`);
    }
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceRequestStatus.CANCELLED, cancelledReason: dto.reason },
    });
  }

  /** Bills the assigned vendor by creating a VendorInvoice through the
   *  existing AccountsPayableService.createInvoice() — reused wholesale,
   *  not reimplemented. Posting that invoice to the GL remains a
   *  separate step on the existing AP endpoint
   *  (`POST /accounts-payable/invoices/:id/post`). */
  async billVendor(id: string, dto: BillMaintenanceVendorDto, userId: string) {
    const request = await this.requireMaintenanceRequest(id);
    if (!request.assignedVendorId) throw new ConflictException('Request has no assigned vendor to bill');
    if (request.vendorInvoiceId) throw new ConflictException('This request has already been billed');
    if (!([MaintenanceRequestStatus.RESOLVED, MaintenanceRequestStatus.CLOSED] as MaintenanceRequestStatus[]).includes(request.status)) {
      throw new ConflictException(`Cannot bill a request with status ${request.status}`);
    }
    const amount = request.actualCost ?? request.costEstimate;
    if (!amount) throw new ConflictException('Request has no actualCost or costEstimate to bill');

    const invoice = await this.accountsPayable.createInvoice(
      {
        entityId: request.entityId,
        invoiceNumber: dto.invoiceNumber,
        vendorId: request.assignedVendorId,
        invoiceDate: dto.invoiceDate,
        dueDate: dto.dueDate,
        lines: [
          {
            description: `Maintenance request ${request.id} — ${request.description.slice(0, 80)}`,
            accountId: dto.expenseAccountId,
            quantity: 1,
            unitCost: Number(amount),
          },
        ],
      },
      userId,
    );

    await this.prisma.maintenanceRequest.update({ where: { id }, data: { vendorInvoiceId: (invoice as { id: string }).id } });

    return invoice;
  }

  // -------------------------------------------------------------------
  // DASHBOARD / REPORTING AGGREGATION (reused by DashboardService /
  // ReportingService rather than re-queried there)
  // -------------------------------------------------------------------

  async getMaintenanceOverview(entityId?: string) {
    const where = { entityId };
    const [byStatus, byPriority, openFacilitiesUnderMaintenance] = await Promise.all([
      this.prisma.maintenanceRequest.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.maintenanceRequest.groupBy({
        by: ['priority'],
        where: { ...where, status: { in: OPEN_MAINTENANCE_STATUSES } },
        _count: true,
      }),
      this.prisma.facility.count({ where: { entityId, status: FacilityStatus.UNDER_MAINTENANCE } }),
    ]);

    return {
      entityId: entityId ?? null,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
      openByPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count })),
      facilitiesUnderMaintenance: openFacilitiesUnderMaintenance,
    };
  }
}
