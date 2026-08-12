import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordPolicyService } from '../../security-hardening/password-policy.service';
import { LoginHistoryService } from '../../security-hardening/login-history.service';
import { AccountLockoutService } from '../../security-hardening/account-lockout.service';
import { MfaService } from '../../security-hardening/mfa.service';
import { SessionService } from '../../security-hardening/session.service';
import { TrustedDeviceService } from '../../security-hardening/trusted-device.service';
import { IpRestrictionService } from '../../security-hardening/ip-restriction.service';

function buildPrismaMock() {
  return { user: { findUnique: jest.fn() }, refreshToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() } };
}

describe('AuthService (Release K/M/N/P integration)', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let passwordPolicy: { getEffectivePolicy: jest.Mock; isExpired: jest.Mock };
  let loginHistory: { record: jest.Mock };
  let accountLockout: { assertNotLocked: jest.Mock; registerFailure: jest.Mock; registerSuccess: jest.Mock };
  let mfa: { verifyLoginCode: jest.Mock };
  let sessions: { touchLastUsed: jest.Mock };
  let trustedDevices: { checkTrustedDevice: jest.Mock; trustDevice: jest.Mock };
  let ipRestriction: { isIpAllowed: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    passwordPolicy = { getEffectivePolicy: jest.fn().mockResolvedValue({ expiryDays: null }), isExpired: jest.fn().mockReturnValue(false) };
    loginHistory = { record: jest.fn() };
    accountLockout = { assertNotLocked: jest.fn(), registerFailure: jest.fn(), registerSuccess: jest.fn() };
    mfa = { verifyLoginCode: jest.fn() };
    sessions = { touchLastUsed: jest.fn() };
    trustedDevices = { checkTrustedDevice: jest.fn(), trustDevice: jest.fn() };
    ipRestriction = { isIpAllowed: jest.fn().mockResolvedValue(true) }; // unrestricted by default in existing tests
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-jwt'), verifyAsync: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: PasswordPolicyService, useValue: passwordPolicy },
        { provide: LoginHistoryService, useValue: loginHistory },
        { provide: AccountLockoutService, useValue: accountLockout },
        { provide: MfaService, useValue: mfa },
        { provide: SessionService, useValue: sessions },
        { provide: TrustedDeviceService, useValue: trustedDevices },
        { provide: IpRestrictionService, useValue: ipRestriction },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('checks lockout before validating credentials, and propagates a lockout rejection', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', lockedUntil: new Date() });
    accountLockout.assertNotLocked.mockImplementation(() => {
      throw new ForbiddenException('locked');
    });

    await expect(service.login('a@b.com', 'whatever')).rejects.toThrow(ForbiddenException);
    expect(accountLockout.registerFailure).not.toHaveBeenCalled();
  });

  it('registers a failure and records LOGIN_FAILURE on a wrong password, without locking below threshold', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null });

    await expect(service.login('a@b.com', 'wrong')).rejects.toThrow(UnauthorizedException);

    expect(accountLockout.registerFailure).toHaveBeenCalledWith('u1', 'a@b.com', {}, { expiryDays: null });
  });

  it('records LOGIN_FAILURE for an unknown email without touching AccountLockoutService', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('nobody@x.com', 'whatever')).rejects.toThrow(UnauthorizedException);

    expect(accountLockout.registerFailure).not.toHaveBeenCalled();
    expect(loginHistory.record).toHaveBeenCalledWith(null, 'nobody@x.com', 'LOGIN_FAILURE', {}, 'Unknown email');
  });

  it('resets the lockout counter and returns tokens plus passwordExpired on success', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null });
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login('a@b.com', 'correct');

    expect(accountLockout.registerSuccess).toHaveBeenCalledWith('u1');
    expect(loginHistory.record).toHaveBeenCalledWith('u1', 'a@b.com', 'LOGIN_SUCCESS', {});
    if (!('accessToken' in result)) throw new Error('expected a token result, got an MFA challenge');
    expect(result.accessToken).toBe('signed-jwt');
    expect(result.passwordExpired).toBe(false);
  });

  it('flags passwordExpired when PasswordPolicyService.isExpired returns true', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: new Date('2020-01-01') });
    prisma.refreshToken.create.mockResolvedValue({});
    passwordPolicy.isExpired.mockReturnValue(true);

    const result = await service.login('a@b.com', 'correct');

    expect(result.passwordExpired).toBe(true);
  });

  // Release M — MFA login challenge
  describe('login() with MFA enabled', () => {
    it('does not issue real tokens — returns a challenge instead', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null, mfaEnabled: true,
      });

      const result = await service.login('a@b.com', 'correct');

      expect(result.mfaRequired).toBe(true);
      expect(result.challengeToken).toBe('signed-jwt');
      expect(result).not.toHaveProperty('accessToken');
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      // Lockout/history recording for the password step still happens —
      // MFA only gates the FINAL token issuance, not the password check.
      expect(accountLockout.registerSuccess).toHaveBeenCalledWith('u1');
      expect(loginHistory.record).toHaveBeenCalledWith(
        'u1',
        'a@b.com',
        'LOGIN_SUCCESS',
        {},
        'Password verified — MFA challenge pending',
      );
    });

    it('sets mfaRequired: false for an account without MFA enabled', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null, mfaEnabled: false,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('a@b.com', 'correct');
      expect(result.mfaRequired).toBe(false);
      if (!('accessToken' in result)) throw new Error('expected a token result, got an MFA challenge');
      expect(result.accessToken).toBe('signed-jwt');
    });
  });

  describe('verifyMfaAndLogin', () => {
    it('rejects an expired or invalid challenge token', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('expired'));
      await expect(service.verifyMfaAndLogin('bad-token', '123456')).rejects.toThrow(UnauthorizedException);
      expect(mfa.verifyLoginCode).not.toHaveBeenCalled();
    });

    it('rejects a challenge token that is not typ: mfa-challenge', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', typ: 'something-else' });
      await expect(service.verifyMfaAndLogin('token', '123456')).rejects.toThrow(UnauthorizedException);
    });

    it('issues real tokens once the second-factor code is verified', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', typ: 'mfa-challenge' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true });
      mfa.verifyLoginCode.mockResolvedValue({ usedRecoveryCode: false });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyMfaAndLogin('challenge-token', '654321');

      expect(mfa.verifyLoginCode).toHaveBeenCalledWith('u1', '654321');
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.usedRecoveryCode).toBe(false);
      expect(loginHistory.record).toHaveBeenCalledWith('u1', 'a@b.com', 'LOGIN_SUCCESS', {}, 'MFA via TOTP');
    });

    it('propagates an invalid second-factor code as UnauthorizedException', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', typ: 'mfa-challenge' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true });
      mfa.verifyLoginCode.mockRejectedValue(new UnauthorizedException('Invalid authenticator code'));

      await expect(service.verifyMfaAndLogin('challenge-token', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  // Release N — trusted-device MFA bypass
  describe('login() with a trusted device token', () => {
    it('skips the MFA challenge and issues real tokens when the device is trusted', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null, mfaEnabled: true,
      });
      trustedDevices.checkTrustedDevice.mockResolvedValue('device-1');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('a@b.com', 'correct', {}, 'raw-device-token');

      expect(trustedDevices.checkTrustedDevice).toHaveBeenCalledWith('u1', 'raw-device-token');
      expect(result.mfaRequired).toBe(false);
      if (!('accessToken' in result)) throw new Error('expected a token result, got an MFA challenge');
      expect(result.accessToken).toBe('signed-jwt');
      expect(loginHistory.record).toHaveBeenCalledWith('u1', 'a@b.com', 'LOGIN_SUCCESS', {}, 'MFA skipped — trusted device');
    });

    it('falls back to a normal MFA challenge when the device token does not match', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null, mfaEnabled: true,
      });
      trustedDevices.checkTrustedDevice.mockResolvedValue(null);

      const result = await service.login('a@b.com', 'correct', {}, 'stale-device-token');

      expect(result.mfaRequired).toBe(true);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyMfaAndLogin() with rememberDevice', () => {
    it('creates a trusted device and returns its plaintext token alongside real tokens', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', typ: 'mfa-challenge' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true });
      mfa.verifyLoginCode.mockResolvedValue({ usedRecoveryCode: false });
      trustedDevices.trustDevice.mockResolvedValue({ deviceId: 'device-1', deviceToken: 'raw-new-device-token' });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyMfaAndLogin('challenge-token', '654321', {}, true, 'My Laptop');

      expect(trustedDevices.trustDevice).toHaveBeenCalledWith('u1', { deviceName: 'My Laptop' });
      expect(result.deviceToken).toBe('raw-new-device-token');
      expect(result.accessToken).toBe('signed-jwt');
    });

    it('does not create a trusted device when rememberDevice is false', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1', typ: 'mfa-challenge' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', isActive: true });
      mfa.verifyLoginCode.mockResolvedValue({ usedRecoveryCode: false });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyMfaAndLogin('challenge-token', '654321');

      expect(trustedDevices.trustDevice).not.toHaveBeenCalled();
      expect(result.deviceToken).toBeUndefined();
    });
  });

  // Release P — IP Restrictions
  describe('login() with IP restrictions', () => {
    it('rejects with ForbiddenException and records a failure when the IP is not allowlisted', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null, mfaEnabled: false,
      });
      ipRestriction.isIpAllowed.mockResolvedValue(false);

      await expect(service.login('a@b.com', 'correct', { ipAddress: '198.51.100.7' })).rejects.toThrow(ForbiddenException);

      expect(ipRestriction.isIpAllowed).toHaveBeenCalledWith('198.51.100.7', 'u1');
      expect(loginHistory.record).toHaveBeenCalledWith(
        'u1', 'a@b.com', 'LOGIN_FAILURE', { ipAddress: '198.51.100.7' }, 'IP address not allowlisted',
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('does not check IP restriction until after credentials validate', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: await bcrypt.hash('correct', 10), lockedUntil: null,
      });

      await expect(service.login('a@b.com', 'WRONG', {})).rejects.toThrow(UnauthorizedException);
      expect(ipRestriction.isIpAllowed).not.toHaveBeenCalled();
    });

    it('proceeds to issue tokens when the IP is allowed', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'a@b.com', isActive: true, passwordHash: hash, lockedUntil: null, passwordChangedAt: null, mfaEnabled: false,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('a@b.com', 'correct', { ipAddress: '203.0.113.5' });

      expect(result.mfaRequired).toBe(false);
      if (!('accessToken' in result)) throw new Error('expected a token result, got an MFA challenge');
      expect(result.accessToken).toBe('signed-jwt');
    });
  });
});
