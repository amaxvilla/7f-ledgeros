import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createRedisConnection } from '@7f/queue';
import type IORedis from 'ioredis';

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets - for a Retry-After header. */
  resetInSeconds: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis: IORedis;

  constructor() {
    this.redis = createRedisConnection(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async checkAndIncrement(
    apiKeyId: string,
    limitPerMinute: number,
  ): Promise<RateLimitCheckResult> {
    const windowBucket = Math.floor(Date.now() / 60_000);
    const redisKey = `ratelimit:apikey:${apiKeyId}:${windowBucket}`;

    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.expire(redisKey, 60);
    }

    const resetInSeconds =
      60 - (Math.floor(Date.now() / 1000) % 60);

    return {
      allowed: count <= limitPerMinute,
      limit: limitPerMinute,
      remaining: Math.max(0, limitPerMinute - count),
      resetInSeconds,
    };
  }
}
