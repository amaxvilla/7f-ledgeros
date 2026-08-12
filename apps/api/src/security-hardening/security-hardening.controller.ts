import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginEventType, IpRuleScope } from '@prisma/client';
import { PasswordPolicyService } from './password-policy.service';
import { LoginHistoryService } from './login-history.service';
import { AccountLockoutService } from './account-lockout.service';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { TrustedDeviceService } from './trusted-device.service';
import { IpRestrictionService } from './ip-restriction.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  UpsertAuthSecurityPolicyDto,
  ChangePasswordDto,
  UnlockAccountDto,
  ConfirmMfaEnrollmentDto,
  DisableMfaDto,
  RegenerateRecoveryCodesDto,
  RevokeOtherSessionsDto,
  RevokeUserSessionsDto,
  RenameDeviceDto,
  CreateIpRuleDto,
} from './dto/security-hardening.dto';

/**
 * Seven distinct security sub-domains sharing one route prefix, each
 * backed by its own service (Password Policy, Login History, Account
 * Lockout, MFA/TOTP, Session Management, Trusted Devices, IP
 * Restrictions). Most sub-domains follow the same self-service/admin
 * split — a `/me`- or `/mfa`-style route the calling user acts on for
 * themselves with no permission guard beyond being authenticated, and a
 * parallel `/user/:userId`- or `/accounts/:userId`-style route requiring
 * `security.access.view`/`security.access.manage` for an administrator
 * to act on someone else's behalf. Session and Trusted Device revocation
 * both cascade into RefreshToken — revoking a device also revokes any
 * still-active session issued through it, so removing trust can't leave
 * a live session standing on it.
 */
@ApiTags('security-hardening')
@ApiBearerAuth()
@Controller('security')
export class SecurityHardeningController {
  constructor(
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly loginHistory: LoginHistoryService,
    private readonly accountLockout: AccountLockoutService,
    private readonly mfa: MfaService,
    private readonly sessions: SessionService,
    private readonly trustedDevices: TrustedDeviceService,
    private readonly ipRestriction: IpRestrictionService,
  ) {}

  // ---- Password Policy ----

  @Post('password-policy')
  @RequirePermissions('security.access.manage')
  @ApiOperation({
    summary: 'Create or update the password policy for an entity, or the global default',
    description: 'entityId is optional — omitted, this upserts the GLOBAL policy (entityId=null). Only the global policy is actually resolved at login/change-password time in this release; a per-entity policy can be created here but AuthService has no entity context at authentication time to apply it yet.',
  })
  upsertPolicy(@Body() dto: UpsertAuthSecurityPolicyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.passwordPolicy.upsertPolicy(dto, user.id);
  }

  @Get('password-policy')
  @RequirePermissions('security.access.view')
  @ApiOperation({ summary: 'List every password policy, global and per-entity' })
  findPolicies() {
    return this.passwordPolicy.findPolicies();
  }

  // ---- Password change (self-service — any authenticated user) ----

