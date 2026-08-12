import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@7f/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DimensionScope, SecurityScope } from './security.types';

/**
 * Permission codes that imply "unrestricted" visibility on a given
 * dimension even without/beyond explicit per-row grants. Kept as an
 * explicit allow-list (not "any admin-ish permission") so that granting a
 * module-manage permission never silently grants unrelated cross-entity
 * visibility.
 */
const ENTITY_UNRESTRICTED_PERMISSIONS = [
  PERMISSIONS.ENTITY_MANAGE,
  // Release IE.1, Checkpoint E — see PAYMENT_RECONCILE's doc comment in
  // permissions.ts for why this is its own permission rather than
  // widening PAYMENT_MANAGE's existing per-entity scoping.
  PERMISSIONS.PAYMENT_RECONCILE,
];
const SYSTEM_ADMIN_ALL_PERMISSION_COUNT = Object.keys(PERMISSIONS).length;

/**
 * Builds the per-request SecurityScope used by RowLevelSecurityService,
 * FieldMaskingInterceptor, and any service that needs to reason about a
 * user's row-level access directly.
 *
 * Request-scoped: one instance is constructed per HTTP request (Nest
 * `Scope.REQUEST` would work too, but since every caller already has the
 * `AuthenticatedUser` from `@CurrentUser()`, this is implemented as a plain
 * singleton with the user passed explicitly — cheaper, and avoids forcing
 * every consuming module's providers into request scope transitively).
 */
