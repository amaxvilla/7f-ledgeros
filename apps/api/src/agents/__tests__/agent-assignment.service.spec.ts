import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AgentAssignmentRole, AgentAssignmentScope } from '@prisma/client';
import { AgentAssignmentService } from '../agent-assignment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

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

function buildRestrictedScope(allowedEntityIds: string[]): SecurityScope {
  const restricted = { unrestricted: false, viewableIds: allowedEntityIds, postableIds: allowedEntityIds };
  const none = { unrestricted: false, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-2',
    isSystemAdmin: false,
    entity: restricted,
    department: none,
    costCenter: none,
    project: none,
    businessUnit: restricted,
  };
}

function buildPrismaMock() {
  return {
    agent: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    unit: { findUnique: jest.fn() },
    unitSaleAllocation: { findUnique: jest.fn() },
    agentAssignment: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

const PROJECT = { id: 'proj-1', entityId: 'entity-1' };
const UNIT_WITH_CHAIN = {
  id: 'unit-1',
  floor: { block: { phase: { project: PROJECT } } },
};
const ALLOCATION_WITH_CHAIN = {
  id: 'alloc-1',
  unit: UNIT_WITH_CHAIN,
};

describe('AgentAssignmentService', () => {
  let service: AgentAssignmentService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [AgentAssignmentService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AgentAssignmentService);
    prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });
  });

  afterEach(() => jest.clearAllMocks());

  describe('create -- target resolution', () => {
    it('rejects when zero of projectId/unitId/allocationId are provided', async () => {
      await expect(
        service.create(
          { agentId: 'agent-1', entityId: 'entity-1', scope: AgentAssignmentScope.PROJECT, role: AgentAssignmentRole.PRIMARY },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when more than one of projectId/unitId/allocationId are provided', async () => {
      await expect(
        service.create(
          {
            agentId: 'agent-1',
            entityId: 'entity-1',
            scope: AgentAssignmentScope.PROJECT,
            role: AgentAssignmentRole.PRIMARY,
            projectId: 'proj-1',
            unitId: 'unit-1',
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a scope=PROJECT target that does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          { agentId: 'agent-1', entityId: 'entity-1', scope: AgentAssignmentScope.PROJECT, role: AgentAssignmentRole.PRIMARY, projectId: 'proj-x' },
          'creator-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('resolves entityId/projectId for scope=UNIT via the Floor->Block->Phase->Project chain, never from the caller', async () => {
      prisma.unit.findUnique.mockResolvedValue(UNIT_WITH_CHAIN);
      prisma.agentAssignment.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.create.mockResolvedValue({ id: 'aa-1' });

      await service.create(
        { agentId: 'agent-1', entityId: 'entity-1', scope: AgentAssignmentScope.UNIT, role: AgentAssignmentRole.CO_AGENT, unitId: 'unit-1' },
        'creator-1',
      );

      const data = prisma.agentAssignment.create.mock.calls[0][0].data;
      expect(data.unitId).toBe('unit-1');
      expect(data.entityId).toBe('entity-1');
      expect(data.projectId).toBeNull(); // only set for scope=PROJECT rows
      expect(data.allocationId).toBeNull();
    });

    it('resolves entityId for scope=SALE via allocation->unit->...->project, and rejects a caller-supplied entityId that does not match it', async () => {
      prisma.unitSaleAllocation.findUnique.mockResolvedValue(ALLOCATION_WITH_CHAIN);

      await expect(
        service.create(
          {
            agentId: 'agent-1',
            entityId: 'wrong-entity',
            scope: AgentAssignmentScope.SALE,
            role: AgentAssignmentRole.REFERRAL,
            allocationId: 'alloc-1',
          },
          'creator-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.agentAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('create -- duplicate and PRIMARY-uniqueness rules', () => {
    it('rejects a duplicate (agent, scope, role, target) with a 409', async () => {
      prisma.project.findUnique.mockResolvedValue(PROJECT);
      prisma.agentAssignment.findFirst.mockResolvedValueOnce({ id: 'existing-duplicate' }); // duplicate check

      await expect(
        service.create(
          { agentId: 'agent-1', entityId: 'entity-1', scope: AgentAssignmentScope.PROJECT, role: AgentAssignmentRole.CO_AGENT, projectId: 'proj-1' },
          'creator-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.agentAssignment.create).not.toHaveBeenCalled();
    });

    it('rejects a second active PRIMARY on the same target with a 409, without silently replacing the first', async () => {
      prisma.project.findUnique.mockResolvedValue(PROJECT);
      prisma.agentAssignment.findFirst
        .mockResolvedValueOnce(null) // duplicate check passes
        .mockResolvedValueOnce({ id: 'existing-primary' }); // PRIMARY-uniqueness check finds one

      await expect(
        service.create(
          { agentId: 'agent-2', entityId: 'entity-1', scope: AgentAssignmentScope.PROJECT, role: AgentAssignmentRole.PRIMARY, projectId: 'proj-1' },
          'creator-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.agentAssignment.create).not.toHaveBeenCalled();
    });

    it('allows multiple simultaneous active CO_AGENT/REFERRAL assignments on the same target (no uniqueness check runs)', async () => {
      prisma.project.findUnique.mockResolvedValue(PROJECT);
      prisma.agentAssignment.findFirst.mockResolvedValue(null); // duplicate check only -- role isn't PRIMARY
      prisma.agentAssignment.create.mockResolvedValue({ id: 'aa-2' });

      await service.create(
        { agentId: 'agent-3', entityId: 'entity-1', scope: AgentAssignmentScope.PROJECT, role: AgentAssignmentRole.CO_AGENT, projectId: 'proj-1' },
        'creator-1',
      );

      expect(prisma.agentAssignment.findFirst).toHaveBeenCalledTimes(1); // duplicate check only
      expect(prisma.agentAssignment.create).toHaveBeenCalled();
    });

    it('allows a new PRIMARY once the prior one has ended -- verifies the uniqueness check itself filters on isActive: true, not just that the mock happens to return null', async () => {
      prisma.project.findUnique.mockResolvedValue(PROJECT);
      prisma.agentAssignment.findFirst.mockResolvedValue(null);
      prisma.agentAssignment.create.mockResolvedValue({ id: 'aa-3' });

      await service.create(
        { agentId: 'agent-4', entityId: 'entity-1', scope: AgentAssignmentScope.PROJECT, role: AgentAssignmentRole.PRIMARY, projectId: 'proj-1' },
        'creator-1',
      );

      const primaryCheckArgs = prisma.agentAssignment.findFirst.mock.calls[1][0]; // [0]=duplicate check, [1]=PRIMARY-uniqueness check
      expect(primaryCheckArgs.where.isActive).toBe(true);
      expect(primaryCheckArgs.where.role).toBe(AgentAssignmentRole.PRIMARY);
      expect(prisma.agentAssignment.create).toHaveBeenCalled();
    });
  });

  describe('getAssignment', () => {
    it('returns NotFoundException (not ForbiddenException) when RLS denies access', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue({ id: 'aa-1', entityId: 'other-entity' });
      const scope = buildRestrictedScope(['entity-1']);

      await expect(service.getAssignment(scope, 'aa-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('end', () => {
    it('rejects ending an already-ended assignment with a 409, not a silent no-op', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue({ id: 'aa-1', entityId: 'e1', isActive: false });
      const scope = buildUnrestrictedScope();

      await expect(service.end(scope, 'aa-1', { reason: 'x' }, 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.agentAssignment.update).not.toHaveBeenCalled();
    });

    it('sets isActive false and records endedReason/endedById/endedAt for an active assignment', async () => {
      prisma.agentAssignment.findUnique.mockResolvedValue({ id: 'aa-1', entityId: 'e1', isActive: true });
      prisma.agentAssignment.update.mockResolvedValue({});
      const scope = buildUnrestrictedScope();

      await service.end(scope, 'aa-1', { reason: 'Sale cancelled' }, 'ender-1');

      const data = prisma.agentAssignment.update.mock.calls[0][0].data;
      expect(data.isActive).toBe(false);
      expect(data.endedReason).toBe('Sale cancelled');
      expect(data.endedById).toBe('ender-1');
      expect(data.endedAt).toBeInstanceOf(Date);
    });
  });
});
