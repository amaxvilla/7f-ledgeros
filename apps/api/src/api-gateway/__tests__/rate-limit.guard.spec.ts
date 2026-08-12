import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from '../rate-limit.guard';

function buildContext(apiKey: any) {
  const request: any = { apiKey };
  const response: any = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    request,
    response,
  } as any;
}

describe('RateLimitGuard', () => {
  let rateLimit: { checkAndIncrement: jest.Mock };
  let guard: RateLimitGuard;

  beforeEach(() => {
    rateLimit = { checkAndIncrement: jest.fn() };
    guard = new RateLimitGuard(rateLimit as any);
  });

  it('throws (fails closed) when request.apiKey is missing — RateLimitGuard applied without ApiKeyGuard first', async () => {
    const ctx = buildContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    expect(rateLimit.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('allows unconditionally when the key has no rate limit configured (null)', async () => {
    const ctx = buildContext({ id: 'ak-1', rateLimitPerMinute: null });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(rateLimit.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('allows and sets rate-limit headers when within the limit', async () => {
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 100, remaining: 42, resetInSeconds: 17 });
    const ctx = buildContext({ id: 'ak-1', rateLimitPerMinute: 100 });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(rateLimit.checkAndIncrement).toHaveBeenCalledWith('ak-1', 100);
    expect(ctx.response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(ctx.response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '42');
    expect(ctx.response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', '17');
  });

  it('throws 429 and sets Retry-After when over the limit', async () => {
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: false, limit: 100, remaining: 0, resetInSeconds: 5 });
    const ctx = buildContext({ id: 'ak-1', rateLimitPerMinute: 100 });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 429 });
    expect(ctx.response.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });
});
