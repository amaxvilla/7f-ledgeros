import { HttpException } from '@nestjs/common';
import { LoginRateLimitGuard } from '../login-rate-limit.guard';

function buildContext(ip: string | undefined) {
  const request: any = { ip };
  const response: any = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    request,
    response,
  } as any;
}

describe('LoginRateLimitGuard', () => {
  let rateLimit: { checkAndIncrement: jest.Mock };
  let guard: LoginRateLimitGuard;
  const originalEnv = process.env.AUTH_RATE_LIMIT_PER_MINUTE;

  beforeEach(() => {
    rateLimit = { checkAndIncrement: jest.fn() };
    guard = new LoginRateLimitGuard(rateLimit as any);
    delete process.env.AUTH_RATE_LIMIT_PER_MINUTE;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AUTH_RATE_LIMIT_PER_MINUTE;
    else process.env.AUTH_RATE_LIMIT_PER_MINUTE = originalEnv;
  });

  it('keys the check by request.ip and defaults the limit to 20/minute', async () => {
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetInSeconds: 30 });
    const ctx = buildContext('9.9.9.9');

    await guard.canActivate(ctx);

    expect(rateLimit.checkAndIncrement).toHaveBeenCalledWith('9.9.9.9', 20);
  });

  it('reads AUTH_RATE_LIMIT_PER_MINUTE from the environment when set', async () => {
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = '5';
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 5, remaining: 4, resetInSeconds: 30 });
    const ctx = buildContext('9.9.9.9');

    await guard.canActivate(ctx);

    expect(rateLimit.checkAndIncrement).toHaveBeenCalledWith('9.9.9.9', 5);
  });

  it('falls back to \'unknown\' as the key when request.ip is missing, rather than throwing', async () => {
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetInSeconds: 30 });
    const ctx = buildContext(undefined);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(rateLimit.checkAndIncrement).toHaveBeenCalledWith('unknown', 20);
  });

  it('allows and sets rate-limit headers when within the limit', async () => {
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 20, remaining: 12, resetInSeconds: 17 });
    const ctx = buildContext('9.9.9.9');

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx.response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '20');
    expect(ctx.response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '12');
    expect(ctx.response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', '17');
  });

  it('throws 429 and sets Retry-After when over the limit', async () => {
    rateLimit.checkAndIncrement.mockResolvedValue({ allowed: false, limit: 20, remaining: 0, resetInSeconds: 5 });
    const ctx = buildContext('9.9.9.9');

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 429 });
    expect(ctx.response.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });
});
