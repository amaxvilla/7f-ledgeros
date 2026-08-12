import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionService } from '../session.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    refreshToken: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  };
}

describe('SessionService', () => {
  let service: SessionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [SessionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SessionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('listMySessions', () => {
    it('filters to non-revoked, unexpired sessions for the given user', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([]);
      await service.listMySessions('u1');
      const where = prisma.refreshToken.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('u1');
      expect(where.revoked).toBe(false);
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
    });
  });

  describe('revokeMySession', () => {
    it('throws NotFoundException when the session does not exist', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.revokeMySession('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the session belongs to another user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 's1', userId: 'someone-else' });
      await expect(service.revokeMySession('u1', 's1')).rejects.toThrow(ForbiddenException);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('revokes the session when it belongs to the caller', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ id: 's1', userId: 'u1' });
      prisma.refreshToken.update.mockResolvedValue({ id: 's1', revoked: true });
      await service.revokeMySession('u1', 's1');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { revoked: true } });
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes every active session except the one matching the current raw refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.revokeOtherSessions('u1', 'raw-current-token');
      const args = prisma.refreshToken.updateMany.mock.calls[0][0];
      expect(args.where.userId).toBe('u1');
      expect(args.where.revoked).toBe(false);
      expect(args.where.tokenHash.not).toBeDefined();
      expect(result).toEqual({ revokedCount: 3 });
    });
  });

  describe('revokeAllSessionsForUser', () => {
    it('revokes all of a user active sessions with no exclusion', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });
      const result = await service.revokeAllSessionsForUser('u2');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u2', revoked: false },
        data: { revoked: true },
      });
      expect(result).toEqual({ revokedCount: 5 });
    });
  });

  describe('getSessionOverview', () => {
    it('counts active sessions platform-wide', async () => {
      prisma.refreshToken.count.mockResolvedValue(42);
      const result = await service.getSessionOverview();
      expect(result).toEqual({ activeSessions: 42 });
    });
  });
});
