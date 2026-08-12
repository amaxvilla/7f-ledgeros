import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueProducerService } from '../../queue/queue-producer.service';
import { EmailTemplateService } from '../email-template.service';

function buildPrismaMock() {
  return {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let queueProducer: { enqueueNotification: jest.Mock };
  let emailTemplates: { render: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    queueProducer = { enqueueNotification: jest.fn().mockResolvedValue({ jobId: 'job-1' }) };
    emailTemplates = { render: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueProducerService, useValue: queueProducer },
        { provide: EmailTemplateService, useValue: emailTemplates },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates the row and enqueues it for delivery — the previously-missing link', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-1', userId: 'user-1' });

      const result = await service.create({ userId: 'user-1', title: 'Hello', body: 'World' });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          title: 'Hello',
          body: 'World',
          channel: NotificationChannel.IN_APP,
          metadata: undefined,
        },
      });
      expect(queueProducer.enqueueNotification).toHaveBeenCalledWith({ notificationId: 'notif-1' });
      expect(result).toEqual({ id: 'notif-1', userId: 'user-1' });
    });

    it('defaults to IN_APP but respects an explicit channel', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-2' });
      await service.create({ userId: 'user-1', title: 'T', body: 'B', channel: NotificationChannel.EMAIL });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ channel: NotificationChannel.EMAIL }) }),
      );
    });

    it('renders from a template when templateCode is given, storing subject/text/html from the render result', async () => {
      emailTemplates.render.mockResolvedValue({ subject: 'Welcome, Ada!', text: 'Hi Ada, welcome aboard.', html: '<p>Hi Ada, welcome aboard.</p>' });
      prisma.notification.create.mockResolvedValue({ id: 'notif-3' });

      await service.create({
        userId: 'user-1',
        channel: NotificationChannel.EMAIL,
        templateCode: 'WELCOME_EMAIL',
        templateVariables: { firstName: 'Ada' },
      });

      expect(emailTemplates.render).toHaveBeenCalledWith('WELCOME_EMAIL', { firstName: 'Ada' });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          title: 'Welcome, Ada!',
          body: 'Hi Ada, welcome aboard.',
          bodyHtml: '<p>Hi Ada, welcome aboard.</p>',
          channel: NotificationChannel.EMAIL,
          metadata: undefined,
        },
      });
    });

    it('leaves bodyHtml unset when the rendered template has no html (text-only template)', async () => {
      emailTemplates.render.mockResolvedValue({ subject: 'S', text: 'T', html: undefined });
      prisma.notification.create.mockResolvedValue({ id: 'notif-4' });

      await service.create({ userId: 'user-1', templateCode: 'TEXT_ONLY', templateVariables: {} });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ bodyHtml: undefined }) }),
      );
    });

    it('rejects when neither title+body nor a resolvable templateCode is given', async () => {
      await expect(service.create({ userId: 'user-1' })).rejects.toThrow(BadRequestException);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('scopes to the given user, caps take at 100, and defaults skip to 0', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      await service.listForUser('user-1', {}, { take: 500 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: undefined, channel: undefined, readAt: undefined },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('filters to unread only (readAt IS NULL) when unreadOnly is set', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      await service.listForUser('user-1', { unreadOnly: true });
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ readAt: null }) }),
      );
    });
  });

  describe('unreadCount', () => {
    it('counts by userId + readAt IS NULL', async () => {
      prisma.notification.count.mockResolvedValue(4);
      const result = await service.unreadCount('user-1');
      expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'user-1', readAt: null } });
      expect(result).toBe(4);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException for an unknown notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException for another user's notification", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'someone-else', readAt: null });
      await expect(service.markRead('n1', 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks an unread notification READ with a readAt timestamp', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'user-1', readAt: null });
      prisma.notification.update.mockResolvedValue({ id: 'n1', status: NotificationStatus.READ });

      const result = await service.markRead('n1', 'user-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { status: NotificationStatus.READ, readAt: expect.any(Date) },
      });
      expect(result.status).toBe(NotificationStatus.READ);
    });

    it('is idempotent — an already-read notification is returned as-is without a second update', async () => {
      const alreadyRead = { id: 'n1', userId: 'user-1', readAt: new Date('2026-07-01') };
      prisma.notification.findUnique.mockResolvedValue(alreadyRead);

      const result = await service.markRead('n1', 'user-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result).toBe(alreadyRead);
    });
  });

  describe('markAllRead', () => {
    it('bulk-updates every unread notification for the user and returns the count', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 7 });
      const result = await service.markAllRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { status: NotificationStatus.READ, readAt: expect.any(Date) },
      });
      expect(result).toEqual({ count: 7 });
    });
  });

  describe('getDeliveryStats', () => {
    it('aggregates counts by status and by channel across every user', async () => {
      prisma.notification.groupBy
        .mockResolvedValueOnce([{ status: NotificationStatus.SENT, _count: 10 }, { status: NotificationStatus.FAILED, _count: 2 }])
        .mockResolvedValueOnce([{ channel: NotificationChannel.IN_APP, _count: 8 }, { channel: NotificationChannel.EMAIL, _count: 4 }]);

      const result = await service.getDeliveryStats();

      expect(result).toEqual({
        byStatus: [
          { status: NotificationStatus.SENT, count: 10 },
          { status: NotificationStatus.FAILED, count: 2 },
        ],
        byChannel: [
          { channel: NotificationChannel.IN_APP, count: 8 },
          { channel: NotificationChannel.EMAIL, count: 4 },
        ],
      });
    });
  });
});
