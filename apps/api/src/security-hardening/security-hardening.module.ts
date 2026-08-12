import { Module } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';
import { LoginHistoryService } from './login-history.service';
import { AccountLockoutService } from './account-lockout.service';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { TrustedDeviceService } from './trusted-device.service';
import { IpRestrictionService } from './ip-restriction.service';
import { IpRestrictionGuard } from './ip-restriction.guard';
import { LoginRateLimitService } from './login-rate-limit.service';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { SecurityHardeningController } from './security-hardening.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SecurityHardeningController],
  providers: [
    PasswordPolicyService,
    LoginHistoryService,
    AccountLockoutService,
    MfaService,
    SessionService,
    TrustedDeviceService,
    IpRestrictionService,
    IpRestrictionGuard,
    LoginRateLimitService,
    LoginRateLimitGuard,
  ],
  exports: [
    PasswordPolicyService,
    LoginHistoryService,
    AccountLockoutService,
    MfaService,
    SessionService,
    TrustedDeviceService,
    IpRestrictionService,
    IpRestrictionGuard,
    LoginRateLimitService,
    LoginRateLimitGuard,
  ],
})
export class SecurityHardeningModule {}
