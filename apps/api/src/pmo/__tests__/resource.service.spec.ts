import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ResourceAllocationStatus, ResourceType } from '@prisma/client';
import { ResourceService } from '../resource.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';

describe('ResourceService', () => {
  let service: ResourceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      projectResource: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      projectTask: { findUnique: jest.fn() },
      resourceAllocation: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ResourceService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ResourceService);
  });

  describe('createResource', () => {
    it('creates a LABOUR resource', async () => {
      prisma.projectResource.create.mockResolvedValue({ id: 'res1', type: ResourceType.LABOUR });
      const result = await service.createResource(
        { projectId: 'p1', entityId: 'e1', type: ResourceType.LABOUR, name: 'Masonry Crew A', capacity: 6 } as any,
        'u1',
      );
      expect(result.id).toBe('res1');
    });
  });

  describe('allocateResource', () => {
    it('rejects endDate before startDate', async () => {
      await expect(
        service.allocateResource(
          { resourceId: 'res1', taskId: 't1', entityId: 'e1', startDate: '2026-08-10', endDate: '2026-08-01', plannedQuantity: 5 } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a missing resource', async () => {
      prisma.projectResource.findUnique.mockResolvedValue(null);
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1' });
      await expect(
        service.allocateResource(
          { resourceId: 'missing', taskId: 't1', entityId: 'e1', startDate: '2026-08-01', endDate: '2026-08-05', plannedQuantity: 5 } as any,
          'u1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects allocating an inactive resource', async () => {
      prisma.projectResource.findUnique.mockResolvedValue({ id: 'res1', isActive: false, capacity: null });
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1' });
      await expect(
        service.allocateResource(
          { resourceId: 'res1', taskId: 't1', entityId: 'e1', startDate: '2026-08-01', endDate: '2026-08-05', plannedQuantity: 5 } as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows allocation within capacity with no overlap', async () => {
      prisma.projectResource.findUnique.mockResolvedValue({ id: 'res1', isActive: true, capacity: 10, name: 'Excavator' });
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1' });
      prisma.resourceAllocation.findMany.mockResolvedValue([]);
      prisma.resourceAllocation.create.mockResolvedValue({ id: 'a1' });

      const result = await service.allocateResource(
        { resourceId: 'res1', taskId: 't1', entityId: 'e1', startDate: '2026-08-01', endDate: '2026-08-05', plannedQuantity: 4 } as any,
        'u1',
      );
      expect(result.id).toBe('a1');
    });

    it('rejects an allocation that would exceed capacity given overlapping commitments', async () => {
      prisma.projectResource.findUnique.mockResolvedValue({ id: 'res1', isActive: true, capacity: 10, name: 'Excavator' });
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1' });
      prisma.resourceAllocation.findMany.mockResolvedValue([
        { plannedQuantity: 7, status: ResourceAllocationStatus.ACTIVE },
      ]);

      await expect(
        service.allocateResource(
          { resourceId: 'res1', taskId: 't1', entityId: 'e1', startDate: '2026-08-01', endDate: '2026-08-05', plannedQuantity: 5 } as any,
          'u1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('skips the capacity check entirely when no capacity is set', async () => {
      prisma.projectResource.findUnique.mockResolvedValue({ id: 'res1', isActive: true, capacity: null, name: 'Generic crew' });
      prisma.projectTask.findUnique.mockResolvedValue({ id: 't1' });
      prisma.resourceAllocation.create.mockResolvedValue({ id: 'a1' });

      await service.allocateResource(
        { resourceId: 'res1', taskId: 't1', entityId: 'e1', startDate: '2026-08-01', endDate: '2026-08-05', plannedQuantity: 999 } as any,
        'u1',
      );
      expect(prisma.resourceAllocation.findMany).not.toHaveBeenCalled();
      expect(prisma.resourceAllocation.create).toHaveBeenCalled();
    });
  });

  describe('allocation lifecycle', () => {
    it('rejects acting on a COMPLETED allocation', async () => {
      prisma.resourceAllocation.findUnique.mockResolvedValue({ id: 'a1', status: ResourceAllocationStatus.COMPLETED });
      await expect(service.startAllocation('a1')).rejects.toThrow(ConflictException);
    });

    it('completes an allocation, defaulting actualQuantity to plannedQuantity', async () => {
      prisma.resourceAllocation.findUnique.mockResolvedValue({ id: 'a1', status: ResourceAllocationStatus.ACTIVE, plannedQuantity: 8 });
      prisma.resourceAllocation.update.mockImplementation(({ data }: any) => ({ id: 'a1', ...data }));

      const result = await service.completeAllocation('a1', {} as any);
      expect(result.actualQuantity).toBe(8);
    });
  });

  describe('getResourceUtilization', () => {
    it('reports null utilization for a resource with no capacity, and a % for one with capacity', async () => {
      prisma.projectResource.findMany.mockResolvedValue([
        { id: 'res1', name: 'Excavator', type: ResourceType.EQUIPMENT, capacity: 10 },
        { id: 'res2', name: 'Generic crew', type: ResourceType.LABOUR, capacity: null },
      ]);
      prisma.resourceAllocation.findMany.mockResolvedValue([
        { resourceId: 'res1', plannedQuantity: 4 },
        { resourceId: 'res2', plannedQuantity: 100 },
      ]);

      const result = await service.getResourceUtilization('p1');

      const byId = new Map(result.map((r) => [r.resourceId, r]));
      expect(byId.get('res1')?.utilizationPct).toBe(40);
      expect(byId.get('res2')?.utilizationPct).toBeNull();
    });
  });
});
