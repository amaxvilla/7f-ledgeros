import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiScopeGuard } from '../api-scope.guard';

function buildContext(apiKey: any) {
  const request: any = { apiKey };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('ApiScopeGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: ApiScopeGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new ApiScopeGuard(reflector as any);
  });

  it('allows a route with no @RequireApiScope declared at all', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a route with an empty scope requirement', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const ctx = buildContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException when scopes are required but request.apiKey is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(['transfers:read']);
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('allows when the key holds every required scope', () => {
    reflector.getAllAndOverride.mockReturnValue(['transfers:read']);
    const ctx = buildContext({ scopes: ['transfers:read', 'invoices:read'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException listing exactly the missing scopes when the key holds only some', () => {
    reflector.getAllAndOverride.mockReturnValue(['transfers:read', 'transfers:write']);
    const ctx = buildContext({ scopes: ['transfers:read'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect((err as Error).message).toContain('transfers:write');
      expect((err as Error).message).not.toContain('transfers:read,');
    }
  });

  it('treats a key with no scopes array at all as holding zero scopes', () => {
    reflector.getAllAndOverride.mockReturnValue(['transfers:read']);
    const ctx = buildContext({});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
