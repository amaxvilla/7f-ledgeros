import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentAssignmentRole, AgentAssignmentScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { CreateAgentAssignmentDto, EndAgentAssignmentDto } from './dto/agent-assignment.dto';

/** Shared deep-include chain to reach a Unit's own Project, matching the
 *  identical chain already used by RealEstateService.getCustomerStatement
 *  — reused here rather than re-derived, so a future change to the
 *  Floor -> Block -> Phase -> Project structure only needs updating in
 *  one place if it's ever factored out further. */
const UNIT_PROJECT_INCLUDE = {
  floor: { include: { block: { include: { phase: { include: { project: true } } } } } },
} satisfies Prisma.UnitInclude;

interface ResolvedTarget {
  entityId: string;
  projectId: string;
  unitId: string | null;
  allocationId: string | null;
}

/**
 * Agent Management, RE-AGENT.2 — Agent Assignment.
 *
 * Attaches an Agent to a PROJECT, a UNIT, or a confirmed SALE
 * (UnitSaleAllocation — which already links a specific unit + customer,
 * covering the master prompt's "customer/sale" pairing without a
 * separate customerId column). See AgentAssignment's own schema comment
 * for the entityId cross-validation rationale and AgentAssignmentRole's
 * own comment for the PRIMARY-uniqueness rule.
 *
 * Deliberately out of scope for this checkpoint (see RE-COMM.1-6):
 * commission plans, calculation, lifecycle, PostingEngineService
 * integration, statements/reporting, and frontend UI. This service is
 * assignment CRUD (create/list/end) only — assignments are never
 * updated in place beyond ending them, preserving full history the same
 * way UnitSaleAllocation's own transfer lineage does (a new row, not a
 * mutated old one).
 */
@Injectable()
export class AgentAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  private async requireAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    return agent;
  }

  private async requireAssignment(id: string) {
    const assignment = await this.prisma.agentAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException(`Agent assignment ${id} not found`);
    return assignment;
  }

  /**
   * Resolves the target's own real, structural entityId/projectId —
   * never trusted from the caller (see AgentAssignment.entityId's own
   * schema comment) — and confirms exactly one of
   * projectId/unitId/allocationId was supplied, matching `scope`.
   */
  private async resolveTarget(dto: CreateAgentAssignmentDto): Promise<ResolvedTarget> {
    const provided = [dto.projectId, dto.unitId, dto.allocationId].filter((v) => v != null).length;
    if (provided !== 1) {
      throw new BadRequestException(
        'Exactly one of projectId, unitId, or allocationId must be provided, matching `scope`',
      );
    }

    if (dto.scope === AgentAssignmentScope.PROJECT) {
      if (!dto.projectId) throw new BadRequestException('projectId is required when scope is PROJECT');
      const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
      if (!project) throw new NotFoundException(`Project ${dto.projectId} not found`);
      return { entityId: project.entityId, projectId: project.id, unitId: null, allocationId: null };
    }

    if (dto.scope === AgentAssignmentScope.UNIT) {
      if (!dto.unitId) throw new BadRequestException('unitId is required when scope is UNIT');
      const unit = await this.prisma.unit.findUnique({
        where: { id: dto.unitId },
        include: UNIT_PROJECT_INCLUDE,
      });
      if (!unit) throw new NotFoundException(`Unit ${dto.unitId} not found`);
      const project = unit.floor.block.phase.project;
      return { entityId: project.entityId, projectId: project.id, unitId: unit.id, allocationId: null };
    }

    // SALE
    if (!dto.allocationId) throw new BadRequestException('allocationId is required when scope is SALE');
    const allocation = await this.prisma.unitSaleAllocation.findUnique({
      where: { id: dto.allocationId },
      include: { unit: { include: UNIT_PROJECT_INCLUDE } },
    });
    if (!allocation) throw new NotFoundException(`Sale allocation ${dto.allocationId} not found`);
    const project = allocation.unit.floor.block.phase.project;
    return { entityId: project.entityId, projectId: project.id, unitId: null, allocationId: allocation.id };
  }

  async create(dto: CreateAgentAssignmentDto, createdById: string) {
    await this.requireAgent(dto.agentId);
    const target = await this.resolveTarget(dto);

    if (target.entityId !== dto.entityId) {
      throw new BadRequestException(
        `entityId "${dto.entityId}" does not match the target's own entity "${target.entityId}"`,
      );
    }

    const targetFilter =
      dto.scope === AgentAssignmentScope.PROJECT
        ? { projectId: target.projectId }
        : dto.scope === AgentAssignmentScope.UNIT
          ? { unitId: target.unitId }
          : { allocationId: target.allocationId };

    const duplicate = await this.prisma.agentAssignment.findFirst({
      where: { agentId: dto.agentId, scope: dto.scope, role: dto.role, isActive: true, ...targetFilter },
    });
    if (duplicate) {
      throw new ConflictException(
        `Agent ${dto.agentId} already has an active ${dto.role} assignment on this ${dto.scope.toLowerCase()}`,
      );
    }

    if (dto.role === AgentAssignmentRole.PRIMARY) {
      const existingPrimary = await this.prisma.agentAssignment.findFirst({
        where: { scope: dto.scope, role: AgentAssignmentRole.PRIMARY, isActive: true, ...targetFilter },
      });
      if (existingPrimary) {
        throw new ConflictException(
          `This ${dto.scope.toLowerCase()} already has an active PRIMARY agent assignment (id ${existingPrimary.id}) — end it first`,
        );
      }
    }

    return this.prisma.agentAssignment.create({
      data: {
        agentId: dto.agentId,
        scope: dto.scope,
        role: dto.role,
        entityId: target.entityId,
        projectId: dto.scope === AgentAssignmentScope.PROJECT ? target.projectId : null,
        unitId: target.unitId,
        allocationId: target.allocationId,
        notes: dto.notes,
        createdById,
      },
    });
  }

  findForAgent(scope: SecurityScope, agentId: string) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.agentAssignment.findMany({
      where: { AND: [rls, { agentId }] },
      orderBy: { assignedAt: 'desc' },
    });
  }

  findForTarget(
    scope: SecurityScope,
    filters: { scope: AgentAssignmentScope; projectId?: string; unitId?: string; allocationId?: string },
  ) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    const targetFilter =
      filters.scope === AgentAssignmentScope.PROJECT
        ? { projectId: filters.projectId }
        : filters.scope === AgentAssignmentScope.UNIT
          ? { unitId: filters.unitId }
          : { allocationId: filters.allocationId };

    return this.prisma.agentAssignment.findMany({
      where: { AND: [rls, { scope: filters.scope, ...targetFilter }] },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getAssignment(scope: SecurityScope, id: string) {
    const assignment = await this.requireAssignment(id);
    if (!this.rowLevelSecurity.canAccess(scope, assignment, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Agent assignment ${id} not found`);
    }
    return assignment;
  }

  /** Ends an active assignment — preserved as history, never deleted. Rejects with a 409 if already ended. */
  async end(scope: SecurityScope, id: string, dto: EndAgentAssignmentDto, endedById: string) {
    const assignment = await this.getAssignment(scope, id);
    if (!assignment.isActive) {
      throw new ConflictException(`Agent assignment ${id} has already ended`);
    }
    return this.prisma.agentAssignment.update({
      where: { id: assignment.id },
      data: { isActive: false, endedAt: new Date(), endedReason: dto.reason, endedById },
    });
  }
}
