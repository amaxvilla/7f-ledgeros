import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { VerifyMfaDto } from '../security-hardening/dto/security-hardening.dto';
import { LoginRateLimitGuard } from '../security-hardening/login-rate-limit.guard';

/**
 * PH-4 — Security & Performance verification. `LoginRateLimitGuard`
 * applied at the controller level (see its own doc comment) — every
 * route below is `@Public()` and pre-authentication, so this is the one
 * layer of throttling any of them get; `@Public()` bypasses
 * `JwtAuthGuard` but NOT this guard, since `LoginRateLimitGuard` is
 * applied here directly rather than through the `@Public()` metadata
 * path at all.
 */
@ApiTags('auth')
@Controller('auth')
@UseGuards(LoginRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Log in with email and password', description: 'Returns access/refresh tokens directly, or a short-lived MFA challengeToken if the account has MFA enabled (see POST /auth/mfa/verify).' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      dto.email,
      dto.password,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      dto.deviceToken,
    );
  }

  // Release M — second step of login when the account has MFA enabled.
  // Public because the caller doesn't have a full access token yet at
  // this point — only the short-lived challengeToken from login().
  // Release N — VerifyMfaDto.rememberDevice/deviceName let the client opt
  // in to a trusted-device MFA bypass for future logins.
  @Public()
  @ApiOperation({ summary: 'Complete login with an MFA code', description: 'Second step after POST /auth/login for an MFA-enabled account. Exchanges the login response\'s challengeToken plus a TOTP code for real access/refresh tokens; optionally marks this device as trusted for future logins.' })
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  verifyMfa(@Body() dto: VerifyMfaDto, @Req() req: Request) {
    return this.authService.verifyMfaAndLogin(
      dto.challengeToken,
      dto.token,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      dto.rememberDevice,
      dto.deviceName,
    );
  }

  @Public()
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @ApiOperation({ summary: 'Revoke a refresh token', description: 'Logs the current device out by invalidating the given refresh token. Does not affect the caller\'s other active sessions/devices.' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
