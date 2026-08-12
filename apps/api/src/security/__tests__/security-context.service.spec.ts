import { PERMISSIONS } from '@7f/config';
import { SecurityContextService } from '../security-context.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function buildUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    permissions: [],
    entityAccess: [],
    departmentAccess: [],
    costCenterAccess: [],
    projectAccess: [],
    businessUnitAccess: [],
    ...overrides,
  };
}

/** Minimal PrismaService stand-in — only `entity.findMany` is exercised by
 *  SecurityContextService, for resolving Business Unit grants to Entity ids. */
function buildPrisma(entities: { id: string; businessUnitId: string }[] = []) {
  return {
    entity: {
      findMany: jest.fn(({ where }: { where: { businessUnitId: { in: string[] } } }) =>
        Promise.resolve(entities.filter((e) => where.businessUnitId.in.includes(e.businessUnitId))),
      ),
    },
  } as any;
}

describe('SecurityContextService', () => {
  let service: SecurityContextService;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new SecurityContextService(prisma);
  });

  it('treats a user holding every permission code as system admin and fully unrestricted', async () => {
    const user = buildUser({ permissions: Object.values(PERMISSIONS) });
    const scope = await service.buildScope(user);

    expect(scope.isSystemAdmin).toBe(true);
    expect(scope.entity.unrestricted).toBe(true);
    expect(scope.department.unrestricted).toBe(true);
    expect(scope.costCenter.unrestricted).toBe(true);
    expect(scope.project.unrestricted).toBe(true);
    expect(scope.businessUnit.unrestricted).toBe(true);
  });

  it('fails closed on entity access for a non-admin user with zero entity grants', async () => {
    const user = buildUser({ permissions: [PERMISSIONS.GL_JOURNAL_VIEW] });
    const scope = await service.buildScope(user);

    expect(scope.entity.unrestricted).toBe(false);
    expect(scope.entity.viewableIds).toEqual([]);
    expect(scope.entity.postableIds).toEqual([]);
  });

  it('restricts entity access to only the granted, viewable entity ids', async () => {
    const user = buildUser({
      permissions: [PERMISSIONS.GL_JOURNAL_VIEW],
      entityAccess: [
        { entityId: 'ent-1', canView: true, canPost: true },
        { entityId: 'ent-2', canView: true, canPost: false },
        { entityId: 'ent-3', canView: false, canPost: false },
      ],
    });
    const scope = await service.buildScope(user);

    expect(scope.entity.unrestricted).toBe(false);
    expect(scope.entity.viewableIds.sort()).toEqual(['ent-1', 'ent-2']);
    expect(scope.entity.postableIds).toEqual(['ent-1']);
  });

  it('grants ENTITY_MANAGE holders unrestricted entity access without explicit grants', async () => {
    const user = buildUser({ permissions: [PERMISSIONS.ENTITY_MANAGE] });
    const scope = await service.buildScope(user);

    expect(scope.entity.unrestricted).toBe(true);
  });

  it('treats a user with zero department/cost-centre/project/business-unit grants as unrestricted on those new dimensions (no lockout on rollout)', async () => {
    const user = buildUser({ permissions: [PERMISSIONS.GL_JOURNAL_VIEW] });
    const scope = await service.buildScope(user);

    expect(scope.department.unrestricted).toBe(true);
    expect(scope.costCenter.unrestricted).toBe(true);
    expect(scope.project.unrestricted).toBe(true);
    expect(scope.businessUnit.unrestricted).toBe(true);
  });

  it('restricts department access as soon as the user has at least one explicit grant', async () => {
    const user = buildUser({
      permissions: [PERMISSIONS.GL_JOURNAL_VIEW],
      departmentAccess: [{ departmentId: 'dept-1', canView: true, canPost: false }],
    });
    const scope = await service.buildScope(user);

    expect(scope.department.unrestricted).toBe(false);
    expect(scope.department.viewableIds).toEqual(['dept-1']);
    expect(scope.department.postableIds).toEqual([]);
  });

  it('resolves business-unit grants down to the entity ids under those business units', async () => {
    prisma = buildPrisma([
      { id: 'ent-1', businessUnitId: 'bu-1' },
      { id: 'ent-2', businessUnitId: 'bu-1' },
      { id: 'ent-3', businessUnitId: 'bu-2' },
    ]);
    service = new SecurityContextService(prisma);

    const user = buildUser({
      permissions: [PERMISSIONS.GL_JOURNAL_VIEW],
      businessUnitAccess: [{ businessUnitId: 'bu-1', canView: true, canPost: true }],
    });
    const scope = await service.buildScope(user);

    expect(scope.businessUnit.unrestricted).toBe(false);
    expect(scope.businessUnit.viewableIds.sort()).toEqual(['ent-1', 'ent-2']);
    expect(scope.businessUnit.postableIds.sort()).toEqual(['ent-1', 'ent-2']);
    expect(prisma.entity.findMany).toHaveBeenCalledWith({
      where: { businessUnitId: { in: ['bu-1'] } },
      select: { id: true, businessUnitId: true },
    });
  });

  it('BUSINESS_UNIT_MANAGE grants unrestricted business-unit access without explicit grants, without a DB call', async () => {
    const user = buildUser({ permissions: [PERMISSIONS.BUSINESS_UNIT_MANAGE] });
    const scope = await service.buildScope(user);

    expect(scope.businessUnit.unrestricted).toBe(true);
    expect(prisma.entity.findMany).not.toHaveBeenCalled();
  });

  it('canViewSensitiveField returns true only when the user holds the specific permission code', () => {
    const user = buildUser({ permissions: [PERMISSIONS.SECURITY_VIEW_SALARY] });

    expect(service.canViewSensitiveField(user, PERMISSIONS.SECURITY_VIEW_SALARY)).toBe(true);
    expect(service.canViewSensitiveField(user, PERMISSIONS.SECURITY_VIEW_BANK_DETAILS)).toBe(false);
  });

  it('canViewSensitiveField always returns true for system admin', () => {
    const user = buildUser({ permissions: Object.values(PERMISSIONS) });
    expect(service.canViewSensitiveField(user, PERMISSIONS.SECURITY_VIEW_MEDICAL_RECORDS)).toBe(true);
  });
});
