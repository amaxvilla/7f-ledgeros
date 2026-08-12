import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createRedisConnection } from '@7f/queue';
import type IORedis from 'ioredis';

export interface LoginRateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets — for a Retry-After header. */
  resetInSeconds: number;
}

/**
 * PH-4 — Security & Performance verification. A genuine, concrete gap
 * found by direct inspection (not assumed from the checklist): the four
 * `@Public()` routes on `AuthController` (`login`, `mfa/verify`,
 * `refresh`, `logout`) had zero request-rate throttling of any kind.
 * `AccountLockoutService` (Release K) protects a single *account* after
 * repeated failures against *that* account, but does nothing against an
 * attacker spraying distinct/guessed emails from one source, hammering
 * `mfa/verify` to brute-force a 6-digit TOTP code, or hitting `refresh`
 * repeatedly to guess a token. `RateLimitService`/`RateLimitGuard`
 * already exist for exactly this kind of fixed-window counting, but are
 * scoped to `api-gateway` and keyed by an authenticated partner API key
 * (`request.apiKey`, set by `ApiKeyGuard`) — there is no equivalent for
 * a pre-authentication, IP-keyed request.
 *
 * Deliberately a NEW, small, self-contained service rather than
 * reusing `api-gateway`'s `RateLimitService` directly — importing
 * `ApiGatewayModule` (a partner-integration concern) into `AuthModule`
 * (the whole app's own login path) to borrow one class would be a
 * confusing module coupling for what is otherwise an unrelated
 * capability. The counting algorithm is identical on purpose (same
 * fixed-window INCR+EXPIRE approach, same documented ~2x-at-boundary
 * tradeoff, same "own Redis connection so unrelated traffic can never
 * contend" rationale as `RateLimitService`'s own doc comment) — only the
 * key shape and injection point differ.
 */
@Injectable()
export class LoginRateLimitService implements OnModuleDestroy {
  private readonly redis: IORedis;

  constructor() {
    this.redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  /**
   * Increments `identifier`'s (typically the caller's IP address)
   * counter for the CURRENT UTC minute and reports whether it's still
   * within `limitPerMinute`. See `RateLimitService.checkAndIncrement`'s
   * own doc comment for the identical atomicity/window-boundary
   * reasoning — unchanged here.
   */
  async checkAndIncrement(identifier: string, limitPerMinute: number): Promise<LoginRateLimitCheckResult> {
    const windowBucket = Math.floor(Date.now() / 60_000);
    const redisKey = `ratelimit:auth:${identifier}:${windowBucket}`;

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, 60);
    }

    const resetInSeconds = 60 - (Math.floor(Date.now() / 1000) % 60);

    return {
      allowed: count <= limitPerMinute,
      limit: limitPerMinute,
      remaining: Math.max(0, limitPerMinute - count),
      resetInSeconds,
    };
  }
}
