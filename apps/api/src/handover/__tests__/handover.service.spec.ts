import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HandoverStatus, SnagSeverity, SnagSource, SnagStatus } from '@prisma/client';
import { HandoverService } from '../handover.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { RevenueRecognitionService } from '../../revenue-recognition/revenue-recognition.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('HandoverService', () => {
  let service: HandoverService;
  let prisma: any;
  let revenueRecognition: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      unitSaleAllocation: { findUnique: jest.fn() },
      handoverRecord: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      snagItem: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    };
    revenueRecognition = { recognizeOnHandover: jest.fn() };
    notifications = { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HandoverService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: RevenueRecognitionService, useValue: revenueRecognition },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(HandoverService);
  });

  describe('scheduleHandover', () => {
    it('rejects scheduling against a non-existent allocation', async () => {
      prisma.unitSaleAllocation.findUnique.mockResolvedValue(null);
      await expect(
        service.scheduleHandover(
          { allocationId: 'missing', entityId: 'e1', unitId: 'u1', customerId: 'c1', scheduledDate: '2026-08-01' } as any,
          'creator1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects double-scheduling the same allocation', async () => {
      prisma.unitSaleAllocation.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.scheduleHandover(
          { allocationId: 'a1', entityId: 'e1', unitId: 'u1', customerId: 'c1', scheduledDate: '2026-08-01' } as any,
          'creator1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a SCHEDULED handover record', async () => {
      prisma.unitSaleAllocation.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.handoverRecord.findUnique.mockResolvedValue(null);
      prisma.handoverRecord.create.mockResolvedValue({ id: 'h1', status: HandoverStatus.SCHEDULED });

      const result = await service.scheduleHandover(
        { allocationId: 'a1', entityId: 'e1', unitId: 'u1', customerId: 'c1', scheduledDate: '2026-08-01' } as any,
        'creator1',
      );

      expect(result.status).toBe(HandoverStatus.SCHEDULED);
    });
  });

  describe('addSnag', () => {
    it('creates a snag against the handover record and its unit', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', unitId: 'u1', status: HandoverStatus.INSPECTION_DONE });
      prisma.snagItem.create.mockResolvedValue({ id: 's1', status: SnagStatus.OPEN });

      await service.addSnag('h1', { description: 'Cracked tile' } as any, 'reporter1');

      expect(prisma.snagItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            handoverRecordId: 'h1',
            unitId: 'u1',
            description: 'Cracked tile',
            severity: SnagSeverity.MINOR,
            source: SnagSource.HANDOVER_INSPECTION,
            reportedById: 'reporter1',
          }),
        }),
      );
    });

    it('moves an INSPECTION_DONE handover to SNAGS_PENDING when a snag is added', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', unitId: 'u1', status: HandoverStatus.INSPECTION_DONE });
      prisma.snagItem.create.mockResolvedValue({ id: 's1' });

      await service.addSnag('h1', { description: 'Leaking tap' } as any, 'reporter1');

      expect(prisma.handoverRecord.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { status: HandoverStatus.SNAGS_PENDING },
      });
    });

    it('Release F: notifies the assignee when a snag is created with assignedToId', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', unitId: 'u1', status: HandoverStatus.SCHEDULED });
      prisma.snagItem.create.mockResolvedValue({ id: 's1' });

      await service.addSnag('h1', { description: 'Cracked tile', assignedToId: 'user-5' } as any, 'reporter1');

      expect(notifications.create).toHaveBeenCalledWith({
        userId: 'user-5',
        title: 'New snag assigned',
        body: 'Cracked tile',
        metadata: { snagId: 's1', handoverRecordId: 'h1', unitId: 'u1' },
      });
    });

    it('Release F: does not call NotificationsService when no assignedToId is given', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', unitId: 'u1', status: HandoverStatus.SCHEDULED });
      prisma.snagItem.create.mockResolvedValue({ id: 's1' });

      await service.addSnag('h1', { description: 'Cracked tile' } as any, 'reporter1');

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('Release F: a notification failure is swallowed — the snag is still created and returned', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', unitId: 'u1', status: HandoverStatus.SCHEDULED });
      prisma.snagItem.create.mockResolvedValue({ id: 's1', description: 'Cracked tile' });
      notifications.create.mockRejectedValue(new Error('redis unavailable'));

      const result = await service.addSnag('h1', { description: 'Cracked tile', assignedToId: 'user-5' } as any, 'reporter1');

      expect(result).toEqual({ id: 's1', description: 'Cracked tile' });
    });
  });

  describe('verifySnag', () => {
    it('rejects verifying a snag that is not RESOLVED', async () => {
      prisma.snagItem.findUnique.mockResolvedValue({ id: 's1', status: SnagStatus.OPEN });
      await expect(service.verifySnag('s1', 'verifier1')).rejects.toThrow(ConflictException);
    });

    it('verifies a RESOLVED snag', async () => {
      prisma.snagItem.findUnique.mockResolvedValue({ id: 's1', status: SnagStatus.RESOLVED });
      prisma.snagItem.update.mockResolvedValue({ id: 's1', status: SnagStatus.VERIFIED });
      const result = await service.verifySnag('s1', 'verifier1');
      expect(result.status).toBe(SnagStatus.VERIFIED);
    });
  });

  describe('completeHandover', () => {
    it('refuses to complete while snags are still open', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', status: HandoverStatus.SNAGS_PENDING, allocationId: 'a1', unitId: 'u1', entityId: 'e1' });
      prisma.snagItem.count.mockResolvedValue(2);

      await expect(
        service.completeHandover(
          'h1',
          {
            entryDate: '2026-08-05',
            salePrice: 50000,
            costOfUnit: 30000,
            deferredRevenueGlId: 'gl1',
            propertySalesRevenueGlId: 'gl2',
            costOfSalesGlId: 'gl3',
            propertyInventoryGlId: 'gl4',
          } as any,
          'agent1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(revenueRecognition.recognizeOnHandover).not.toHaveBeenCalled();
    });

    it('rejects completing a handover already COMPLETED/CANCELLED', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({ id: 'h1', status: HandoverStatus.COMPLETED });
      await expect(service.completeHandover('h1', {} as any, 'agent1')).rejects.toThrow(ConflictException);
    });

    it('reuses RevenueRecognitionService.recognizeOnHandover rather than posting its own journal entry', async () => {
      prisma.handoverRecord.findUnique.mockResolvedValue({
        id: 'h1',
        status: HandoverStatus.INSPECTION_DONE,
        allocationId: 'a1',
        unitId: 'u1',
        entityId: 'e1',
      });
      prisma.snagItem.count.mockResolvedValue(0);
      revenueRecognition.recognizeOnHandover.mockResolvedValue({ journalEntry: { id: 'je1' }, unitId: 'u1' });
      prisma.handoverRecord.update.mockResolvedValue({ id: 'h1', status: HandoverStatus.COMPLETED });

      const result = await service.completeHandover(
        'h1',
        {
          entryDate: '2026-08-05',
          salePrice: 50000,
          costOfUnit: 30000,
          deferredRevenueGlId: 'gl1',
          propertySalesRevenueGlId: 'gl2',
          costOfSalesGlId: 'gl3',
          propertyInventoryGlId: 'gl4',
        } as any,
        'agent1',
      );

      expect(revenueRecognition.recognizeOnHandover).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'e1', unitId: 'u1', salePrice: 50000, systemUserId: 'agent1' }),
      );
      expect(result.handoverRecord.status).toBe(HandoverStatus.COMPLETED);
    });
  });

  describe('findRecordsForCustomer', () => {
    it('queries by customerId only, no RLS scope — Customer Portal callers are external, not internal SecurityScope-bearing users', async () => {
      const records = [
        { id: 'h1', customerId: 'c1', unitId: 'u1', status: HandoverStatus.SCHEDULED, unit: { id: 'u1', code: 'A-101' }, snags: [] },
      ];
      prisma.handoverRecord.findMany.mockResolvedValue(records);

      const result = await service.findRecordsForCustomer('c1');

      expect(prisma.handoverRecord.findMany).toHaveBeenCalledWith({
        where: { customerId: 'c1' },
        include: { unit: true, snags: { orderBy: { createdAt: 'desc' } } },
        orderBy: { scheduledDate: 'desc' },
      });
      expect(result).toEqual(records);
    });

    it('returns an empty array for a customer with no handover records, rather than throwing', async () => {
      prisma.handoverRecord.findMany.mockResolvedValue([]);
      const result = await service.findRecordsForCustomer('c-no-handovers');
      expect(result).toEqual([]);
    });
  });
});
