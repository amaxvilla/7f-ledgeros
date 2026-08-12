import { JwtAuthGuard } from '../jwt-auth.guard';

/**
 * PH-3.2 — End-to-End & Regression Testing (continuing PH-3.1's own
 * `apps/api/src/common/` coverage gap). `JwtAuthGuard` is the global
 * authentication gate for the whole API (registered as `APP_GUARD` in
 * `app.module.ts` — confirmed directly before writing this) but had zero
 * test coverage. It's a thin subclass of Passport's own `AuthGuard('jwt')`
 * that adds one thing: an `@Public()` short-circuit read via `Reflector`.
 * Rather than exercise the real Passport `jwt` strategy (which needs a
 * configured `JwtStrategy`/secret and is integration-test territory, not
 * this guard's own unit), this spec verifies the one piece of logic that
 * actually belongs to `JwtAuthGuard` itself: whether it defers to its own
 * base class's `canActivate` or short-circuits around it.
 *
 * Important: `AuthGuard('jwt')` (from `@nestjs/passport`) is a mixin
 * *factory* — every call returns a distinct class, not a cached singleton.
 * Calling `AuthGuard('jwt')` again from this test file would spy on a
 * *different* class than the one `JwtAuthGuard` actually extends, so the
 * spy below is taken via `Object.getPrototypeOf(JwtAuthGuard.prototype)` —
 * `JwtAuthGuard`'s own real, actual parent prototype — rather than by
 * re-invoking `AuthGuard('jwt')` a second time.
 */
function buildReflector(publicValue: unknown) {
  return { getAllAndOverride: jest.fn().mockReturnValue(publicValue) } as any;
}

function buildContext() {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('JwtAuthGuard', () => {
  const basePrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);
  let baseCanActivate: jest.SpyInstance;

  beforeEach(() => {
    baseCanActivate = jest.spyOn(basePrototype, 'canActivate').mockReturnValue(true);
  });

  afterEach(() => {
    baseCanActivate.mockRestore();
  });

  it('short-circuits to true on a @Public route without invoking Passport at all', () => {
    const guard = new JwtAuthGuard(buildReflector(true));
    const context = buildContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(baseCanActivate).not.toHaveBeenCalled();
  });

  it('delegates to AuthGuard("jwt")\'s own canActivate on a non-public route', () => {
    const guard = new JwtAuthGuard(buildReflector(false));
    const context = buildContext();

    const result = guard.canActivate(context);

    expect(baseCanActivate).toHaveBeenCalledTimes(1);
    expect(baseCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
  });

  it('delegates to AuthGuard("jwt") when no @Public/@RequirePermissions-style metadata is present at all', () => {
    const guard = new JwtAuthGuard(buildReflector(undefined));
    const context = buildContext();

    guard.canActivate(context);

    expect(baseCanActivate).toHaveBeenCalledTimes(1);
  });

  it('propagates whatever AuthGuard("jwt") itself returns on a non-public route (e.g. rejection)', () => {
    baseCanActivate.mockReturnValue(false);
    const guard = new JwtAuthGuard(buildReflector(false));
    const context = buildContext();

    expect(guard.canActivate(context)).toBe(false);
  });
});
