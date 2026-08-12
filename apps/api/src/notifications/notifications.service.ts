import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueProducerService } from '../queue/queue-producer.service';
import { EmailTemplateService } from './email-template.service';

export interface CreateNotificationInput {
  userId: string;
  channel?: NotificationChannel;
  metadata?: Record<string, unknown>;
  /**
   * Either supply title+body directly (original behavior, unchanged), or
   * templateCode+templateVariables (Release IC.4) to have EmailTemplateService
   * render them instead — the two are mutually exclusive; templateCode wins
   * if both are somehow provided, since a caller opting into a template
   * presumably wants the template's content, not stray literal text.
   */
  title?: string;
  body?: string;
  templateCode?: string;
  templateVariables?: Record<string, string>;
}

/**
 * Release F — Notifications API.
 *
 * The Notification model, its NotificationChannel/Status enums, and
 * QueueProducerService.enqueueNotification all already existed
 * (worker/src/processors/notification.processor.ts consumes exactly this
 * queue) — nothing in this file is a new calculation or a parallel
 * mechanism. What was missing was the other end of that pipeline: nothing
 * in the API ever created a Notification row or called
 * enqueueNotification, and there was no way for a user to read their own
 * notifications. `create()` below is that missing link; every other
 * domain module should call it going forward instead of writing to
 * `prisma.notification` directly.
 *
 * "Unread" is defined as `readAt IS NULL`, independent of delivery
 * `status` (PENDING/SENT/FAILED) — a FAILED-to-deliver email/SMS
 * notification still shows up in the in-app list until the user (or
 * markAllRead) clears it, since delivery failure isn't the same thing as
 * "the user has seen this."
 *
 * Release IC.4 (Email Template Engine, additive): `create()` now also
 * accepts templateCode/templateVariables as an alternative to literal
 * title/body — EmailTemplateService.render() does the actual substitution,
 * this class just calls it and stores the result. Every existing caller
 * that passes title/body directly is completely unaffected.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueProducer: QueueProducerService,
    private readonly emailTemplates: EmailTemplateService,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    let title = input.title;
    let body = input.body;
    let bodyHtml: string | undefined;

    if (input.templateCode) {
      const rendered = await this.emailTemplates.render(input.templateCode, input.templateVariables ?? {});
      title = rendered.subject;
      body = rendered.text;
      bodyHtml = rendered.html;
    }

    if (!title || !body) {
      throw new BadRequestException('create() requires either title+body or a templateCode that resolves to both');
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title,
        body,
        bodyHtml,
        channel: input.channel ?? NotificationChannel.IN_APP,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });

    await this.queueProducer.enqueueNotification({ notificationId: notification.id });

    return notification;
  }

  async listForUser(
    userId: string,
    filters: { status?: NotificationStatus; channel?: NotificationChannel; unreadOnly?: boolean } = {},
    pagination: { take?: number; skip?: number } = {},
  ) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        status: filters.status,
        channel: filters.channel,
        readAt: filters.unreadOnly ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(pagination.take ?? 25, 100),
      skip: pagination.skip ?? 0,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Marks one notification read. Throws if it doesn't belong to `userId` — a user can only manage their own. */
  async markRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException("Cannot modify another user's notification");

    if (notification.readAt) return notification; // already read — idempotent, not an error

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { count: result.count };
  }

  /**
   * Admin/ops view: delivery counts by status and channel across every
   * user — for spotting a stuck queue or a spike in FAILED deliveries,
   * not for reading any individual's notification content.
   */
  async getDeliveryStats() {
    const [byStatus, byChannel] = await Promise.all([
      this.prisma.notification.groupBy({ by: ['status'], _count: true }),
      this.prisma.notification.groupBy({ by: ['channel'], _count: true }),
    ]);
    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
      byChannel: byChannel.map((r) => ({ channel: r.channel, count: r._count })),
    };
  }
}
