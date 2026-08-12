import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createRedisConnection } from '@7f/queue';
import type IORedis from 'ioredis';

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets — for a Retry-After header. */
  resetInSeconds: number;
}

/**
 * API Gateway, Checkpoint B — Rate Limiting.
 *
 * REUSES @7f/queue's createRedisConnection — the same factory
 * QueueProducerService and /health's Redis liveness check both already
 * use — rather than a new ad-hoc `new IORedis(...)` call or a new
 * package dependency. This is a plain fixed-window counter (INCR + EXPIRE
 * on first hit of each window), not a sliding-window or token-bucket
 * algorithm — the well-known tradeoff being a caller sitting exactly on
 * a minute boundary could send up to ~2x their configured limit across
 * the two adjacent windows. Documented rather than solved here,
 * consistent with this codebase's "correct but intentionally the
 * simplest version first" precedent (e.g. MonoProvider's own
 * no-recipient-caching note, or fetchStatement's no-pagination note) —
 * a sliding-window upgrade can replace checkAndIncrement's internals
 * later without changing RateLimitGuard's contract at all.
 *
 * Own Redis connection (not shared with BullMQ's) — deliberately, so a
 * queue outage/backpressure event can never be confused with or
 * contend against rate-limit counter traffic, and vice versa; the two
 * are logically unrelated even though they point at the same Redis
 * instance by default.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis: IORedis;

  constructor() {
    this.redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  /**
   * Increments this API key's counter for the CURRENT UTC minute and
   * reports whether it's still within `limitPerMinute`. The key already
   * having been incremented past the limit by a concurrent request in
   * the same window is fine — INCR is atomic, so no two callers ever
   * see the same post-increment count, and the (limit+1)-th caller
   * onward is correctly told `allowed: false`.
   */
  async checkAndIncrement(apiKeyId: string, limitPerMinute: number): Promise<RateLimitCheckResult> {
    const windowBucket = Math.floor(Date.now() / 60_000); // changes exactly once per UTC minute
    const redisKey = `ratelimit:apikey:${apiKeyId}:${windowBucket}`;

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      // Only the request that just created this window's key sets its
      // expiry — every subsequent INCR in the same window is a no-op on
      // TTL, avoiding a TTL-refresh race that could otherwise let a
      // window live longer than 60s under sustained traffic.
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
