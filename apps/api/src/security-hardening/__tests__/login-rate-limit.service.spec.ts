import { LoginRateLimitService } from '../login-rate-limit.service';

/**
 * Same private-field substitution approach as
 * `api-gateway/__tests__/rate-limit.service.spec.ts` — `LoginRateLimitService`
 * constructs its own ioredis connection in its constructor with no DI
 * seam, so tests replace `redis` directly after construction rather than
 * injecting a mock.
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

describe('LoginRateLimitService', () => {
  let service: LoginRateLimitService;
  let fakeRedis: ReturnType<typeof buildFakeRedis>;

  beforeEach(() => {
    service = new LoginRateLimitService();
    fakeRedis = buildFakeRedis();
    (service as any).redis = fakeRedis;
  });

  it('allows a request when the count is within the limit', async () => {
    const result = await service.checkAndIncrement('1.2.3.4', 20);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(19);
    expect(result.limit).toBe(20);
  });

  it('denies a request once the count exceeds the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await service.checkAndIncrement('1.2.3.4', 5);
    }
    const result = await service.checkAndIncrement('1.2.3.4', 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks separate windows independently per identifier (IP)', async () => {
    await service.checkAndIncrement('1.2.3.4', 5);
    await service.checkAndIncrement('1.2.3.4', 5);
    const result = await service.checkAndIncrement('5.6.7.8', 5);

    expect(result.remaining).toBe(4); // a different IP's own first request, unaffected by the first IP's count
  });

  it('sets a 60-second expiry only on the first increment of a window, keyed under ratelimit:auth', async () => {
    await service.checkAndIncrement('1.2.3.4', 10);
    await service.checkAndIncrement('1.2.3.4', 10);

    expect(fakeRedis.expire).toHaveBeenCalledTimes(1);
    expect(fakeRedis.expire).toHaveBeenCalledWith(expect.stringContaining('ratelimit:auth:1.2.3.4:'), 60);
  });

  it('onModuleDestroy quits the redis connection without throwing even if quit() rejects', async () => {
    fakeRedis.quit.mockRejectedValue(new Error('connection already closed'));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
