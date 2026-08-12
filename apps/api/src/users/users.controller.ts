import { Body, Controller, Get, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';
import { PERMISSIONS } from '@7f/config';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

class SetUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds!: string[];
}

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  mfaEnabled: true,
  lockedUntil: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} as const;

function serializeUser<T extends { roles: { role: { id: string; code: string; name: string } }[] }>(u: T) {
  return { ...u, roles: u.roles.map((ur) => ur.role) };
}

/**
 * Frontend Completion, FE-6 — Users. Directly follows Roles.1's own
 * recommended next checkpoint ("a Users module (list users, at
 * minimum)"), and that report's own instruction to first confirm
 * whether `User` has any existing read endpoint anywhere in this
 * backend before assuming one needs to be built from scratch.
 *
 * CONFIRMED, RE-CHECKED DIRECTLY: grepped every `this.prisma.user.`
 * call in `apps/api/src` (`auth.service.ts`, `account-lockout.service.ts`,
 * `password-policy.service.ts`, `mfa.service.ts`) and found only
 * single-record `findUnique`/`update`/`count` — never a `findMany`. No
 * `@Controller('users')` anywhere either. This is the first.
 *
 * PERMISSION CHOICE — reused `SECURITY_ACCESS_VIEW`, deliberately NOT a
 * new code, for a reason worth stating precisely: `SECURITY_ACCESS_*`'s
 * own comment in `permissions.ts` says "Phase 2 — Row Level Security /
 * dynamic dimension access admin" — the exact framing Roles.1's own
 * report cited when it decided this pair didn't fit Role/Permission
 * CRUD. But `SecurityHardeningController` (confirmed directly, not
 * assumed) already gates `login-history/user/:userId`,
 * `sessions/user/:userId`, `devices/user/:userId`, and
 * `accounts/:userId/unlock` — every admin-facing "act on a DIFFERENT
 * user" endpoint in that controller — on this exact same
 * `security.access.view`/`.manage` pair, not on anything RLS-specific.
 * The doc comment describes original intent; actual controller usage
 * has broadened past it without the comment being updated. A user LIST
 * is the direct, minimal prerequisite those existing `:userId` endpoints
 * already assume exists (you can't pick a `:userId` to unlock/inspect
 * without one) — reusing the code those endpoints already use is more
 * consistent with this codebase's actual shape than adding a third
 * RBAC-adjacent permission code for a capability that's really the same
 * "security admin acting on other users" surface, just missing its own
 * entry point until now.
 *
 * FIELD SELECTION IS THE LOAD-BEARING PART OF THIS FILE: `User` carries
 * `passwordHash` and `mfaSecret` (confirmed directly against
 * `schema.prisma` — the latter explicitly flagged there as stored
 * unencrypted). An unscoped `findMany()` would serialize both directly
 * into this endpoint's JSON response. `select` below is deliberately
 * exhaustive and explicit rather than `include`-based, so adding a new
 * sensitive column to `User` in the future can't silently leak through
 * this endpoint by default the way an `include`/bare-`findMany` shape
 * could.
 *
 * Read-only this checkpoint — no create/deactivate/role-assignment
 * endpoint. Role assignment in particular needs `UserRole` create/
 * delete, deliberately deferred to its own checkpoint once this list
 * exists for `/roles/[id]` to select a user from (the same dependency
 * Roles.1's own report named).
 *
 * ADDENDUM (Users.2) — role assignment, this checkpoint's own pick from
 * Users.1's own recommended split ("role assignment first, then
 * security admin actions second"). `GET /users/:id` and `PUT
 * /users/:id/roles` added, following `RolesController`'s own exact
 * `findOne`/`setPermissions` shape: `setRoles` is FULL-REPLACE, not an
 * incremental add/remove (deletes every existing `UserRole` row for
 * this user, recreates from the given set, in one `$transaction`) —
 * the same "one checklist, one Save" semantics `RolePermissionsForm`
 * already established for `PUT /roles/:id/permissions`, reused here
 * rather than inventing a different (diff-based) shape for a
 * structurally identical join-table assignment.
 *
 * PERMISSION SPLIT, DELIBERATE: `findOne` reuses `SECURITY_ACCESS_VIEW`
 * (same code `list` already uses — this is "view a user", the same
 * capability, just one record instead of many). `setRoles` uses
 * `RBAC_MANAGE`, NOT `SECURITY_ACCESS_MANAGE` — confirmed directly this
 * is the more consistent choice: assigning roles to a user is an RBAC
 * operation (the exact same permission `RolesController.setPermissions`
 * already requires for the structurally identical `RolePermission`
 * join), not a user-account-security operation. Two different
 * permission codes on two endpoints in the same file, for a real,
 * checked reason — not an oversight.
 *
 * `USER_SELECT`/`serializeUser` extracted (previously inlined in `list`
 * alone) so `findOne` doesn't duplicate the same exhaustive,
 * explicit-`select` reasoning above in a second place — both endpoints
 * now share the exact one column list that keeps `passwordHash`/
 * `mfaSecret` out.
 */
@Controller()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  @ApiOperation({ summary: 'List every user', description: 'Deliberately excludes passwordHash/mfaSecret via an explicit field select, not an include — those never leave this endpoint even as new columns are added to User.' })
  @RequirePermissions(PERMISSIONS.SECURITY_ACCESS_VIEW)
  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: USER_SELECT,
    });
    return users.map(serializeUser);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get one user, including their assigned roles' })
  @RequirePermissions(PERMISSIONS.SECURITY_ACCESS_VIEW)
  async findOne(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return serializeUser(user);
  }

  @Put('users/:id/roles')
  @ApiOperation({ summary: 'Replace a user\'s entire set of role assignments', description: 'Full-replace, not incremental: deletes every existing role assignment for this user and creates exactly the given set in one transaction. Rejects with 404 if any roleId is unrecognized, before making any change.' })
  @RequirePermissions(PERMISSIONS.RBAC_MANAGE)
  async setRoles(@Param('id') id: string, @Body() dto: SetUserRolesDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } });
    const foundIds = new Set(roles.map((r) => r.id));
    const unknown = dto.roleIds.filter((roleId) => !foundIds.has(roleId));
    if (unknown.length > 0) {
      throw new NotFoundException(`Unknown role id(s): ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roles.map((r) => ({ userId: id, roleId: r.id })),
      }),
    ]);

    return this.findOne(id);
  }
}
