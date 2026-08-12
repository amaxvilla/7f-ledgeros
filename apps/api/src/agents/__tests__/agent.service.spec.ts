import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentStatus, AgentType } from '@prisma/client';
import { AgentService } from '../agent.service';
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
    agent: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
}

describe('AgentService', () => {
  let service: AgentService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [AgentService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AgentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects a duplicate code with a 409, not a raw Prisma unique-constraint error', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(
          { entityId: 'e1', agentType: AgentType.INDIVIDUAL, code: 'AGT-001', displayName: 'Jane Doe', email: 'j@x.com', phone: '+1' },
          'creator-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.agent.create).not.toHaveBeenCalled();
    });

    it('creates in PENDING_APPROVAL via the schema default -- create() never sets status explicitly', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);
      prisma.agent.create.mockResolvedValue({ id: 'a1' });

      await service.create(
        { entityId: 'e1', agentType: AgentType.COMPANY, code: 'AGT-002', displayName: 'Acme Realty', email: 'a@acme.com', phone: '+1' },
        'creator-1',
      );

      const data = prisma.agent.create.mock.calls[0][0].data;
      expect(data.status).toBeUndefined(); // left to the Prisma column default
      expect(data.createdById).toBe('creator-1');
      expect(data.withholdingTaxExempt).toBe(false); // explicit default when dto omits it
    });
  });

  describe('getAgent', () => {
    it('returns NotFoundException (not ForbiddenException) when RLS denies access -- does not leak existence of an out-of-scope agent', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', entityId: 'other-entity' });
      const scope = buildRestrictedScope(['entity-1']);

      await expect(service.getAgent(scope, 'a1')).rejects.toThrow(NotFoundException);
    });

    it('returns the agent when RLS permits it', async () => {
      const agent = { id: 'a1', entityId: 'entity-1' };
      prisma.agent.findUnique.mockResolvedValue(agent);
      const scope = buildRestrictedScope(['entity-1']);

      await expect(service.getAgent(scope, 'a1')).resolves.toEqual(agent);
    });
  });

  describe('status lifecycle', () => {
    const scope = buildUnrestrictedScope();

    it('approve() only succeeds from PENDING_APPROVAL', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.ACTIVE, entityId: 'e1' });
      await expect(service.approve(scope, 'a1', 'approver-1')).rejects.toThrow(ConflictException);
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it('approve() sets ACTIVE + approvedById/approvedAt from PENDING_APPROVAL', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.PENDING_APPROVAL, entityId: 'e1' });
      prisma.agent.update.mockResolvedValue({ id: 'a1', status: AgentStatus.ACTIVE });

      await service.approve(scope, 'a1', 'approver-1');

      const data = prisma.agent.update.mock.calls[0][0].data;
      expect(data.status).toBe(AgentStatus.ACTIVE);
      expect(data.approvedById).toBe('approver-1');
      expect(data.approvedAt).toBeInstanceOf(Date);
    });

    it('suspend() only succeeds from ACTIVE', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.PENDING_APPROVAL, entityId: 'e1' });
      await expect(service.suspend(scope, 'a1', { reason: 'x' }, 'u1')).rejects.toThrow(ConflictException);
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it('suspend() records the reason and suspendedBy/At from ACTIVE', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.ACTIVE, entityId: 'e1' });
      prisma.agent.update.mockResolvedValue({});

      await service.suspend(scope, 'a1', { reason: 'Licensing dispute' }, 'suspender-1');

      const data = prisma.agent.update.mock.calls[0][0].data;
      expect(data.status).toBe(AgentStatus.SUSPENDED);
      expect(data.suspendReason).toBe('Licensing dispute');
      expect(data.suspendedById).toBe('suspender-1');
    });

    it('reactivate() only succeeds from SUSPENDED', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.ACTIVE, entityId: 'e1' });
      await expect(service.reactivate(scope, 'a1', 'u1')).rejects.toThrow(ConflictException);
    });

    it('reactivate() clears the suspend fields and sets ACTIVE from SUSPENDED', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.SUSPENDED, entityId: 'e1' });
      prisma.agent.update.mockResolvedValue({});

      await service.reactivate(scope, 'a1', 'reapprover-1');

      const data = prisma.agent.update.mock.calls[0][0].data;
      expect(data.status).toBe(AgentStatus.ACTIVE);
      expect(data.suspendedById).toBeNull();
      expect(data.suspendReason).toBeNull();
    });

    it('terminate() is rejected if already TERMINATED -- not a silent no-op', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status: AgentStatus.TERMINATED, entityId: 'e1' });
      await expect(service.terminate(scope, 'a1', { reason: 'x' }, 'u1')).rejects.toThrow(ConflictException);
    });

    it.each([AgentStatus.PENDING_APPROVAL, AgentStatus.ACTIVE, AgentStatus.SUSPENDED])(
      'terminate() succeeds from %s',
      async (status) => {
        prisma.agent.findUnique.mockResolvedValue({ id: 'a1', status, entityId: 'e1' });
        prisma.agent.update.mockResolvedValue({});

        await service.terminate(scope, 'a1', { reason: 'Contract ended' }, 'terminator-1');

        const data = prisma.agent.update.mock.calls[0][0].data;
        expect(data.status).toBe(AgentStatus.TERMINATED);
        expect(data.terminateReason).toBe('Contract ended');
      },
    );
  });

  describe('update', () => {
    it('never accepts status/code/entityId as columns to change -- UpdateAgentDto structurally excludes them', async () => {
      const agent = { id: 'a1', entityId: 'e1', status: AgentStatus.ACTIVE };
      prisma.agent.findUnique.mockResolvedValue(agent);
      prisma.agent.update.mockResolvedValue({});
      const scope = buildUnrestrictedScope();

      await service.update(scope, 'a1', { displayName: 'New Name' });

      const data = prisma.agent.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('status');
      expect(data).not.toHaveProperty('code');
      expect(data).not.toHaveProperty('entityId');
      expect(data.displayName).toBe('New Name');
    });
  });
});
