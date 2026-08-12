import { ForbiddenException } from '@nestjs/common';
import { EntityAccessGuard } from '../entity-access.guard';
import { SecurityContextService } from '../security-context.service';
import { RLS_BODY_CHECK_KEY } from '../decorators/rls-dimensions.decorator';

function buildContext(user: unknown, body: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, body }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function buildReflector(spec: unknown) {
  return { getAllAndOverride: jest.fn().mockReturnValue(spec) } as any;
}

describe('EntityAccessGuard', () => {
  let securityContext: SecurityContextService;

  beforeEach(() => {
    securityContext = new SecurityContextService({ entity: { findMany: jest.fn().mockResolvedValue([]) } } as any);
  });

  it('allows the request through when no @RlsBodyCheck metadata is declared', async () => {
    const guard = new EntityAccessGuard(buildReflector(undefined), securityContext);
    const context = buildContext({ id: 'u1', permissions: [] }, { entityId: 'ent-1' });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('throws when there is no authenticated user', async () => {
    const spec = { dimension: 'entity', bodyField: 'entityId', mode: 'post' };
    const guard = new EntityAccessGuard(buildReflector(spec), securityContext);
    const context = buildContext(undefined, { entityId: 'ent-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows the request through when the dimension id is missing from the body (DTO validation handles that)', async () => {
    const spec = { dimension: 'entity', bodyField: 'entityId', mode: 'post' };
    const guard = new EntityAccessGuard(buildReflector(spec), securityContext);
    const context = buildContext({ id: 'u1', permissions: [] }, {});
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('allows access when the dimension is unrestricted for the user', async () => {
    const spec = { dimension: 'department', bodyField: 'departmentId', mode: 'post' };
    const guard = new EntityAccessGuard(buildReflector(spec), securityContext);
    // department has no grants configured -> unrestricted per rollout policy
    const context = buildContext({ id: 'u1', permissions: [] }, { departmentId: 'dept-1' });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('denies access when the body entity id is not in the user postable set', async () => {
    const spec = { dimension: 'entity', bodyField: 'entityId', mode: 'post' };
    const guard = new EntityAccessGuard(buildReflector(spec), securityContext);
    const user = {
      id: 'u1',
      permissions: [],
      entityAccess: [{ entityId: 'ent-1', canView: true, canPost: false }],
    };
    const context = buildContext(user, { entityId: 'ent-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows access when the body entity id is in the user postable set', async () => {
    const spec = { dimension: 'entity', bodyField: 'entityId', mode: 'post' };
    const guard = new EntityAccessGuard(buildReflector(spec), securityContext);
    const user = {
      id: 'u1',
      permissions: [],
      entityAccess: [{ entityId: 'ent-1', canView: true, canPost: true }],
    };
    const context = buildContext(user, { entityId: 'ent-1' });
    expect(await guard.canActivate(context)).toBe(true);
  });

  it('supports nested dot-path body fields', async () => {
    const spec = { dimension: 'entity', bodyField: 'header.entityId', mode: 'view' };
    const guard = new EntityAccessGuard(buildReflector(spec), securityContext);
    const user = {
      id: 'u1',
      permissions: [],
      entityAccess: [{ entityId: 'ent-1', canView: true, canPost: false }],
    };
    const context = buildContext(user, { header: { entityId: 'ent-1' } });
    expect(await guard.canActivate(context)).toBe(true);
  });
});

describe('RLS_BODY_CHECK_KEY', () => {
  it('is a stable string', () => {
    expect(RLS_BODY_CHECK_KEY).toBe('rlsBodyCheck');
  });
});