@Injectable()
export class SecurityContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the full scope for a user. `isSystemAdmin` is true when the
   * user's permission set is a superset of every known permission code
   * (i.e. the SYSTEM_ADMIN role, which is granted `Object.values(PERMISSIONS)`
   * in packages/config/src/permissions.ts) — checked structurally rather
   * than by role name so it stays correct if the role is renamed.
   *
   * Async as of Phase 2's Business Unit dimension: business-unit grants are
   * Business Unit ids, not Entity ids, so they must be resolved against the
   * current Entity → Business Unit assignment (a DB read) before they can
   * restrict the `entity` dimension. Every other dimension remains a pure
   * in-memory computation over `user`.
   */
  async buildScope(user: AuthenticatedUser): Promise<SecurityScope> {
    const isSystemAdmin = this.isEffectivelySystemAdmin(user);
    const businessUnit = await this.buildBusinessUnitScope(user, isSystemAdmin);

    return {
      userId: user.id,
      isSystemAdmin,
      entity: this.buildDimensionScope({
        isSystemAdmin,
        unrestrictedPermissions: ENTITY_UNRESTRICTED_PERMISSIONS,
        userPermissions: user.permissions,
        grants: (user.entityAccess ?? []).map((g) => ({
          id: g.entityId,
          canView: g.canView,
          canPost: g.canPost,
        })),
        // Entity access predates Phase 2 and has always been meant to be
        // enforced (see UserEntityAccess doc comment) — a user with zero
        // grant rows has no entities, fail closed.
        unrestrictedIfNoGrants: false,
      }),
      department: this.buildDimensionScope({
        isSystemAdmin,
        unrestrictedPermissions: [PERMISSIONS.HR_MANAGE],
        userPermissions: user.permissions,
        grants: (user.departmentAccess ?? []).map((g) => ({
          id: g.departmentId,
          canView: g.canView,
          canPost: g.canPost,
        })),
        // New dimension introduced in Phase 2: existing users have no rows
        // yet. Treat "no grants configured" as unrestricted so nobody is
        // silently locked out the moment this ships. Once an admin adds the
        // first explicit grant for a user, that user becomes restricted to
        // only the granted departments.
        unrestrictedIfNoGrants: true,
      }),
      costCenter: this.buildDimensionScope({
        isSystemAdmin,
        unrestrictedPermissions: [PERMISSIONS.GL_PERIOD_LOCK],
        userPermissions: user.permissions,
        grants: (user.costCenterAccess ?? []).map((g) => ({
          id: g.costCenterId,
          canView: g.canView,
          canPost: g.canPost,
        })),
        unrestrictedIfNoGrants: true,
      }),
      project: this.buildDimensionScope({
        isSystemAdmin,
        unrestrictedPermissions: [PERMISSIONS.PMO_MANAGE],
        userPermissions: user.permissions,
        grants: (user.projectAccess ?? []).map((g) => ({
          id: g.projectId,
          canView: g.canView,
          canPost: g.canPost,
        })),
        unrestrictedIfNoGrants: true,
      }),
      businessUnit,
    };
  }

  /** True if the field group's unmasking permission is present (or system admin). */
  canViewSensitiveField(user: AuthenticatedUser, permissionCode: string): boolean {
    if (this.isEffectivelySystemAdmin(user)) return true;
    return user.permissions.includes(permissionCode);
  }

  private isEffectivelySystemAdmin(user: AuthenticatedUser): boolean {
    return user.permissions.length >= SYSTEM_ADMIN_ALL_PERMISSION_COUNT;
  }

  /**
   * Resolves UserBusinessUnitAccess grants (Business Unit ids) down to the
   * Entity ids they cover, then shapes that as a DimensionScope over
   * `entityId` — the same physical column the `entity` dimension uses (see
   * RowLevelSecurityService's DIMENSION_FIELD map). New dimension, same
   * rollout policy as department/costCenter/project: a user with zero
   * business-unit grants configured is unrestricted on this dimension
   * (nobody is locked out the moment this ships); once an admin adds the
   * first grant, that user is restricted to Entities under their granted
   * Business Units.
   */
  private async buildBusinessUnitScope(
    user: AuthenticatedUser,
    isSystemAdmin: boolean,
  ): Promise<DimensionScope> {
    const grants = user.businessUnitAccess ?? [];
    const hasUnrestrictedPermission = user.permissions.includes(PERMISSIONS.BUSINESS_UNIT_MANAGE);
    const noGrantsConfigured = grants.length === 0;
    const unrestricted = isSystemAdmin || hasUnrestrictedPermission || noGrantsConfigured;

    if (unrestricted) {
      return { unrestricted: true, viewableIds: [], postableIds: [] };
    }

    const viewableBuIds = grants.filter((g) => g.canView).map((g) => g.businessUnitId);
    const postableBuIds = grants.filter((g) => g.canPost).map((g) => g.businessUnitId);
    const allBuIds = Array.from(new Set([...viewableBuIds, ...postableBuIds]));

    if (allBuIds.length === 0) {
      return { unrestricted: false, viewableIds: [], postableIds: [] };
    }

    const entities = await this.prisma.entity.findMany({
      where: { businessUnitId: { in: allBuIds } },
      select: { id: true, businessUnitId: true },
    });

    const viewableBuSet = new Set(viewableBuIds);
    const postableBuSet = new Set(postableBuIds);

    return {
      unrestricted: false,
      viewableIds: entities.filter((e) => viewableBuSet.has(e.businessUnitId!)).map((e) => e.id),
      postableIds: entities.filter((e) => postableBuSet.has(e.businessUnitId!)).map((e) => e.id),
    };
  }

  private buildDimensionScope(args: {
    isSystemAdmin: boolean;
    unrestrictedPermissions: string[];
    userPermissions: string[];
    grants: { id: string; canView: boolean; canPost: boolean }[];
    unrestrictedIfNoGrants: boolean;
  }): DimensionScope {
    const { isSystemAdmin, unrestrictedPermissions, userPermissions, grants, unrestrictedIfNoGrants } = args;

    const hasUnrestrictedPermission = unrestrictedPermissions.some((p) => userPermissions.includes(p));
    const noGrantsConfigured = grants.length === 0;

    const unrestricted =
      isSystemAdmin || hasUnrestrictedPermission || (unrestrictedIfNoGrants && noGrantsConfigured);

    return {
      unrestricted,
      viewableIds: grants.filter((g) => g.canView).map((g) => g.id),
      postableIds: grants.filter((g) => g.canPost).map((g) => g.id),
    };
  }
}
