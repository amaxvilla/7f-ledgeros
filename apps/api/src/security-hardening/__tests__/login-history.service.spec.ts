import { Test } from '@nestjs/testing';
import { LoginEventType } from '@prisma/client';
import { LoginHistoryService } from '../login-history.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LoginHistoryService', () => {
  let service: LoginHistoryService;
  let prisma: { loginHistory: { create: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { loginHistory: { create: jest.fn(), findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [LoginHistoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LoginHistoryService);
  });

  describe('record', () => {
    it('writes ipAddress/userAgent from context and an optional failure reason', async () => {
      await service.record('u1', 'a@b.com', LoginEventType.LOGIN_FAILURE, { ipAddress: '10.0.0.1', userAgent: 'curl/8' }, 'Invalid credentials');

      expect(prisma.loginHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          emailAttempted: 'a@b.com',
          eventType: LoginEventType.LOGIN_FAILURE,
          ipAddress: '10.0.0.1',
          userAgent: 'curl/8',
          failureReason: 'Invalid credentials',
        },
      });
    });

    it('records a null userId for attempts against an unknown email', async () => {
      await service.record(null, 'nobody@example.com', LoginEventType.LOGIN_FAILURE, {}, 'Unknown email');
      expect(prisma.loginHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: null, emailAttempted: 'nobody@example.com' }) }),
      );
    });

    it('defaults context to empty when omitted', async () => {
      await service.record('u1', 'a@b.com', LoginEventType.LOGOUT);
      expect(prisma.loginHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ipAddress: undefined, userAgent: undefined }) }),
      );
    });
  });

  describe('findForUser', () => {
    it('queries by userId, newest first, capped at the given limit', async () => {
      prisma.loginHistory.findMany.mockResolvedValue([]);
      await service.findForUser('u1', 10);
      expect(prisma.loginHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('defaults the limit to 50', async () => {
      prisma.loginHistory.findMany.mockResolvedValue([]);
      await service.findForUser('u1');
      expect(prisma.loginHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });
  });

  describe('findRecent', () => {
    it('filters by the provided fields only', async () => {
      prisma.loginHistory.findMany.mockResolvedValue([]);
      await service.findRecent({ eventType: LoginEventType.ACCOUNT_LOCKED }, 5);
      expect(prisma.loginHistory.findMany).toHaveBeenCalledWith({
        where: { eventType: LoginEventType.ACCOUNT_LOCKED },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });

    it('defaults the limit to 100', async () => {
      prisma.loginHistory.findMany.mockResolvedValue([]);
      await service.findRecent({});
      expect(prisma.loginHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });
});
