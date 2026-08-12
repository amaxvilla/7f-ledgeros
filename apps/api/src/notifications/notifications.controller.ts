import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PERMISSIONS } from '@7f/config';
import { NotificationsService } from './notifications.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Release F — Notifications API. Every endpoint here except
 * delivery-stats is self-service (a user managing their own
 * notifications) and needs no special permission beyond a valid JWT —
 * same convention as /auth/sessions and /auth/login-history elsewhere
 * in this codebase.
 *
 * "Unread" (confirmed directly against `NotificationsService`'s own
 * doc comment) is `readAt IS NULL`, independent of delivery `status` —
 * a notification whose delivery FAILED still counts as unread and
 * still appears in `list`/`unread-count` until the user reads it or
 * `read-all` clears it; delivery failure isn't the same thing as "the
 * user has seen this."
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my own notifications',
    description: 'Optional status/channel/unreadOnly filters, newest first. take is capped at 100 regardless of what is requested (defaults to 25).',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: NotificationStatus,
    @Query('channel') channel?: NotificationChannel,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.notifications.listForUser(
      user.id,
      { status, channel, unreadOnly: unreadOnly === 'true' },
      { take: take ? Number(take) : undefined, skip: skip ? Number(skip) : undefined },
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get my own unread notification count' })
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Get('admin/delivery-stats')
  @ApiOperation({
    summary: 'Get system-wide notification delivery stats (admin)',
    description: 'Counts by status and by channel across every user\'s notifications — an operational view for spotting a stuck queue or a spike in FAILED deliveries, not a way to read any individual\'s notification content.',
  })
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_ADMIN_VIEW)
  getDeliveryStats() {
    return this.notifications.getDeliveryStats();
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one of my own notifications read', description: 'Rejected (403) if the notification does not belong to the caller. Idempotent — marking an already-read notification read again just returns it unchanged, not an error.' })
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(id, user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark every one of my own unread notifications read', description: 'A single bulk update; returns how many were marked.' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }
}
