import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

/**
 * API Gateway, Checkpoint A.
 *
 * Written and exported, but deliberately NOT wired as a global guard in
 * app.module.ts, and not yet applied to any route — matching this
 * codebase's established "framework first, real usage wired in a later
 * checkpoint" pattern (the same relationship TransferProviderRegistry's
 * Checkpoint A had to an actual concrete provider, or
 * WorkspaceAdminProviderRegistry's Checkpoint E had to
 * GoogleWorkspaceAdminProvider). Deciding which routes should accept an
 * API key instead of/alongside a JWT — and how scopes gate which of
 * those routes — is a decision for whichever later checkpoint adds the
 * first real partner-facing endpoint, not this one.
 *
 * Reads the `X-API-Key` header, delegates to ApiKeyService.validateKey()
 * (which owns the actual hash/status/expiry check — this guard is a
 * thin HTTP-layer adapter, not a second place that logic lives), and
 * attaches the resolved ApiKey record onto the request as `req.apiKey`
 * for downstream handlers/decorators to read (e.g. a future
 * @RequireApiScope decorator).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    request.apiKey = await this.apiKeys.validateKey(rawKey);
    return true;
  }
}
