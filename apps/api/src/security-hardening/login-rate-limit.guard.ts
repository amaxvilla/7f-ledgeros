import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';

/**
 * PH-4 — Security & Performance verification. See
 * `LoginRateLimitService`'s own doc comment for why this exists and why
 * it's a separate, IP-keyed sibling of `api-gateway`'s
 * `RateLimitGuard` rather than a reuse of it.
 *
 * Keyed by `request.ip` (Express's own, already trusting whatever
 * proxy/trust-proxy configuration the app is deployed behind — the same
 * source `AuthController` already passes into `LoginHistoryService` for
 * every login attempt, so this guard introduces no new trust
 * assumption). Unlike `RateLimitGuard`, there is no upstream guard this
 * one depends on — `request.ip` is always present — so there is no
 * fail-closed "missing precondition" branch to write; every request
 * either has a real IP or Express's own `req.ip` fallback handles it.
 *
 * Limit is a single, env-configurable value
 * (`AUTH_RATE_LIMIT_PER_MINUTE`, default 20) applied uniformly across
 * whichever routes this guard is attached to — `AuthController` applies
 * it at the controller level so all four public routes share one
 * per-IP budget, rather than four independently-tracked ones. A
 * per-route budget (e.g. a tighter limit specifically on `mfa/verify`
 * to slow TOTP brute-forcing) is a reasonable future refinement, not
 * done here to keep this checkpoint to its own smallest useful unit.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: LoginRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const limit = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 20);
    const identifier: string = request.ip ?? 'unknown';

    const result = await this.rateLimit.checkAndIncrement(identifier, limit);

    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-RateLimit-Reset', String(result.resetInSeconds));

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.resetInSeconds));
      throw new HttpException('Too many requests — please try again shortly', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
