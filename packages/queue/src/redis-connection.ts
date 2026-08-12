import IORedis, { type RedisOptions } from 'ioredis';

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the ioredis connection it
 * is given (its own internal retry/backoff otherwise fights with ioredis's).
 * This factory is the one place that rule is encoded, so every queue and
 * every worker connects the same way.
 */
export function createRedisConnection(redisUrl: string, options: RedisOptions = {}): IORedis {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    ...options,
  });
}

/** Lightweight liveness check used by /health and /ready endpoints. */
export async function pingRedis(connection: IORedis, timeoutMs = 2000): Promise<boolean> {
  try {
    const result = await Promise.race([
      connection.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs)),
    ]);
    return result === 'PONG';
  } catch {
    return false;
  }
}
