import { getJwtAccessSecret } from '../common/config/jwt-secret';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordPolicyService } from '../security-hardening/password-policy.service';
import { LoginHistoryService, LoginContext } from '../security-hardening/login-history.service';
import { AccountLockoutService } from '../security-hardening/account-lockout.service';
import { MfaService } from '../security-hardening/mfa.service';
import { SessionService } from '../security-hardening/session.service';
import { TrustedDeviceService } from '../security-hardening/trusted-device.service';
import { IpRestrictionService } from '../security-hardening/ip-restriction.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly loginHistory: LoginHistoryService,
    private readonly accountLockout: AccountLockoutService,
    private readonly mfa: MfaService,
    private readonly sessions: SessionService,
    private readonly trustedDevices: TrustedDeviceService,
    private readonly ipRestriction: IpRestrictionService,
  ) {}

  /** Unchanged core credential check (bcrypt.compare against
   *  passwordHash) — Release K wraps this in login() with lockout/
   *  history recording rather than modifying the check itself. */
  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  /** Release K: account lockout check before the credential check, and
   *  login-history recording + lockout-counter reset/increment around
   *  it. The bcrypt comparison itself (validateCredentials) and token
   *  issuance (issueTokens) are unchanged from before this release.
   *  Release N: an optional deviceToken lets a previously-trusted device
   *  skip the MFA challenge entirely (checked only when MFA is actually
   *  enabled — an invalid/missing token here never blocks a non-MFA
   *  login, it only matters for the trusted-device bypass). */
  async login(email: string, password: string, context: LoginContext = {}, deviceToken?: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      this.accountLockout.assertNotLocked(existingUser);
    }

    let user;
    try {
      user = await this.validateCredentials(email, password);
    } catch (err) {
      if (existingUser) {
        await this.accountLockout.registerFailure(existingUser.id, email, context, await this.passwordPolicy.getEffectivePolicy());
      } else {
        await this.loginHistory.record(null, email, LoginEventType.LOGIN_FAILURE, context, 'Unknown email');
      }
      throw err;
    }

    await this.accountLockout.registerSuccess(user.id);

    // Release P — IP Restrictions: checked after credentials validate
    // (so we know which user's USER-scoped rules apply) and before any
    // MFA/token decision is made — an IP-blocked caller with the right
    // password still doesn't get a challenge token or a hint about
    // whether MFA is enabled.
    const ipAllowed = await this.ipRestriction.isIpAllowed(context.ipAddress, user.id);
    if (!ipAllowed) {
      await this.loginHistory.record(user.id, email, LoginEventType.LOGIN_FAILURE, context, 'IP address not allowlisted');
      throw new ForbiddenException('This IP address is not permitted to access this account');
    }

    const policy = await this.passwordPolicy.getEffectivePolicy();
    const passwordExpired = this.passwordPolicy.isExpired(user.passwordChangedAt, policy.expiryDays);

    if (user.mfaEnabled) {
      const trustedDeviceId = deviceToken ? await this.trustedDevices.checkTrustedDevice(user.id, deviceToken) : null;
      if (trustedDeviceId) {
        await this.loginHistory.record(user.id, email, LoginEventType.LOGIN_SUCCESS, context, 'MFA skipped — trusted device');
        const tokens = await this.issueTokens(user.id, user.email, { ...context, deviceId: trustedDeviceId });
        return { ...tokens, mfaRequired: false, passwordExpired };
      }

      // Release M: if MFA is enabled and no trusted device matched, don't
      // issue real tokens yet — issue a short-lived challenge token instead
      // and require a second call to verifyMfaAndLogin() with a TOTP/
      // recovery code. The password step above (and its lockout/history
      // recording) is already complete and unchanged; this only gates the
      // FINAL token issuance.
      await this.loginHistory.record(user.id, email, LoginEventType.LOGIN_SUCCESS, context, 'Password verified — MFA challenge pending');
      const challengeToken = await this.jwt.signAsync(
        { sub: user.id, typ: 'mfa-challenge' },
        { secret: getJwtAccessSecret(), expiresIn: '5m' },
      );
      return { mfaRequired: true, challengeToken, passwordExpired };
    }

    await this.loginHistory.record(user.id, email, LoginEventType.LOGIN_SUCCESS, context);
    const tokens = await this.issueTokens(user.id, user.email, context);
    return { ...tokens, mfaRequired: false, passwordExpired };
  }

  /** Release M: second step of login when the account has MFA enabled.
   * challengeToken proves the password step already succeeded (signed by
   * this same service, 5-minute expiry); token is the TOTP/recovery code.
   * Release N: if rememberDevice is set, a TrustedDevice is created and
   * its raw token returned exactly once so the client can skip this step
   * on future logins from the same device. */
  async verifyMfaAndLogin(
    challengeToken: string,
    token: string,
    context: LoginContext = {},
    rememberDevice = false,
    deviceName?: string,
  ) {
    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(challengeToken, { secret: getJwtAccessSecret() });
    } catch {
      throw new UnauthorizedException('MFA challenge expired or invalid — please log in again');
    }
    if (payload.typ !== 'mfa-challenge') {
      throw new UnauthorizedException('Invalid challenge token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { usedRecoveryCode } = await this.mfa.verifyLoginCode(user.id, token);
    await this.loginHistory.record(
      user.id,
      user.email,
      LoginEventType.LOGIN_SUCCESS,
      context,
      usedRecoveryCode ? 'MFA via recovery code' : 'MFA via TOTP',
    );

    let deviceToken: string | undefined;
    let deviceId: string | undefined;
    if (rememberDevice) {
      const trusted = await this.trustedDevices.trustDevice(user.id, { ...context, deviceName });
      deviceToken = trusted.deviceToken;
      deviceId = trusted.deviceId;
    }

    const tokens = await this.issueTokens(user.id, user.email, { ...context, deviceId });
    return { ...tokens, usedRecoveryCode, deviceToken };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Release N: mark the outgoing session as last-used right before it
    // rotates out, then carry its ip/userAgent/deviceId forward onto the
    // replacement row so a session's device attribution survives rotation.
    await this.sessions.touchLastUsed(stored.id);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(stored.user.id, stored.user.email, {
      ipAddress: stored.ipAddress ?? undefined,
      userAgent: stored.userAgent ?? undefined,
      deviceId: stored.deviceId ?? undefined,
    });
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
    if (stored) {
      const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
      if (user) await this.loginHistory.record(user.id, user.email, LoginEventType.LOGOUT, {});
    }
  }

  /** Release N: context carries ipAddress/userAgent/deviceId through onto
   *  the created RefreshToken row, so every session is attributable from
   *  the moment it's issued (login, MFA verification, and refresh
   *  rotation all pass their context through here). */
  private async issueTokens(
    userId: string,
    email: string,
    context: { ipAddress?: string; userAgent?: string; deviceId?: string } = {},
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: getJwtAccessSecret(),
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.getRefreshTokenExpiryDays());

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceId: context.deviceId,
        lastUsedAt: new Date(),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: 900 };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiryDays(): number {
    const raw = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    const match = /^(\d+)d$/.exec(raw.trim());
    if (!match) {
      // Only whole-day values are supported for the refresh token's DB expiry
      // (unlike the access token, this isn't parsed by a JWT library).
      return 7;
    }
    return Number(match[1]);
  }
}
