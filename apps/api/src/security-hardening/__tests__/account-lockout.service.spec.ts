import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AccountLockoutService } from '../account-lockout.service';
import { LoginHistoryService } from '../login-history.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

function buildPrismaMock() {
  return {
    user: { update: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    loginHistory: { count: jest.fn() },
  };
}

describe('AccountLockoutService', () => {
  let service: AccountLockoutService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let loginHistory: { record: jest.Mock };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    loginHistory = { record: jest.fn() };
    notifications = { create: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountLockoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoginHistoryService, useValue: loginHistory },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(AccountLockoutService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('assertNotLocked', () => {
    it('throws when lockedUntil is in the future', () => {
      const future = new Date(Date.now() + 60_000);
      expect(() => service.assertNotLocked({ id: 'u1', lockedUntil: future })).toThrow(ForbiddenException);
    });

    it('does not throw once lockedUntil has passed', () => {
      const past = new Date(Date.now() - 60_000);
      expect(() => service.assertNotLocked({ id: 'u1', lockedUntil: past })).not.toThrow();
    });

    it('does not throw when never locked', () => {
      expect(() => service.assertNotLocked({ id: 'u1', lockedUntil: null })).not.toThrow();
    });
  });

  describe('registerFailure', () => {
    it('increments the counter without locking below the threshold', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u1', failedLoginAttempts: 2 });
      const result = await service.registerFailure('u1', 'a@b.com', {}, { maxFailedLoginAttempts: 5, lockoutDurationMinutes: 30 });
      expect(result.failedLoginAttempts).toBe(2);
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(loginHistory.record).toHaveBeenCalledWith('u1', 'a@b.com', 'LOGIN_FAILURE', {}, 'Invalid credentials');
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('locks the account, records ACCOUNT_LOCKED, and notifies the user once the threshold is reached', async () => {
      prisma.user.update
        .mockResolvedValueOnce({ id: 'u1', failedLoginAttempts: 5 })
        .mockResolvedValueOnce({ id: 'u1', failedLoginAttempts: 5, lockedUntil: new Date() });

      await service.registerFailure('u1', 'a@b.com', {}, { maxFailedLoginAttempts: 5, lockoutDurationMinutes: 30 });

      expect(prisma.user.update).toHaveBeenCalledTimes(2);
      expect(loginHistory.record).toHaveBeenCalledWith('u1', 'a@b.com', 'ACCOUNT_LOCKED', {}, '5 failed attempts');
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Your account was locked' }));
    });
  });

  describe('manualUnlock', () => {
    it('clears the counter/lock, records ACCOUNT_UNLOCKED, and notifies the user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prisma.user.update.mockResolvedValue({ id: 'u1', failedLoginAttempts: 0, lockedUntil: null });

      await service.manualUnlock('u1', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { failedLoginAttempts: 0, lockedUntil: null } });
      expect(loginHistory.record).toHaveBeenCalledWith('u1', 'a@b.com', 'ACCOUNT_UNLOCKED', {}, 'Manually unlocked by admin-1');
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Your account was unlocked' }));
    });
  });

  describe('getOverview', () => {
    it('aggregates currently-locked accounts and windowed failure/lockout counts', async () => {
      prisma.user.count.mockResolvedValue(3);
      prisma.loginHistory.count.mockResolvedValueOnce(12).mockResolvedValueOnce(2);

      const result = await service.getOverview(24);

      expect(result).toEqual({ sinceHours: 24, currentlyLocked: 3, failedLogins: 12, lockoutEvents: 2 });
    });

    it('defaults to a 24 hour window', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.loginHistory.count.mockResolvedValue(0);

      const result = await service.getOverview();
      expect(result.sinceHours).toBe(24);
    });
  });
});
