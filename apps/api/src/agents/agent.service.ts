import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentStatus, AgentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import {
  CreateAgentDto,
  SuspendAgentDto,
  TerminateAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto';

/**
 * Agent Management, RE-AGENT.1 — Agent Master.
 *
 * A real, standalone external-sales-agent master. See the schema's own
 * top-of-section comment for why this is deliberately NOT built on top
 * of User or of CRM's LeadSource.AGENT enum value.
 *
 * Status only ever moves through the four guarded methods below
 * (approve/suspend/reactivate/terminate) — never through update(),
 * which UpdateAgentDto deliberately excludes `status` from. Allowed
 * transitions: PENDING_APPROVAL -> ACTIVE -> SUSPENDED -> ACTIVE
 * (reactivation); TERMINATED is terminal from any of the other three.
 *
 * Deliberately out of scope for this checkpoint (see RE-AGENT.2/
 * RE-COMM.1-6): agent-to-project/unit/customer assignment, commission
 * plans, commission calculation/lifecycle, PostingEngineService
 * integration, agent statements/reporting, and frontend UI. This
 * service is master-data CRUD plus lifecycle only.
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  private async requireAgent(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async create(dto: CreateAgentDto, createdById: string) {
    const existing = await this.prisma.agent.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Agent code "${dto.code}" is already in use`);
    }

    return this.prisma.agent.create({
      data: {
        entityId: dto.entityId,
        agentType: dto.agentType,
        code: dto.code,
        displayName: dto.displayName,
        contactPersonName: dto.contactPersonName,
        email: dto.email,
        phone: dto.phone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        licenseNumber: dto.licenseNumber,
        licenseIssuingBody: dto.licenseIssuingBody,
        licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : undefined,
        registrationNumber: dto.registrationNumber,
        bankName: dto.bankName,
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankSwiftCode: dto.bankSwiftCode,
        taxIdentificationNumber: dto.taxIdentificationNumber,
        withholdingTaxExempt: dto.withholdingTaxExempt ?? false,
        agreementReference: dto.agreementReference,
        agreementStartDate: dto.agreementStartDate ? new Date(dto.agreementStartDate) : undefined,
        agreementEndDate: dto.agreementEndDate ? new Date(dto.agreementEndDate) : undefined,
        notes: dto.notes,
        createdById,
      },
    });
  }

  findAgents(
    scope: SecurityScope,
    filters: { entityId?: string; status?: AgentStatus; agentType?: AgentType; search?: string },
  ) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    const { search, ...rest } = filters;

    return this.prisma.agent.findMany({
      where: {
        AND: [
          rls,
          rest,
          search
            ? {
                OR: [
                  { displayName: { contains: search, mode: 'insensitive' } },
                  { code: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAgent(scope: SecurityScope, id: string) {
    const agent = await this.requireAgent(id);
    if (!this.rowLevelSecurity.canAccess(scope, agent, { dimensions: ['entity', 'businessUnit'] })) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return agent;
  }

  async update(scope: SecurityScope, id: string, dto: UpdateAgentDto) {
    const agent = await this.getAgent(scope, id);

    return this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        agentType: dto.agentType,
        displayName: dto.displayName,
        contactPersonName: dto.contactPersonName,
        email: dto.email,
        phone: dto.phone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        licenseNumber: dto.licenseNumber,
        licenseIssuingBody: dto.licenseIssuingBody,
        licenseExpiryDate: dto.licenseExpiryDate ? new Date(dto.licenseExpiryDate) : undefined,
        registrationNumber: dto.registrationNumber,
        bankName: dto.bankName,
        bankAccountName: dto.bankAccountName,
        bankAccountNumber: dto.bankAccountNumber,
        bankSwiftCode: dto.bankSwiftCode,
        taxIdentificationNumber: dto.taxIdentificationNumber,
        withholdingTaxExempt: dto.withholdingTaxExempt,
        agreementReference: dto.agreementReference,
        agreementStartDate: dto.agreementStartDate ? new Date(dto.agreementStartDate) : undefined,
        agreementEndDate: dto.agreementEndDate ? new Date(dto.agreementEndDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  /** PENDING_APPROVAL -> ACTIVE only. */
  async approve(scope: SecurityScope, id: string, approvedById: string) {
    const agent = await this.getAgent(scope, id);
    if (agent.status !== AgentStatus.PENDING_APPROVAL) {
      throw new ConflictException(
        `Agent ${id} cannot be approved from status ${agent.status} — only PENDING_APPROVAL agents can be approved`,
      );
    }
    return this.prisma.agent.update({
      where: { id: agent.id },
      data: { status: AgentStatus.ACTIVE, approvedById, approvedAt: new Date() },
    });
  }

  /** ACTIVE -> SUSPENDED only. */
  async suspend(scope: SecurityScope, id: string, dto: SuspendAgentDto, suspendedById: string) {
    const agent = await this.getAgent(scope, id);
    if (agent.status !== AgentStatus.ACTIVE) {
      throw new ConflictException(
        `Agent ${id} cannot be suspended from status ${agent.status} — only ACTIVE agents can be suspended`,
      );
    }
    return this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: AgentStatus.SUSPENDED,
        suspendedById,
        suspendedAt: new Date(),
        suspendReason: dto.reason,
      },
    });
  }

  /** SUSPENDED -> ACTIVE only — reuses the same `approvedById`/`approvedAt` columns a fresh approval would, since both represent "who most recently authorized this agent to be ACTIVE". */
  async reactivate(scope: SecurityScope, id: string, approvedById: string) {
    const agent = await this.getAgent(scope, id);
    if (agent.status !== AgentStatus.SUSPENDED) {
      throw new ConflictException(
        `Agent ${id} cannot be reactivated from status ${agent.status} — only SUSPENDED agents can be reactivated`,
      );
    }
    return this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: AgentStatus.ACTIVE,
        approvedById,
        approvedAt: new Date(),
        suspendedById: null,
        suspendedAt: null,
        suspendReason: null,
      },
    });
  }

  /** Any non-terminal status -> TERMINATED. Terminal — no method transitions an agent out of TERMINATED; a new Agent record must be created instead. */
  async terminate(scope: SecurityScope, id: string, dto: TerminateAgentDto, terminatedById: string) {
    const agent = await this.getAgent(scope, id);
    if (agent.status === AgentStatus.TERMINATED) {
      throw new ConflictException(`Agent ${id} is already terminated`);
    }
    return this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: AgentStatus.TERMINATED,
        terminatedById,
        terminatedAt: new Date(),
        terminateReason: dto.reason,
      },
    });
  }
}
