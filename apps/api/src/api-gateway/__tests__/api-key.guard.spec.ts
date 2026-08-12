import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../api-key.guard';

function buildContext(headers: Record<string, string>) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as any;
}

describe('ApiKeyGuard', () => {
  let apiKeys: { validateKey: jest.Mock };
  let guard: ApiKeyGuard;

  beforeEach(() => {
    apiKeys = { validateKey: jest.fn() };
    guard = new ApiKeyGuard(apiKeys as any);
  });

  it('rejects a request with no X-API-Key header', async () => {
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(apiKeys.validateKey).not.toHaveBeenCalled();
  });

  it('delegates to ApiKeyService.validateKey with the header value', async () => {
    apiKeys.validateKey.mockResolvedValue({ id: 'ak-1' });
    const ctx = buildContext({ 'x-api-key': '7f_live_abc123' });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(apiKeys.validateKey).toHaveBeenCalledWith('7f_live_abc123');
  });

  it('attaches the resolved ApiKey record onto the request as req.apiKey', async () => {
    const resolvedKey = { id: 'ak-1', scopes: ['reports:read'] };
    apiKeys.validateKey.mockResolvedValue(resolvedKey);
    const ctx = buildContext({ 'x-api-key': '7f_live_abc123' });

    await guard.canActivate(ctx);

    expect(ctx.request.apiKey).toBe(resolvedKey);
  });

  it('propagates ApiKeyService rejection (e.g. revoked/expired key)', async () => {
    apiKeys.validateKey.mockRejectedValue(new UnauthorizedException('Invalid or revoked API key'));
    const ctx = buildContext({ 'x-api-key': 'bad-key' });

    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid or revoked API key');
  });
});
