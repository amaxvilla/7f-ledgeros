import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_SCOPE_KEY } from './require-api-scope.decorator';

/**
 * API Gateway, Checkpoint C. Mirrors PermissionsGuard's own shape
 * exactly (Reflector-read metadata, "must hold ALL declared codes"
 * semantics) but reads `request.apiKey.scopes` instead of
 * `request.user.permissions` — see RequireApiScope's own doc comment
 * for why these stay two separate decorator/guard pairs rather than one
 * shared pair.
 *
 * MUST run after ApiKeyGuard in a route's guard array (reads
 * `request.apiKey`, does not authenticate anything itself) — same
 * ordering requirement RateLimitGuard's own doc comment already
 * documents for this controller's guard chain.
 *
 * A route with no @RequireApiScope at all is allowed through
 * unconditionally (same "no declaration = no gate" default
 * PermissionsGuard uses) — e.g. PartnerApiController's own ping route,
 * which exists specifically so a partner can verify their key works
 * without needing any scope granted to it yet.
 */
@Injectable()
export class ApiScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(API_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.apiKey;

    if (!apiKey) {
      throw new UnauthorizedException('ApiScopeGuard requires ApiKeyGuard to run first (request.apiKey is not set)');
    }

    const scopes: string[] = apiKey.scopes ?? [];
    const missing = required.filter((scope) => !scopes.includes(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`API key is missing required scope(s): ${missing.join(', ')}`);
    }

    return true;
  }
}
