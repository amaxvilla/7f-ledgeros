jest.mock('@7f/queue', () => ({
  createRedisConnection: jest.fn(() => ({
    incr: jest.fn(),
    expire: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  })),
}));

import { RateLimitService } from '../rate-limit.service';

/**
 * RateLimitService constructs its Redis connection internally.
 *
 * The queue package is mocked above so constructing the service never
 * opens a real Redis/TCP connection during this unit test.
 */
function buildFakeRedis(initialCounts: Record<string, number> = {}) {
  const counts = { ...initialCounts };
  const expiries: Record<string, number> = {};

  return {
    incr: jest.fn(async (key: string) => {
      counts[key] = (counts[key] ?? 0) + 1;
      return counts[key];
    }),

    expire: jest.fn(async (key: string, seconds: number) => {
      expiries[key] = seconds;
      return 1;
    }),

    quit: jest.fn().mockResolvedValue('OK'),

    __counts: counts,
    __expiries: expiries,
  };
}

describe('RateLimitService', () => {
  let service: RateLimitService;
  let fakeRedis: ReturnType<typeof buildFakeRedis>;

  beforeEach(async () => {
    fakeRedis = buildFakeRedis();
    service = new RateLimitService();
    await (service as any).redis.quit();
    (service as any).redis = fakeRedis;
  });

  it('allows a request when the count is within the limit', async () => {
    const result = await service.checkAndIncrement('ak-1', 10);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
  });

  it('denies a request once the count exceeds the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await service.checkAndIncrement('ak-1', 5);
    }

    const result = await service.checkAndIncrement('ak-1', 5);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('sets a 60-second expiry only on the first increment of a window', async () => {
    await service.checkAndIncrement('ak-1', 10);
    await service.checkAndIncrement('ak-1', 10);
    await service.checkAndIncrement('ak-1', 10);

    expect(fakeRedis.expire).toHaveBeenCalledTimes(1);
    expect(fakeRedis.expire).toHaveBeenCalledWith(
      expect.stringContaining('ratelimit:apikey:ak-1:'),
      60,
    );
  });

  it('tracks separate windows independently per apiKeyId', async () => {
    await service.checkAndIncrement('ak-1', 5);
    await service.checkAndIncrement('ak-1', 5);

    const result = await service.checkAndIncrement('ak-2', 5);

    expect(result.remaining).toBe(4);
  });

  it('never reports negative remaining even once well past the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await service.checkAndIncrement('ak-1', 3);
    }

    const result = await service.checkAndIncrement('ak-1', 3);

    expect(result.remaining).toBe(0);
  });

  it('reports a resetInSeconds between 1 and 60', async () => {
    const result = await service.checkAndIncrement('ak-1', 10);

    expect(result.resetInSeconds).toBeGreaterThanOrEqual(1);
    expect(result.resetInSeconds).toBeLessThanOrEqual(60);
  });

  it('onModuleDestroy quits the redis connection', async () => {
    await service.onModuleDestroy();

    expect(fakeRedis.quit).toHaveBeenCalled();
  });

  it('onModuleDestroy does not throw even if quit() rejects', async () => {
    fakeRedis.quit.mockRejectedValue(new Error('connection already closed'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
