import { RateLimitService } from '../rate-limit.service';

/**
 * RateLimitService constructs its own ioredis connection in its
 * constructor (same self-contained pattern this codebase's own
 * health.controller.ts already uses for the identical reason) rather
 * than accepting one via constructor injection, so there is no DI seam
 * to substitute a fake client through. Tests instead replace the
 * private `redis` field directly after construction.
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

  beforeEach(() => {
    service = new RateLimitService();
    fakeRedis = buildFakeRedis();
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
    expect(fakeRedis.expire).toHaveBeenCalledWith(expect.stringContaining('ratelimit:apikey:ak-1:'), 60);
  });

  it('tracks separate windows independently per apiKeyId', async () => {
    await service.checkAndIncrement('ak-1', 5);
    await service.checkAndIncrement('ak-1', 5);
    const result = await service.checkAndIncrement('ak-2', 5);

    expect(result.remaining).toBe(4); // ak-2's own first request, unaffected by ak-1's count
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
