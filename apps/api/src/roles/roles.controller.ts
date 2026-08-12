import { Body, Controller, ConflictException, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { PERMISSIONS } from '@7f/config';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

class CreateRoleDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes!: string[];
}

/**
 * Frontend Completion, FE-6 — Roles & Permissions. `Role`/`Permission`/
 * `RolePermission`/`UserRole` are all real, fully-modeled Prisma tables
 * (confirmed directly against `schema.prisma`) that `JwtStrategy
 * .validate()` (confirmed directly) queries LIVE on every authenticated
 * request to build `AuthenticatedUser.permissions` — this is genuinely
 * load-bearing authorization data, not a vestigial/unused model. But
 * before this checkpoint, NO REST endpoint anywhere exposed it: no
 * `RolesController`, no `UsersController`, nothing (confirmed by
 * grepping every `*.controller.ts` in this repo for `role`/`permission`
 * routes — zero matches). This is the first.
 *
 * Follows `FeatureFlagsController`'s own established shape for a small,
 * single-file admin module: inline DTOs, `PrismaService` injected
 * directly, no separate `.service.ts` — the same "smallest reasonable
 * module" judgment call that file already made, reused here rather than
 * introducing a heavier service-layer pattern for a module this size.
 *
 * `RBAC_VIEW`/`RBAC_MANAGE` are genuinely NEW permission codes (added in
 * this same checkpoint, `packages/config/src/permissions.ts`) — checked
 * directly first that `SECURITY_ACCESS_VIEW`/`SECURITY_ACCESS_MANAGE`
 * (the only existing codes with plausible-sounding names) are actually
 * for a different feature (RLS dimension-access admin, per that code's
 * own comment), not reused on a name-alone assumption.
 *
 * SCOPE, deliberately narrow — three real capabilities, not a full IAM
 * suite:
 * - List roles (with permission/user counts) and view one role's full
 *   permission set.
 * - Create a new, empty (zero-permission) custom role. Always
 *   `isSystem: false` — this endpoint can never create or masquerade as
 *   one of `DEFAULT_ROLES`' own seeded, `isSystem: true` rows.
 * - Replace a role's ENTIRE permission set in one call
 *   (`PUT /roles/:id/permissions`, full-replace semantics — deletes
 *   every existing `RolePermission` row for that role and recreates the
 *   given set — matching the "one checklist, one Save" shape a
 *   permission-assignment UI naturally has, not an incremental
 *   add/remove-one-at-a-time API).
 *
 * Deliberately NOT built this checkpoint, each for a real, named
 * reason:
 * - Renaming or deleting a role — no stated business rule for whether
 *   `isSystem` roles should be protected from either, and getting that
 *   wrong is a worse mistake than not offering it yet.
 * - User-to-role assignment (`UserRole` create/delete) — there is no
 *   `UsersController`/Users module of ANY kind in this backend
 *   (confirmed directly), so a "who has this role" or "assign this
 *   user to this role" UI has no user list to select from yet. A real,
 *   separate, larger gap than this checkpoint's own scope.
 * - Editing an individual `Permission` row's own `description` — the
 *   permission catalog is entirely code-defined (`PERMISSIONS` in
 *   `@7f/config`, seeded via `prisma/seed.ts`'s idempotent upsert) and
 *   isn't meant to be hand-edited per deployment.
 *
 * A NEW permission code needs a matching `Permission` row to be
 * assignable to any role at all (`RolePermission.permissionId`'s own
 * FK). Confirmed directly against `prisma/seed.ts`: its own "1.
 * Permissions & Roles" step re-upserts a `Permission` row for every
 * code in `Object.values(PERMISSIONS)` on every run — so `RBAC_VIEW`/
 * `RBAC_MANAGE` will populate into the `permissions` table the next
 * time that seed runs, the same idempotent path every other permission
 * code already relies on. Not independently re-verified end-to-end
 * against a live database this checkpoint — this sandbox's own Prisma-
 * client generation is still blocked by the same network-egress
 * limitation multiple prior checkpoints in this app's history have
 * already confirmed and re-confirmed (`binaries.prisma.sh` not in the
 * allowlist).
 */
@Controller()
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List every role', description: 'Includes each role\'s permission count and assigned-user count, but not the permissions/users themselves — see GET /roles/:id for a role\'s full permission set.' })
  @RequirePermissions(PERMISSIONS.RBAC_VIEW)
  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { permissions: true, users: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissionCount: r._count.permissions,
      userCount: r._count.users,
    }));
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get one role, including its full permission set' })
  @RequirePermissions(PERMISSIONS.RBAC_VIEW)
  async findOne(@Param('id') id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions
        .map((rp) => rp.permission)
        .sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a new custom role', description: 'Always created with zero permissions and isSystem: false — this endpoint can never create or masquerade as one of the seeded system roles. Assign permissions afterward via PUT /roles/:id/permissions.' })
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async create(@Body() dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Role code ${dto.code} already exists`);

    return this.prisma.role.create({
      data: { code: dto.code, name: dto.name, description: dto.description, isSystem: false },
    });
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: 'Replace a role\'s entire permission set', description: 'Full-replace, not incremental: deletes every existing permission assignment for this role and creates exactly the given set in one transaction. Rejects with 404 if any permissionCode is unrecognized, before making any change.' })
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async setPermissions(@Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });
    const foundCodes = new Set(permissions.map((p) => p.code));
    const unknown = dto.permissionCodes.filter((code) => !foundCodes.has(code));
    if (unknown.length > 0) {
      throw new NotFoundException(`Unknown permission code(s): ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
      }),
    ]);

    return this.findOne(id);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List the entire permission catalog', description: 'The full, code-defined set of assignable permissions (module + code), not scoped to any one role.' })
  @RequirePermissions(PERMISSIONS.RBAC_VIEW)
  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }
}
