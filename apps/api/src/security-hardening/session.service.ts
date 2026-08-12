import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
}

/**
 * Session Management & Session Revocation (Release N).
 *
 * Deliberately does NOT introduce a separate Session model. RefreshToken
 * already rotates on every /auth/refresh (old row revoked, new row
 * issued) and is 1:1 with a logged-in device for as long as that device
 * stays logged in — so "list my active sessions" is "list my
 * non-revoked, non-expired RefreshToken rows", and "revoke a session" is
 * "revoke that RefreshToken". AuthService.issueTokens() is the only
 * writer of ipAddress/userAgent/deviceId; this service only reads and
 * revokes.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private activeWhere(userId: string) {
    return { userId, revoked: false, expiresAt: { gt: new Date() } };
  }

  /** Self-service: the current user's own active sessions, newest first. */
  listMySessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: this.activeWhere(userId),
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceId: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** Admin: any user's active sessions (security.access.view). */
  listSessionsForUser(userId: string) {
    return this.listMySessions(userId);
  }

  /** Self-service: revoke exactly one of the caller's own sessions. Throws
   *  if the session doesn't exist or belongs to someone else — a user
   *  must never be able to probe or revoke another user's session id. */
  async revokeMySession(userId: string, sessionId: string) {
    const session = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    if (session.userId !== userId) throw new ForbiddenException('Cannot revoke a session that is not your own');

    return this.prisma.refreshToken.update({ where: { id: sessionId }, data: { revoked: true } });
  }

  /** Self-service "log out of all other devices". currentRawRefreshToken
   *  is hashed and excluded so the caller's own in-flight session survives. */
  async revokeOtherSessions(userId: string, currentRawRefreshToken: string) {
    const currentHash = this.hashToken(currentRawRefreshToken);
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false, tokenHash: { not: currentHash } },
      data: { revoked: true },
    });
    return { revokedCount: result.count };
  }

  /** Admin: force-logout every active session for a user (e.g. a
   *  compromised account) — security.access.manage. Unlike
   *  revokeOtherSessions, there is no session to preserve. */
  async revokeAllSessionsForUser(userId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    return { revokedCount: result.count };
  }

  /** Called by AuthService.refresh() so a session's "last active" time
   *  reflects real usage, not just issuance. */
  touchLastUsed(refreshTokenId: string) {
    return this.prisma.refreshToken.update({ where: { id: refreshTokenId }, data: { lastUsedAt: new Date() } });
  }

  /** Dashboard/reporting helper — active session count across the
   *  platform, mirroring getSecurityOverview/getMfaAdoptionOverview's
   *  own-aggregation pattern. */
  async getSessionOverview() {
    const activeSessions = await this.prisma.refreshToken.count({
      where: { revoked: false, expiresAt: { gt: new Date() } },
    });
    return { activeSessions };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
