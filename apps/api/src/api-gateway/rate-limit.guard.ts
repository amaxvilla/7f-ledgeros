import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

/**
 * API Gateway, Checkpoint B — Rate Limiting.
 *
 * Deliberately a SEPARATE guard from ApiKeyGuard, not folded into it —
 * same single-responsibility split ApiKeyGuard's own doc comment
 * implies (authentication vs. a distinct authorization/policy concern).
 * MUST run AFTER ApiKeyGuard in a route's guard array (e.g.
 * `@UseGuards(ApiKeyGuard, RateLimitGuard)`) — this guard reads
 * `request.apiKey`, which only ApiKeyGuard attaches; it does not
 * authenticate anything itself; if `request.apiKey` is missing (this
 * guard applied without ApiKeyGuard first) it throws rather than
 * silently allowing the request through, since that misconfiguration
 * would otherwise fail open.
 *
 * A key with `rateLimitPerMinute: null` (Checkpoint A's default, and
 * every key created before this checkpoint) is unconditionally allowed
 * — see ApiKey.rateLimitPerMinute's own schema comment for why null
 * means unlimited rather than zero.
 *
 * NOT yet wired to any route or globally — same "framework first, real
 * usage wired in a later checkpoint" deferral ApiKeyGuard's own
 * Checkpoint A already established; deciding which partner-facing
 * routes should carry both guards is that later checkpoint's call, not
 * this one's.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.apiKey;

    if (!apiKey) {
      throw new HttpException(
        'RateLimitGuard requires ApiKeyGuard to run first (request.apiKey is not set)',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (apiKey.rateLimitPerMinute == null) {
      return true;
    }

    const result = await this.rateLimit.checkAndIncrement(apiKey.id, apiKey.rateLimitPerMinute);

    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-RateLimit-Reset', String(result.resetInSeconds));

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.resetInSeconds));
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
