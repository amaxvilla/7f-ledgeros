import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceAllocationStatus, ResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  CancelAllocationDto,
  CompleteAllocationDto,
  CreateAllocationDto,
  CreateResourceDto,
} from './dto/resource.dto';

const OPEN_STATUSES: ResourceAllocationStatus[] = [ResourceAllocationStatus.PLANNED, ResourceAllocationStatus.ACTIVE];

@Injectable()
export class ResourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // =====================================================================
  // RESOURCES (the pool: labour crews + equipment)
  // =====================================================================

  createResource(dto: CreateResourceDto, createdById: string) {
    return this.prisma.projectResource.create({
      data: {
        projectId: dto.projectId,
        entityId: dto.entityId,
        type: dto.type,
        name: dto.name,
        code: dto.code,
        unitOfMeasure: dto.unitOfMeasure,
        unitCost: dto.unitCost,
        capacity: dto.capacity,
        createdById,
      },
    });
  }

  findResources(scope: SecurityScope, filters: { projectId?: string; type?: ResourceType; isActive?: boolean }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.projectResource.findMany({ where: { AND: [rls, filters] }, orderBy: { name: 'asc' } });
  }

  async getResource(id: string) {
    const resource = await this.prisma.projectResource.findUnique({
      where: { id },
      include: { allocations: { orderBy: { startDate: 'asc' } } },
    });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    return resource;
  }

  private async requireResource(id: string) {
    const resource = await this.prisma.projectResource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    return resource;
  }

  async setResourceActive(id: string, isActive: boolean) {
    await this.requireResource(id);
    return this.prisma.projectResource.update({ where: { id }, data: { isActive } });
  }

  // =====================================================================
  // ALLOCATIONS (one model for both equipment and labour allocation —
  // the distinction is purely ProjectResource.type)
  // =====================================================================

  /**
   * Rejects an allocation that would over-book the resource: sums
   * plannedQuantity across every PLANNED/ACTIVE allocation of this
   * resource whose date range overlaps the requested one, and rejects if
   * that total (including the new request) would exceed the resource's
   * capacity. Resources with no capacity set skip this check entirely —
   * capacity is opt-in, not assumed.
   */
  async allocateResource(dto: CreateAllocationDto, createdById: string) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('endDate cannot be before startDate');

    const [resource, task] = await Promise.all([
      this.prisma.projectResource.findUnique({ where: { id: dto.resourceId } }),
      this.prisma.projectTask.findUnique({ where: { id: dto.taskId } }),
    ]);
    if (!resource) throw new NotFoundException(`Resource ${dto.resourceId} not found`);
    if (!task) throw new NotFoundException(`Task ${dto.taskId} not found`);
    if (!resource.isActive) throw new BadRequestException('This resource is inactive');

    if (resource.capacity != null) {
      const overlapping = await this.prisma.resourceAllocation.findMany({
        where: {
          resourceId: dto.resourceId,
          status: { in: OPEN_STATUSES },
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });
      const alreadyCommitted = overlapping.reduce((sum, a) => sum + Number(a.plannedQuantity), 0);
      if (alreadyCommitted + dto.plannedQuantity > resource.capacity) {
        throw new ConflictException(
          `Allocating ${dto.plannedQuantity} would exceed ${resource.name}'s capacity of ${resource.capacity} (already committed: ${alreadyCommitted} over this date range)`,
        );
      }
    }

    return this.prisma.resourceAllocation.create({
      data: {
        resourceId: dto.resourceId,
        taskId: dto.taskId,
        entityId: dto.entityId,
        startDate: start,
        endDate: end,
        plannedQuantity: dto.plannedQuantity,
        notes: dto.notes,
        createdById,
      },
    });
  }

  findAllocations(scope: SecurityScope, filters: { resourceId?: string; taskId?: string; status?: ResourceAllocationStatus }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.resourceAllocation.findMany({
      where: { AND: [rls, filters] },
      include: { resource: true, task: true },
      orderBy: { startDate: 'asc' },
    });
  }

  async getAllocation(id: string) {
    const allocation = await this.prisma.resourceAllocation.findUnique({ where: { id }, include: { resource: true, task: true } });
    if (!allocation) throw new NotFoundException(`Allocation ${id} not found`);
    return allocation;
  }

  private async requireAllocation(id: string) {
    const allocation = await this.prisma.resourceAllocation.findUnique({ where: { id } });
    if (!allocation) throw new NotFoundException(`Allocation ${id} not found`);
    return allocation;
  }

  private assertAllocationOpen(allocation: { status: ResourceAllocationStatus }) {
    if (allocation.status === ResourceAllocationStatus.COMPLETED || allocation.status === ResourceAllocationStatus.CANCELLED) {
      throw new ConflictException(`Allocation is already ${allocation.status}`);
    }
  }

  async startAllocation(id: string) {
    const allocation = await this.requireAllocation(id);
    this.assertAllocationOpen(allocation);
    return this.prisma.resourceAllocation.update({ where: { id }, data: { status: ResourceAllocationStatus.ACTIVE } });
  }

  async completeAllocation(id: string, dto: CompleteAllocationDto) {
    const allocation = await this.requireAllocation(id);
    this.assertAllocationOpen(allocation);
    return this.prisma.resourceAllocation.update({
      where: { id },
      data: { status: ResourceAllocationStatus.COMPLETED, actualQuantity: dto.actualQuantity ?? allocation.plannedQuantity },
    });
  }

  async cancelAllocation(id: string, dto: CancelAllocationDto) {
    const allocation = await this.requireAllocation(id);
    this.assertAllocationOpen(allocation);
    return this.prisma.resourceAllocation.update({
      where: { id },
      data: { status: ResourceAllocationStatus.CANCELLED, cancelledReason: dto.reason },
    });
  }

  // =====================================================================
  // UTILIZATION (for the dashboard widget)
  // =====================================================================

  /** Per-resource utilization for a project: committed quantity (PLANNED+ACTIVE) vs capacity. Resources with no capacity set report utilization as null rather than a misleading 0/100%. */
  async getResourceUtilization(projectId: string) {
    const resources = await this.prisma.projectResource.findMany({ where: { projectId, isActive: true } });
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: { resource: { projectId }, status: { in: OPEN_STATUSES } },
    });

    const committedByResource = new Map<string, number>();
    for (const a of allocations) {
      committedByResource.set(a.resourceId, (committedByResource.get(a.resourceId) ?? 0) + Number(a.plannedQuantity));
    }

    return resources.map((r) => {
      const committed = committedByResource.get(r.id) ?? 0;
      return {
        resourceId: r.id,
        name: r.name,
        type: r.type,
        capacity: r.capacity,
        committed,
        utilizationPct: r.capacity ? Math.round((committed / r.capacity) * 10000) / 100 : null,
      };
    });
  }
}
