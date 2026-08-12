import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LoginEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginHistoryService, LoginContext } from './login-history.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Account Lockout (Release K). Reuses LoginHistoryService for the
 * ACCOUNT_LOCKED/ACCOUNT_UNLOCKED audit trail rather than writing a
 * second logging path, and NotificationsService (Release F) so the
 * affected user actually finds out — rather than writing to
 * prisma.notification directly. Called from AuthService.validateCredentials()
 * around the existing bcrypt.compare() check, not instead of it.
 */
@Injectable()
export class AccountLockoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loginHistory: LoginHistoryService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Throws if the account is currently locked. */
  assertNotLocked(user: { id: string; lockedUntil: Date | null }) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(`Account is locked until ${user.lockedUntil.toISOString()}`);
    }
  }

  /** Increments failedLoginAttempts; locks the account once the policy's
   *  threshold is reached. Returns the updated user row. */
  async registerFailure(userId: string, email: string, context: LoginContext, policy: { maxFailedLoginAttempts: number; lockoutDurationMinutes: number }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    await this.loginHistory.record(userId, email, LoginEventType.LOGIN_FAILURE, context, 'Invalid credentials');

    if (user.failedLoginAttempts >= policy.maxFailedLoginAttempts) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + policy.lockoutDurationMinutes);
      const locked = await this.prisma.user.update({ where: { id: userId }, data: { lockedUntil } });
      await this.loginHistory.record(userId, email, LoginEventType.ACCOUNT_LOCKED, context, `${user.failedLoginAttempts} failed attempts`);
      await this.notifications.create({
        userId,
        title: 'Your account was locked',
        body: `Too many failed login attempts. Your account is locked until ${lockedUntil.toISOString()}.`,
        metadata: { failedLoginAttempts: user.failedLoginAttempts, lockedUntil: lockedUntil.toISOString() },
      });
      return locked;
    }
    return user;
  }

  /** Clears the failure counter/lock on a successful login. */
  async registerSuccess(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  /** Administrator-triggered unlock, ahead of the automatic expiry. */
  async manualUnlock(userId: string, adminUserId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const unlocked = await this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await this.loginHistory.record(userId, user.email, LoginEventType.ACCOUNT_UNLOCKED, {}, reason ?? `Manually unlocked by ${adminUserId}`);
    await this.notifications.create({
      userId,
      title: 'Your account was unlocked',
      body: reason ? `An administrator unlocked your account: ${reason}` : 'An administrator unlocked your account.',
      metadata: { unlockedBy: adminUserId },
    });
    return unlocked;
  }

  /** Reused by SecurityHardeningController and DashboardService for the
   *  security overview widget: accounts currently locked, plus failed
   *  login / lockout counts in the trailing window. */
  async getOverview(sinceHours = 24) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const [currentlyLocked, failedLogins, lockoutEvents] = await Promise.all([
      this.prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
      this.prisma.loginHistory.count({ where: { eventType: LoginEventType.LOGIN_FAILURE, createdAt: { gte: since } } }),
      this.prisma.loginHistory.count({ where: { eventType: LoginEventType.ACCOUNT_LOCKED, createdAt: { gte: since } } }),
    ]);

    return { sinceHours, currentlyLocked, failedLogins, lockoutEvents };
  }
}
