import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5; // -> 10 hex chars per code, e.g. "a1b2c3d4e5"

/**
 * Release M — MFA (TOTP), QR Enrollment, Recovery Codes.
 *
 * Enrollment is a two-step flow, same shape as everywhere else in this
 * repo that has a "propose then confirm" pattern (e.g. WorkflowEngine's
 * start/act): beginEnrollment() generates a secret and QR code but does
 * NOT enable MFA yet; confirmEnrollment() requires the user to prove
 * they can generate a valid code from it before mfaEnabled flips to
 * true. This prevents a user from locking themselves out by scanning a
 * QR code into the wrong authenticator app and never finding out.
 */
@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService) {}

  async beginEnrollment(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled for this account');

    const secret = generateSecret();
    // Not yet enabled — stored so confirmEnrollment() can verify against
    // it, but mfaEnabled stays false until confirmed.
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    const otpauthUrl = generateURI({ issuer: '7F LedgerOS', label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Verifies the user's first TOTP code, flips mfaEnabled on, and issues
   * one-time recovery codes. Returns the PLAINTEXT recovery codes exactly
   * once — only their SHA-256 hashes are persisted, same convention as
   * RefreshToken.tokenHash, so this is the only moment they're ever
   * visible again.
   */
  async confirmEnrollment(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled for this account');
    if (!user.mfaSecret) throw new BadRequestException('No MFA enrollment in progress — call beginEnrollment first');

    if (!(await this.isValidTotp(user.mfaSecret, token))) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaEnrolledAt: new Date() },
    });

    return this.regenerateRecoveryCodes(userId);
  }

  /** Used by AuthService during the login MFA-challenge step. Accepts
   * either a live TOTP code or an unused recovery code. */
  async verifyLoginCode(userId: string, token: string): Promise<{ usedRecoveryCode: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }

    if (await this.isValidTotp(user.mfaSecret, token)) {
      return { usedRecoveryCode: false };
    }

    const codeHash = this.hashRecoveryCode(token);
    const recoveryCode = await this.prisma.mfaRecoveryCode.findFirst({
      where: { userId, codeHash, usedAt: null },
    });
    if (!recoveryCode) {
      throw new UnauthorizedException('Invalid authenticator code');
    }
    await this.prisma.mfaRecoveryCode.update({ where: { id: recoveryCode.id }, data: { usedAt: new Date() } });
    return { usedRecoveryCode: true };
  }

  async disableMfa(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled) throw new BadRequestException('MFA is not enabled for this account');

    // Deliberately requires a valid live/recovery code, not just the
    // session's bearer token, so a stolen access token alone can't turn
    // MFA off — same "re-prove factor" principle as changePassword()
    // requiring currentPassword.
    await this.verifyLoginCode(userId, token);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null },
      }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    ]);
  }

  async regenerateRecoveryCodesWithAuth(userId: string, token: string) {
    await this.verifyLoginCode(userId, token);
    return this.regenerateRecoveryCodes(userId);
  }

  private async regenerateRecoveryCodes(userId: string) {
    const plaintextCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
    );

    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId, usedAt: null } }),
      this.prisma.mfaRecoveryCode.createMany({
        data: plaintextCodes.map((code) => ({ userId, codeHash: this.hashRecoveryCode(code) })),
      }),
    ]);

    return { recoveryCodes: plaintextCodes };
  }

  /**
   * otplib v13's verify() enforces its own guardrails (e.g. exactly 6
   * digits) and THROWS on a malformed token rather than just returning
   * `{ valid: false }` the way the old v11/v12 `authenticator.check()`
   * did. A recovery code (10 hex chars) is a legitimate, expected input
   * here — it's just not a TOTP code — so any throw is treated the same
   * as an ordinary invalid-code result, not surfaced as a 500.
   */
  private async isValidTotp(secret: string, token: string): Promise<boolean> {
    try {
      const { valid } = await verifyOtp({ secret, token });
      return valid;
    } catch {
      return false;
    }
  }

  private hashRecoveryCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
  }

  /** Dashboard/reporting helper — adoption rate across active users. */
  async getMfaAdoptionOverview() {
    const [totalActive, mfaEnabled] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true, mfaEnabled: true } }),
    ]);
    return {
      totalActiveUsers: totalActive,
      mfaEnabledUsers: mfaEnabled,
      adoptionRatePercent: totalActive > 0 ? Math.round((mfaEnabled / totalActive) * 10000) / 100 : 0,
    };
  }
}