  @Post('change-password')
  @ApiOperation({
    summary: 'Change your own password',
    description: 'Requires the current password. The new one is checked against the effective (global) policy\'s own complexity rules and against your last historyCount password hashes for reuse, both enforced server-side, not just advisory.',
  })
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.passwordPolicy.changePassword(user.id, dto);
  }

  // ---- Login History ----

  @Get('login-history/me')
  @ApiOperation({ summary: 'Get your own login history', description: 'The 50 most recent events, newest first.' })
  myLoginHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.loginHistory.findForUser(user.id);
  }

  @Get('login-history/user/:userId')
  @RequirePermissions('security.access.view')
  @ApiOperation({ summary: 'Get any user\'s login history', description: 'The 50 most recent events, newest first.' })
  userLoginHistory(@Param('userId') userId: string) {
    return this.loginHistory.findForUser(userId);
  }

  @Get('login-history')
  @RequirePermissions('security.access.view')
  @ApiOperation({
    summary: 'Get recent login history platform-wide',
    description: 'emailAttempted and eventType are both optional filters. The 100 most recent matching events, newest first. Unlike the two routes above, this also surfaces failed attempts against emails matching no user at all.',
  })
  recentLoginHistory(@Query('emailAttempted') emailAttempted?: string, @Query('eventType') eventType?: LoginEventType) {
    return this.loginHistory.findRecent({ emailAttempted, eventType });
  }

  // ---- Account Lockout (admin) ----

  @Post('accounts/:userId/unlock')
  @RequirePermissions('security.access.manage')
  @ApiOperation({ summary: 'Manually unlock a locked account', description: 'Ahead of the lock\'s own automatic expiry. Clears failedLoginAttempts to 0 and notifies the affected user.' })
  unlockAccount(@Param('userId') userId: string, @Body() dto: UnlockAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.accountLockout.manualUnlock(userId, user.id, dto.reason);
  }

  // ---- Release M — MFA (TOTP) enrollment & management (self-service) ----

  @Post('mfa/enroll')
  @ApiOperation({
    summary: 'Begin MFA (TOTP) enrollment',
    description: 'Generates a secret and a QR code but does NOT enable MFA yet — mfaEnabled only flips on once POST mfa/enroll/confirm proves you can generate a valid code from it, so scanning the QR into the wrong app can\'t lock you out. Rejected with a 409 if MFA is already enabled.',
  })
  beginMfaEnrollment(@CurrentUser() user: AuthenticatedUser) {
    return this.mfa.beginEnrollment(user.id);
  }

  @Post('mfa/enroll/confirm')
  @ApiOperation({
    summary: 'Confirm MFA enrollment with a live authenticator code',
    description: 'Flips mfaEnabled on and returns ten recovery codes in plaintext — the only time they are ever visible; only their hashes are stored. Rejected with a 401 on an invalid code, a 400 if no enrollment is in progress, a 409 if MFA is already enabled.',
  })
  confirmMfaEnrollment(@Body() dto: ConfirmMfaEnrollmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mfa.confirmEnrollment(user.id, dto.token);
  }

  @Post('mfa/disable')
  @ApiOperation({
    summary: 'Disable MFA on your own account',
    description: 'Requires a valid live TOTP or unused recovery code, not just your bearer token — the same "re-prove factor" principle changePassword uses currentPassword for, so a stolen access token alone can\'t turn MFA off. Deletes every recovery code as a side effect.',
  })
  disableMfa(@Body() dto: DisableMfaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mfa.disableMfa(user.id, dto.token);
  }

  @Post('mfa/recovery-codes/regenerate')
  @ApiOperation({
    summary: 'Regenerate your recovery codes',
    description: 'Requires a valid live TOTP or unused recovery code, same re-authentication requirement as MFA disable. Every unused existing code is invalidated; ten new ones are returned in plaintext, the only time they are visible.',
  })
  regenerateRecoveryCodes(@Body() dto: RegenerateRecoveryCodesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mfa.regenerateRecoveryCodesWithAuth(user.id, dto.token);
  }

  // ---- Release N — Session Management & Revocation (self-service) ----

  @Get('sessions/me')
  @ApiOperation({ summary: 'List your own active sessions', description: 'There is no separate Session model — this lists your own non-revoked, non-expired RefreshToken rows, newest-used first.' })
  myActiveSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.listMySessions(user.id);
  }

  @Delete('sessions/me/:sessionId')
  @ApiOperation({ summary: 'Revoke one of your own sessions', description: 'Rejected with a 403 if the session id belongs to someone else — cannot be used to probe or revoke another user\'s session.' })
  revokeMySession(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.revokeMySession(user.id, sessionId);
  }

  @Post('sessions/me/revoke-others')
  @ApiOperation({
    summary: 'Log out every other active session — "log out everywhere else"',
    description: 'currentRefreshToken identifies your own in-flight session so it survives this call; every other active session is revoked.',
  })
  revokeMyOtherSessions(@Body() dto: RevokeOtherSessionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sessions.revokeOtherSessions(user.id, dto.currentRefreshToken);
  }

  // ---- Release N — Session Management (admin) ----

  @Get('sessions/user/:userId')
  @RequirePermissions('security.access.view')
  @ApiOperation({ summary: 'List any user\'s active sessions' })
  userActiveSessions(@Param('userId') userId: string) {
    return this.sessions.listSessionsForUser(userId);
  }

  @Post('sessions/user/:userId/revoke-all')
  @RequirePermissions('security.access.manage')
  @ApiOperation({ summary: 'Force-logout every active session for a user', description: 'E.g. a compromised account. Unlike the self-service "revoke others" route, there is no session preserved — every one is revoked.' })
  revokeAllSessionsForUser(@Param('userId') userId: string, @Body() _dto: RevokeUserSessionsDto) {
    return this.sessions.revokeAllSessionsForUser(userId);
  }

  // ---- Release N — Trusted Devices (self-service) ----

  @Get('devices/me')
  @ApiOperation({ summary: 'List your own trusted devices' })
  myTrustedDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.trustedDevices.listMyDevices(user.id);
  }

  @Delete('devices/me/:deviceId')
  @ApiOperation({
    summary: 'Revoke one of your own trusted devices',
    description: 'Also revokes any still-active session that was issued via this device, so removing trust can\'t leave a live session standing on it. Rejected with a 403 if the device belongs to someone else.',
  })
  revokeMyTrustedDevice(@Param('deviceId') deviceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.trustedDevices.revokeDevice(user.id, deviceId);
  }

  @Patch('devices/me/:deviceId')
  @ApiOperation({ summary: 'Rename one of your own trusted devices', description: 'Cosmetic only — does not affect the device\'s own trust or any live session.' })
  renameMyTrustedDevice(@Param('deviceId') deviceId: string, @Body() body: RenameDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.trustedDevices.renameDevice(user.id, deviceId, body.deviceName);
  }

  // ---- Release P — Device Management (admin) ----
  // Filled in a gap left open at the end of Release N: only self-service
  // device endpoints existed. Same admin pattern as sessions/user/:userId
  // above.

  @Get('devices/user/:userId')
  @RequirePermissions('security.access.view')
  @ApiOperation({ summary: 'List any user\'s trusted devices' })
  userTrustedDevices(@Param('userId') userId: string) {
    return this.trustedDevices.listDevicesForUser(userId);
  }

  @Delete('devices/user/:userId/:deviceId')
  @RequirePermissions('security.access.manage')
  @ApiOperation({
    summary: 'Force-revoke a device on a user\'s behalf',
    description: 'E.g. reported lost or compromised. No ownership check needed (that\'s the self-service route\'s job) — still revokes any live session issued through the device.',
  })
  revokeUserTrustedDevice(@Param('userId') userId: string, @Param('deviceId') deviceId: string) {
    return this.trustedDevices.revokeDeviceForUser(userId, deviceId);
  }

  // ---- Release P — IP Restrictions (admin) ----

  @Post('ip-rules')
  @RequirePermissions('security.access.manage')
  @ApiOperation({
    summary: 'Create an IP allowlist rule',
    description: 'scope=GLOBAL applies to every user; scope=USER requires userId and applies to that user only. cidr must be a valid IPv4 CIDR — IPv6 is not supported yet. Fail-open-until-configured: a user with zero applicable active rules is unrestricted; once at least one GLOBAL or matching USER rule exists, their request IP must match one of them.',
  })
  createIpRule(@Body() dto: CreateIpRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ipRestriction.createRule(dto, user.id);
  }

  @Get('ip-rules')
  @RequirePermissions('security.access.view')
  @ApiOperation({ summary: 'List IP allowlist rules', description: 'scope and userId are both optional filters.' })
  listIpRules(@Query('scope') scope?: IpRuleScope, @Query('userId') userId?: string) {
    return this.ipRestriction.listRules({ scope, userId });
  }

  @Delete('ip-rules/:id')
  @RequirePermissions('security.access.manage')
  @ApiOperation({ summary: 'Deactivate an IP allowlist rule', description: 'A soft delete (isActive=false) — the row itself is kept, not removed.' })
  deactivateIpRule(@Param('id') id: string) {
    return this.ipRestriction.deactivateRule(id);
  }

  // ---- Dashboard/reporting helper ----

  @Get('overview')
  @RequirePermissions('security.access.view')
  @ApiOperation({
    summary: 'Get the account-lockout security overview widget',
    description: 'sinceHours (default 24) sets the trailing window for the failedLogins/lockoutEvents counts; currentlyLocked is always a live, right-now count regardless of the window.',
  })
  getSecurityOverview(@Query('sinceHours') sinceHours?: string) {
    return this.accountLockout.getOverview(sinceHours ? Number(sinceHours) : 24);
  }
}
