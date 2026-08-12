import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const TRUSTED_DEVICE_DAYS = 30;
const RAW_TOKEN_BYTES = 32;

export interface DeviceContext {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

/**
 * Trusted Devices (Release N) — "remember this device for 30 days" MFA
 * bypass, offered at the end of a successful VerifyMfaDto.rememberDevice
 * flow (AuthService.verifyMfaAndLogin). The raw token is generated once,
 * returned to the client to store, and only its SHA-256 hash persisted —
 * identical convention to RefreshToken.tokenHash and
 * MfaRecoveryCode.codeHash, so it is never recoverable from the database.
 */
@Injectable()
export class TrustedDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a new trusted device for userId and returns the PLAINTEXT
   *  token exactly once — the same "only visible at creation" rule as
   *  MfaService.regenerateRecoveryCodes(). */
  async trustDevice(userId: string, context: DeviceContext = {}) {
    const rawToken = crypto.randomBytes(RAW_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRUSTED_DEVICE_DAYS);

    const device = await this.prisma.trustedDevice.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawToken),
        deviceName: context.deviceName,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt,
      },
    });

    return { deviceId: device.id, deviceToken: rawToken, expiresAt };
  }

  /** Used by AuthService.login() to decide whether the MFA challenge can
   *  be skipped. Returns the device's id (to stamp onto the resulting
   *  RefreshToken) when the token is valid, unexpired, and unrevoked —
   *  null otherwise, deliberately never throwing, since an invalid/
   *  missing device token should just fall through to a normal MFA
   *  challenge rather than fail the login outright. */
  async checkTrustedDevice(userId: string, rawToken: string): Promise<string | null> {
    const tokenHash = this.hashToken(rawToken);
    const device = await this.prisma.trustedDevice.findFirst({
      where: { userId, tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });
    if (!device) return null;

    await this.prisma.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
    return device.id;
  }

  /** Self-service: the current user's own trusted devices. */
  listMyDevices(userId: string) {
    return this.prisma.trustedDevice.findMany({
      where: { userId, revoked: false },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        trustedAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: [{ lastUsedAt: 'desc' }, { trustedAt: 'desc' }],
    });
  }

  /** Self-service: revoke one of the caller's own trusted devices. Also
   *  revokes any still-active session that was issued via this device,
   *  so removing trust can't leave a live session standing on it. */
  async revokeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.trustedDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException(`Trusted device ${deviceId} not found`);
    if (device.userId !== userId) throw new ForbiddenException('Cannot revoke a device that is not your own');

    await this.prisma.$transaction([
      this.prisma.trustedDevice.update({ where: { id: deviceId }, data: { revoked: true } }),
      this.prisma.refreshToken.updateMany({ where: { deviceId, revoked: false }, data: { revoked: true } }),
    ]);
  }

  /** Self-service: rename one of the caller's own trusted devices.
   *  Frontend Completion — the one gap my-security/page.tsx's own doc
   *  comment named as blocked on this endpoint not existing; same
   *  ownership-check shape as revokeDevice above, just an update
   *  instead of a revoke, and no cascading RefreshToken effect since
   *  a name is cosmetic. */
  async renameDevice(userId: string, deviceId: string, deviceName: string) {
    const device = await this.prisma.trustedDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException(`Trusted device ${deviceId} not found`);
    if (device.userId !== userId) throw new ForbiddenException('Cannot rename a device that is not your own');

    return this.prisma.trustedDevice.update({ where: { id: deviceId }, data: { deviceName } });
  }

  /** Admin: any user's trusted devices (security.access.view) — Release P. */
  listDevicesForUser(userId: string) {
    return this.listMyDevices(userId);
  }

  /** Admin: force-revoke a device on behalf of a user (e.g. reported lost
   *  or compromised) — security.access.manage, Release P. No ownership
   *  check (that's the self-service path's job); still revokes any live
   *  session issued through the device, same as the self-service version. */
  async revokeDeviceForUser(userId: string, deviceId: string) {
    const device = await this.prisma.trustedDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException(`Trusted device ${deviceId} not found`);
    if (device.userId !== userId) throw new NotFoundException(`Trusted device ${deviceId} not found for this user`);

    await this.prisma.$transaction([
      this.prisma.trustedDevice.update({ where: { id: deviceId }, data: { revoked: true } }),
      this.prisma.refreshToken.updateMany({ where: { deviceId, revoked: false }, data: { revoked: true } }),
    ]);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
