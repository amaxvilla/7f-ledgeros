import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IpRuleScope } from '@prisma/client';

// ---- Auth Security Policy ----

export class UpsertAuthSecurityPolicyDto {
  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsInt()
  @Min(6)
  minLength?: number;

  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireLowercase?: boolean;

  @IsOptional()
  @IsBoolean()
  requireNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  requireSymbol?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiryDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  historyCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxFailedLoginAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lockoutDurationMinutes?: number;
}

// ---- Password change ----

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

// ---- Account lockout (admin actions) ----

export class UnlockAccountDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

// ---- Release M — MFA (TOTP) ----

export class ConfirmMfaEnrollmentDto {
  @IsString()
  @MinLength(6)
  token!: string;
}

export class VerifyMfaDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @MinLength(6)
  token!: string;

  // Release N — Trusted Devices. If true, a TrustedDevice record is
  // created after this code verifies successfully, and its raw token
  // returned once so the client can store it and skip MFA on future
  // logins from this device.
  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class DisableMfaDto {
  @IsString()
  @MinLength(6)
  token!: string;
}

export class RegenerateRecoveryCodesDto {
  @IsString()
  @MinLength(6)
  token!: string;
}

// ---- Release N — Session Management & Session Revocation ----

export class RevokeOtherSessionsDto {
  // The caller's own current refresh token, so revoke-others can
  // identify (and deliberately skip) the session making the request —
  // same "client already holds it" convention as RefreshTokenDto on
  // /auth/refresh and /auth/logout.
  @IsString()
  currentRefreshToken!: string;
}

export class RevokeUserSessionsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

// ---- Frontend Completion — Device Naming ----
// The one gap my-security/page.tsx's own doc comment named as blocked
// on a backend endpoint that didn't exist yet — this DTO backs it.

export class RenameDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deviceName!: string;
}

// ---- Release P — IP Restrictions ----

export class CreateIpRuleDto {
  @IsEnum(IpRuleScope)
  scope!: IpRuleScope;

  // Required when scope = USER, must be omitted when scope = GLOBAL —
  // IpRestrictionService.createRule() enforces this pairing.
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  cidr!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
