import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, ProspectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { DimensionsService } from '../dimensions/dimensions.service';
import { RealEstateService } from '../real-estate/real-estate.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AssignLeadDto,
  ConvertLeadDto,
  CreateLeadDto,
  CreateProspectDto,
  DisqualifyLeadDto,
  LogActivityDto,
  MarkProspectLostDto,
  ReserveUnitForProspectDto,
} from './dto/crm.dto';

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly dimensions: DimensionsService,
    private readonly realEstate: RealEstateService,
    private readonly notifications: NotificationsService,
  ) {}

  // =====================================================================
  // LEADS
  // =====================================================================

  async createLead(dto: CreateLeadDto, createdById: string) {
    const lead = await this.prisma.lead.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        entityId: dto.entityId,
        projectId: dto.projectId,
        estateId: dto.estateId,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        notes: dto.notes,
        assignedToId: dto.assignedToId,
        createdById,
      },
    });

    await this.notifyAssignment(lead.assignedToId, 'New lead assigned', `${lead.firstName} ${lead.lastName}`, {
      leadId: lead.id,
    });

    return lead;
  }

  findLeads(scope: SecurityScope, filters: { entityId?: string; status?: LeadStatus; assignedToId?: string }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.lead.findMany({
      where: { AND: [rls, filters] },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } }, prospect: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        activities: { orderBy: { occurredAt: 'desc' } },
        prospect: true,
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
    return lead;
  }

  private async requireLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
    return lead;
  }

  async assignLead(leadId: string, dto: AssignLeadDto) {
    const lead = await this.requireLead(leadId);
    const updated = await this.prisma.lead.update({ where: { id: leadId }, data: { assignedToId: dto.assignedToId } });

    if (dto.assignedToId !== lead.assignedToId) {
      await this.notifyAssignment(dto.assignedToId, 'Lead assigned to you', `${lead.firstName} ${lead.lastName}`, {
        leadId,
      });
    }

    return updated;
  }

  /** NEW -> CONTACTED happens implicitly on the first logged activity (see logLeadActivity); this marks a lead ready to convert. */
  async qualifyLead(leadId: string) {
    const lead = await this.requireLead(leadId);
    if (lead.status === LeadStatus.CONVERTED) throw new ConflictException('This lead has already converted');
    if (lead.status === LeadStatus.DISQUALIFIED) throw new ConflictException('This lead is disqualified');
    return this.prisma.lead.update({ where: { id: leadId }, data: { status: LeadStatus.QUALIFIED } });
  }

  async disqualifyLead(leadId: string, dto: DisqualifyLeadDto) {
    const lead = await this.requireLead(leadId);
    if (lead.status === LeadStatus.CONVERTED) throw new ConflictException('This lead has already converted');
    return this.prisma.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.DISQUALIFIED, disqualifiedReason: dto.reason },
    });
  }

  /**
   * Converts a qualified Lead into a Prospect (1:1). Does not touch
   * Customer/Reservation — that only happens later, when the Prospect is
   * ready to reserve a unit (see reserveUnitForProspect).
   */
  async convertLeadToProspect(leadId: string, dto: ConvertLeadDto, createdById: string) {
    const lead = await this.requireLead(leadId);
    if (lead.status === LeadStatus.CONVERTED) throw new ConflictException('This lead has already converted');
    if (lead.status === LeadStatus.DISQUALIFIED) throw new ConflictException('Cannot convert a disqualified lead');

    const existingProspect = await this.prisma.prospect.findUnique({ where: { leadId } });
    if (existingProspect) throw new ConflictException('This lead already has a linked prospect');

    const [, prospect] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.CONVERTED, convertedAt: new Date() },
      }),
      this.prisma.prospect.create({
        data: {
          leadId,
          entityId: lead.entityId,
          projectId: lead.projectId,
          estateId: lead.estateId,
          unitOfInterestId: dto.unitOfInterestId,
          budgetMin: lead.budgetMin,
          budgetMax: lead.budgetMax,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
          assignedToId: lead.assignedToId,
          createdById,
        },
      }),
    ]);

    return prospect;
  }

  // =====================================================================
  // PROSPECTS
  // =====================================================================

  async createProspect(dto: CreateProspectDto, createdById: string) {
    if (dto.existingCustomerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.existingCustomerId } });
      if (!customer) throw new NotFoundException(`Customer ${dto.existingCustomerId} not found`);
    }

    const prospect = await this.prisma.prospect.create({
      data: {
        entityId: dto.entityId,
        projectId: dto.projectId,
        estateId: dto.estateId,
        unitOfInterestId: dto.unitOfInterestId,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
        assignedToId: dto.assignedToId,
        convertedCustomerId: dto.existingCustomerId,
        createdById,
      },
    });

    await this.notifyAssignment(prospect.assignedToId, 'New prospect assigned', `Prospect ${prospect.id}`, {
      prospectId: prospect.id,
    });

    return prospect;
  }

  findProspects(scope: SecurityScope, filters: { entityId?: string; status?: ProspectStatus; assignedToId?: string }) {
    const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
    return this.prisma.prospect.findMany({
      where: { AND: [rls, filters] },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        lead: true,
        unitOfInterest: true,
        convertedCustomer: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProspect(prospectId: string) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        lead: true,
        unitOfInterest: true,
        convertedCustomer: true,
        activities: { orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!prospect) throw new NotFoundException(`Prospect ${prospectId} not found`);
    return prospect;
  }

  private async requireProspect(prospectId: string) {
    const prospect = await this.prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) throw new NotFoundException(`Prospect ${prospectId} not found`);
    return prospect;
  }

  private assertProspectOpen(prospect: { status: ProspectStatus }) {
    if (prospect.status === ProspectStatus.WON || prospect.status === ProspectStatus.LOST) {
      throw new ConflictException(`Prospect is already ${prospect.status}`);
    }
  }

  async scheduleSiteVisit(prospectId: string) {
    const prospect = await this.requireProspect(prospectId);
    this.assertProspectOpen(prospect);
    return this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: ProspectStatus.SITE_VISIT_SCHEDULED },
    });
  }

  async recordSiteVisitDone(prospectId: string) {
    const prospect = await this.requireProspect(prospectId);
    this.assertProspectOpen(prospect);
    return this.prisma.prospect.update({ where: { id: prospectId }, data: { status: ProspectStatus.SITE_VISIT_DONE } });
  }

  async startNegotiation(prospectId: string) {
    const prospect = await this.requireProspect(prospectId);
    this.assertProspectOpen(prospect);
    return this.prisma.prospect.update({ where: { id: prospectId }, data: { status: ProspectStatus.NEGOTIATING } });
  }

  async markProspectLost(prospectId: string, dto: MarkProspectLostDto) {
    const prospect = await this.requireProspect(prospectId);
    this.assertProspectOpen(prospect);
    return this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: ProspectStatus.LOST, lostReason: dto.reason },
    });
  }

  /**
   * Once a sale allocation has actually been confirmed elsewhere (Property
   * Sales / Phase 4 flow, untouched by this module), CRM staff mark the
   * prospect WON so it drops out of the active pipeline. This method does
   * not itself touch UnitSaleAllocation — it only closes out the CRM record.
   */
  async markProspectWon(prospectId: string) {
    const prospect = await this.requireProspect(prospectId);
    this.assertProspectOpen(prospect);
    if (prospect.status !== ProspectStatus.RESERVED) {
      throw new ConflictException('A prospect must be RESERVED before it can be marked WON');
    }
    return this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: ProspectStatus.WON, wonAt: new Date() },
    });
  }

  /**
   * Reserves a unit for this prospect by calling into the existing,
   * untouched RealEstateService.reserveUnit() (Phase 4) — no reservation
   * logic is re-implemented here. If the prospect has no linked Customer
   * yet, one is created first via the existing DimensionsService.createCustomer()
   * helper (also untouched/reused, not duplicated).
   */
  async reserveUnitForProspect(prospectId: string, dto: ReserveUnitForProspectDto, userId: string) {
    const prospect = await this.requireProspect(prospectId);
    this.assertProspectOpen(prospect);

    let customerId = prospect.convertedCustomerId;
    if (!customerId) {
      const lead = prospect.leadId ? await this.prisma.lead.findUnique({ where: { id: prospect.leadId } }) : null;
      const name = lead ? `${lead.firstName} ${lead.lastName}` : dto.customerCode ?? `Prospect ${prospect.id.slice(0, 8)}`;
      // Customer.code is caller-supplied/unique elsewhere in this schema (see
      // DimensionsService.createCustomer); derive a short, collision-safe
      // default from the prospect's own uuid rather than a count-based
      // sequence, since concurrent conversions could otherwise race on count().
      const code = dto.customerCode ?? `CUST-${prospect.id.slice(0, 8).toUpperCase()}`;
      const customer = await this.dimensions.createCustomer(code, name, {
        email: dto.customerEmail ?? lead?.email ?? undefined,
        phone: dto.customerPhone ?? lead?.phone ?? undefined,
      });
      customerId = customer.id;
    }

    const reservation = await this.realEstate.reserveUnit(
      {
        unitId: dto.unitId,
        customerId,
        entityId: dto.entityId,
        projectId: dto.projectId,
        expiresInHours: dto.expiresInHours,
        reservationFee: dto.reservationFee,
      },
      userId,
    );

    const updatedProspect = await this.prisma.prospect.update({
      where: { id: prospectId },
      data: { status: ProspectStatus.RESERVED, convertedCustomerId: customerId, unitOfInterestId: dto.unitId },
    });

    return { prospect: updatedProspect, reservation };
  }

  // =====================================================================
  // ACTIVITIES (shared)
  // =====================================================================

  async logLeadActivity(leadId: string, dto: LogActivityDto, createdById: string) {
    const lead = await this.requireLead(leadId);
    const activity = await this.prisma.crmActivity.create({
      data: {
        leadId,
        activityType: dto.activityType,
        notes: dto.notes,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
        createdById,
      },
    });
    // First contact moves a brand-new lead out of NEW automatically.
    if (lead.status === LeadStatus.NEW) {
      await this.prisma.lead.update({ where: { id: leadId }, data: { status: LeadStatus.CONTACTED } });
    }
    return activity;
  }

  async logProspectActivity(prospectId: string, dto: LogActivityDto, createdById: string) {
    await this.requireProspect(prospectId);
    return this.prisma.crmActivity.create({
      data: {
        prospectId,
        activityType: dto.activityType,
        notes: dto.notes,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
        createdById,
      },
    });
  }

  /** Overdue/upcoming follow-ups across leads and prospects — for a rep's task list or the dashboard. */
  async getUpcomingFollowUps(assignedToId?: string, withinHours = 48) {
    const horizon = new Date(Date.now() + withinHours * 3_600_000);
    const activities = await this.prisma.crmActivity.findMany({
      where: {
        followUpAt: { lte: horizon },
        OR: [
          { lead: assignedToId ? { assignedToId } : undefined },
          { prospect: assignedToId ? { assignedToId } : undefined },
        ],
      },
      include: { lead: true, prospect: true },
      orderBy: { followUpAt: 'asc' },
    });
    return activities;
  }

  // =====================================================================
  // ANALYTICS
  // =====================================================================

  /** Lightweight pipeline counts for Dashboard/Reporting — mirrors the pattern RealEstateService uses for reservation pipeline summary. */
  async getCrmPipelineSummary(entityId?: string) {
    const where = entityId ? { entityId } : {};

    const [leadsBySource, leadsByStatus, prospectsByStatus, wonThisMonth, lostThisMonth] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['source'], where, _count: true }),
      this.prisma.lead.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.prospect.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.prospect.count({ where: { ...where, status: ProspectStatus.WON, wonAt: { gte: startOfMonth() } } }),
      this.prisma.prospect.count({
        where: { ...where, status: ProspectStatus.LOST, updatedAt: { gte: startOfMonth() } },
      }),
    ]);

    const totalLeads = leadsByStatus.reduce((sum, s) => sum + s._count, 0);
    const convertedLeads = leadsByStatus.find((s) => s.status === LeadStatus.CONVERTED)?._count ?? 0;

    return {
      entityId: entityId ?? null,
      totalLeads,
      leadConversionRate: totalLeads > 0 ? convertedLeads / totalLeads : 0,
      leadsBySource: leadsBySource.map((r) => ({ source: r.source, count: r._count })),
      leadsByStatus: leadsByStatus.map((r) => ({ status: r.status, count: r._count })),
      prospectsByStatus: prospectsByStatus.map((r) => ({ status: r.status, count: r._count })),
      wonThisMonth,
      lostThisMonth,
    };
  }

  // =====================================================================
  // NOTIFICATIONS (Release G — Assignment & Workflow Notifications)
  // =====================================================================

  /**
   * Best-effort notification, same pattern HandoverService.addSnag()
   * established as the first caller of NotificationsService.create(): a
   * notification failure must never block the CRM write it's attached to,
   * so it's caught and logged rather than left to fail the request.
   */
  private async notifyAssignment(userId: string | null | undefined, title: string, body: string, metadata: Record<string, unknown>) {
    if (!userId) return;
    try {
      await this.notifications.create({ userId, title, body, metadata });
    } catch {
      // Non-fatal — see doc comment above.
    }
  }
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
