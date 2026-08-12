import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeadStatus, ProspectStatus } from '@prisma/client';
import { CrmService } from '../crm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { DimensionsService } from '../../dimensions/dimensions.service';
import { RealEstateService } from '../../real-estate/real-estate.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('CrmService', () => {
  let service: CrmService;
  let prisma: any;
  let dimensions: any;
  let realEstate: any;
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      lead: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      prospect: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      crmActivity: { create: jest.fn(), findMany: jest.fn() },
      customer: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn))),
    };

    dimensions = { createCustomer: jest.fn() };
    realEstate = { reserveUnit: jest.fn() };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CrmService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: DimensionsService, useValue: dimensions },
        { provide: RealEstateService, useValue: realEstate },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(CrmService);
  });

  describe('createLead', () => {
    it('creates a lead with the given fields', async () => {
      prisma.lead.create.mockResolvedValue({ id: 'l1', status: LeadStatus.NEW, firstName: 'Ada', lastName: 'Okoye', assignedToId: null });

      const result = await service.createLead(
        { entityId: 'e1', firstName: 'Ada', lastName: 'Okoye' } as any,
        'u1',
      );

      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ firstName: 'Ada', createdById: 'u1' }) }),
      );
      expect(result.id).toBe('l1');
    });

    it('notifies the assigned agent when a lead is created pre-assigned (Release G)', async () => {
      prisma.lead.create.mockResolvedValue({ id: 'l1', firstName: 'Ada', lastName: 'Okoye', assignedToId: 'agent1' });

      await service.createLead({ entityId: 'e1', firstName: 'Ada', lastName: 'Okoye', assignedToId: 'agent1' } as any, 'u1');

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'agent1', title: 'New lead assigned' }),
      );
    });

    it('does not notify when no agent is assigned at creation', async () => {
      prisma.lead.create.mockResolvedValue({ id: 'l1', firstName: 'Ada', lastName: 'Okoye', assignedToId: null });
      await service.createLead({ entityId: 'e1', firstName: 'Ada', lastName: 'Okoye' } as any, 'u1');
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('assignLead notifications (Release G)', () => {
    it('notifies the newly-assigned agent', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', firstName: 'Ada', lastName: 'Okoye', status: LeadStatus.NEW, assignedToId: null });
      prisma.lead.update.mockResolvedValue({ id: 'l1', assignedToId: 'agent2' });

      await service.assignLead('l1', { assignedToId: 'agent2' } as any);

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'agent2', title: 'Lead assigned to you' }),
      );
    });

    it('skips the notification when the assignee is unchanged', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', firstName: 'Ada', lastName: 'Okoye', status: LeadStatus.NEW, assignedToId: 'agent2' });
      prisma.lead.update.mockResolvedValue({ id: 'l1', assignedToId: 'agent2' });

      await service.assignLead('l1', { assignedToId: 'agent2' } as any);

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('qualifyLead', () => {
    it('throws NotFoundException for a missing lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.qualifyLead('missing')).rejects.toThrow(NotFoundException);
    });

    it('rejects qualifying an already-converted lead', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: LeadStatus.CONVERTED });
      await expect(service.qualifyLead('l1')).rejects.toThrow(ConflictException);
    });

    it('moves a NEW lead to QUALIFIED', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: LeadStatus.NEW });
      prisma.lead.update.mockResolvedValue({ id: 'l1', status: LeadStatus.QUALIFIED });

      const result = await service.qualifyLead('l1');

      expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { status: LeadStatus.QUALIFIED } });
      expect(result.status).toBe(LeadStatus.QUALIFIED);
    });
  });

  describe('createProspect notifications (Release G)', () => {
    it('notifies the assigned agent when a prospect is created pre-assigned', async () => {
      prisma.prospect.create.mockResolvedValue({ id: 'p1', assignedToId: 'agent3' });

      await service.createProspect({ entityId: 'e1', assignedToId: 'agent3' } as any, 'u1');

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'agent3', title: 'New prospect assigned' }),
      );
    });

    it('does not notify when no agent is assigned at creation', async () => {
      prisma.prospect.create.mockResolvedValue({ id: 'p1', assignedToId: null });
      await service.createProspect({ entityId: 'e1' } as any, 'u1');
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('convertLeadToProspect', () => {
    it('rejects converting a disqualified lead', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: LeadStatus.DISQUALIFIED });
      await expect(service.convertLeadToProspect('l1', {}, 'u1')).rejects.toThrow(ConflictException);
    });

    it('rejects converting a lead that already has a linked prospect', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: LeadStatus.QUALIFIED });
      prisma.prospect.findUnique.mockResolvedValue({ id: 'p1' });
      await expect(service.convertLeadToProspect('l1', {}, 'u1')).rejects.toThrow(ConflictException);
    });

    it('marks the lead CONVERTED and creates a linked prospect', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        id: 'l1',
        status: LeadStatus.QUALIFIED,
        entityId: 'e1',
        projectId: null,
        estateId: null,
        budgetMin: null,
        budgetMax: null,
        assignedToId: null,
      });
      prisma.prospect.findUnique.mockResolvedValue(null);
      prisma.lead.update.mockResolvedValue({ id: 'l1', status: LeadStatus.CONVERTED });
      prisma.prospect.create.mockResolvedValue({ id: 'p1', leadId: 'l1', status: ProspectStatus.ACTIVE });

      const result = await service.convertLeadToProspect('l1', {}, 'u1');

      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ status: LeadStatus.CONVERTED }) }),
      );
      expect(prisma.prospect.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leadId: 'l1', createdById: 'u1' }) }),
      );
      expect(result.id).toBe('p1');
    });
  });

  describe('markProspectWon', () => {
    it('rejects marking WON a prospect that is not RESERVED', async () => {
      prisma.prospect.findUnique.mockResolvedValue({ id: 'p1', status: ProspectStatus.NEGOTIATING });
      await expect(service.markProspectWon('p1')).rejects.toThrow(ConflictException);
    });

    it('rejects acting on a prospect already WON/LOST', async () => {
      prisma.prospect.findUnique.mockResolvedValue({ id: 'p1', status: ProspectStatus.LOST });
      await expect(service.markProspectWon('p1')).rejects.toThrow(ConflictException);
    });

    it('marks a RESERVED prospect WON', async () => {
      prisma.prospect.findUnique.mockResolvedValue({ id: 'p1', status: ProspectStatus.RESERVED });
      prisma.prospect.update.mockResolvedValue({ id: 'p1', status: ProspectStatus.WON });

      const result = await service.markProspectWon('p1');

      expect(prisma.prospect.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ status: ProspectStatus.WON }) }),
      );
      expect(result.status).toBe(ProspectStatus.WON);
    });
  });

  describe('reserveUnitForProspect', () => {
    it('reuses RealEstateService.reserveUnit rather than reimplementing reservation logic', async () => {
      prisma.prospect.findUnique.mockResolvedValue({
        id: 'p1',
        status: ProspectStatus.NEGOTIATING,
        leadId: null,
        convertedCustomerId: null,
        code: undefined,
      });
      dimensions.createCustomer.mockResolvedValue({ id: 'c1' });
      realEstate.reserveUnit.mockResolvedValue({ id: 'r1' });
      prisma.prospect.update.mockResolvedValue({ id: 'p1', status: ProspectStatus.RESERVED, convertedCustomerId: 'c1' });

      const result = await service.reserveUnitForProspect(
        'p1',
        { unitId: 'u1', entityId: 'e1', projectId: 'proj1', expiresInHours: 72 } as any,
        'user1',
      );

      expect(dimensions.createCustomer).toHaveBeenCalled();
      expect(realEstate.reserveUnit).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: 'u1', customerId: 'c1', entityId: 'e1', projectId: 'proj1' }),
        'user1',
      );
      expect(result.reservation).toEqual({ id: 'r1' });
      expect(result.prospect.status).toBe(ProspectStatus.RESERVED);
    });

    it('reuses an existing customer instead of creating a duplicate one', async () => {
      prisma.prospect.findUnique.mockResolvedValue({
        id: 'p1',
        status: ProspectStatus.NEGOTIATING,
        leadId: null,
        convertedCustomerId: 'existing-cust',
      });
      realEstate.reserveUnit.mockResolvedValue({ id: 'r2' });
      prisma.prospect.update.mockResolvedValue({ id: 'p1', status: ProspectStatus.RESERVED });

      await service.reserveUnitForProspect(
        'p1',
        { unitId: 'u1', entityId: 'e1', projectId: 'proj1', expiresInHours: 72 } as any,
        'user1',
      );

      expect(dimensions.createCustomer).not.toHaveBeenCalled();
      expect(realEstate.reserveUnit).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'existing-cust' }),
        'user1',
      );
    });

    it('rejects reserving for a prospect already WON/LOST', async () => {
      prisma.prospect.findUnique.mockResolvedValue({ id: 'p1', status: ProspectStatus.WON });
      await expect(
        service.reserveUnitForProspect('p1', { unitId: 'u1', entityId: 'e1', projectId: 'proj1', expiresInHours: 72 } as any, 'user1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('logLeadActivity', () => {
    it('moves a NEW lead to CONTACTED on first activity', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: LeadStatus.NEW });
      prisma.crmActivity.create.mockResolvedValue({ id: 'a1' });

      await service.logLeadActivity('l1', { activityType: 'CALL' } as any, 'u1');

      expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { status: LeadStatus.CONTACTED } });
    });

    it('does not touch status for a lead already past NEW', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'l1', status: LeadStatus.QUALIFIED });
      prisma.crmActivity.create.mockResolvedValue({ id: 'a1' });

      await service.logLeadActivity('l1', { activityType: 'CALL' } as any, 'u1');

      expect(prisma.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('getCrmPipelineSummary', () => {
    it('computes lead conversion rate from grouped counts', async () => {
      prisma.lead.groupBy
        .mockResolvedValueOnce([{ source: 'WEBSITE', _count: 3 }, { source: 'REFERRAL', _count: 2 }])
        .mockResolvedValueOnce([
          { status: LeadStatus.NEW, _count: 2 },
          { status: LeadStatus.CONVERTED, _count: 3 },
        ]);
      prisma.prospect.groupBy.mockResolvedValue([{ status: ProspectStatus.ACTIVE, _count: 1 }]);
      prisma.prospect.count.mockResolvedValue(0);

      const result = await service.getCrmPipelineSummary('e1');

      expect(result.totalLeads).toBe(5);
      expect(result.leadConversionRate).toBeCloseTo(0.6);
    });
  });
});
