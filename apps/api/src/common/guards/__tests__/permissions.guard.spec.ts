import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from '../permissions.guard';

/**
 * PH-3 — End-to-End & Regression Testing. `PermissionsGuard` is the core
 * RBAC enforcement mechanism gating almost every non-public route in this
 * app (via `@RequirePermissions`), but had zero direct test coverage —
 * confirmed by checking the whole `apps/api/src/common` tree before writing
 * this file: no `__tests__` directory existed anywhere under it. Every
 * other module's own service-level spec mocks `PrismaService` but never
 * exercises this guard's own decision logic, since Nest guards run in the
 * HTTP pipeline, not inside a service unit test. This file closes that gap
 * directly, following the same `buildContext`/`buildReflector` convention
 * already established by `EntityAccessGuard`'s own spec
 * (`apps/api/src/security/__tests__/entity-access.guard.spec.ts`).
 */
function buildContext(user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function buildReflector(publicValue: unknown, permissionsValue: unknown) {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      if (key === 'isPublic') return publicValue;
      if (key === 'permissions') return permissionsValue;
      return undefined;
    }),
  } as any;
}

describe('PermissionsGuard', () => {
  it('allows the request through when the route is marked @Public, regardless of required permissions', () => {
    const guard = new PermissionsGuard(buildReflector(true, ['gl.journal.post']));
    const context = buildContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request through when no @RequirePermissions metadata is declared', () => {
    const guard = new PermissionsGuard(buildReflector(false, undefined));
    const context = buildContext({ id: 'u1', permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request through when @RequirePermissions is declared with an empty array', () => {
    const guard = new PermissionsGuard(buildReflector(false, []));
    const context = buildContext({ id: 'u1', permissions: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws when permissions are required but there is no authenticated user on the request', () => {
    const guard = new PermissionsGuard(buildReflector(false, ['gl.journal.post']));
    const context = buildContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws naming the specific missing permission(s) when the user lacks some of the required set', () => {
    const guard = new PermissionsGuard(buildReflector(false, ['gl.journal.post', 'gl.journal.approve']));
    const user = { id: 'u1', permissions: ['gl.journal.post'] };
    const context = buildContext(user);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err) {
      expect((err as ForbiddenException).message).toContain('gl.journal.approve');
      expect((err as ForbiddenException).message).not.toContain('gl.journal.post');
    }
  });

  it('requires ALL listed permission codes, not just one of them', () => {
    const guard = new PermissionsGuard(buildReflector(false, ['a.one', 'a.two']));
    const user = { id: 'u1', permissions: ['a.one'] };
    const context = buildContext(user);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows the request through when the user holds every required permission code', () => {
    const guard = new PermissionsGuard(buildReflector(false, ['a.one', 'a.two']));
    const user = { id: 'u1', permissions: ['a.one', 'a.two', 'a.three'] };
    const context = buildContext(user);
    expect(guard.canActivate(context)).toBe(true);
  });
});
