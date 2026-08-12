'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface SetUserRolesFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, Users.2. `PUT /users/:id/roles` requires
 * `rbac.manage` (confirmed directly against `UsersController.setRoles`
 * — deliberately NOT `security.access.manage`, see that controller's
 * own doc comment for why) and replaces the user's ENTIRE role set in
 * one call — deletes every existing `UserRole` row for this user,
 * recreates from the given `roleIds` array. `UserRolesForm` always
 * submits its own full current checkbox state, not a diff, matching
 * `setRolePermissions`'s own identical full-replace shape for the
 * structurally identical `RolePermission` join.
 */
export async function setUserRoles(userId: string, roleIds: string[]): Promise<SetUserRolesFormState> {
  try {
    await fetchApi(`/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to save roles.' };
  }

  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');
  return { ok: true };
}

export interface UserActionState {
  ok: boolean;
  error?: string;
  revokedCount?: number;
}

/**
 * Frontend Completion, Users.3 — the second half of Users.1's own
 * split, now built. All three actions below require
 * `security.access.manage` (confirmed directly against
 * `SecurityHardeningController` — the same code the corresponding
 * `security.access.view` GETs this checkpoint also newly consumes
 * pair against, the identical view/manage split `GET /users/:id`
 * vs. `PUT /users/:id/roles` already established in Users.2).
 *
 * `unlockAccount` (`POST /security/accounts/:userId/unlock`,
 * `UnlockAccountDto`) takes an OPTIONAL `reason` — confirmed directly,
 * `@IsOptional()` on the DTO's only field — so this action's own
 * `reason` parameter is optional here too, not required the way
 * `CloseCurrentForm`'s `reason` fields elsewhere in this app are for
 * DTOs that mark it required.
 *
 * `revokeAllSessions` (`POST /security/sessions/user/:userId/revoke-all`)
 * takes an EMPTY body (`RevokeUserSessionsDto`, confirmed directly to
 * have no fields at all — the controller even names its own param
 * `_dto`, unread) — called with `{}` here, not omitted, to keep this
 * file's own "every mutating call sends a JSON body" convention
 * consistent rather than special-casing the one truly bodyless action.
 * Admin session revocation is ALL-OR-NOTHING — confirmed directly no
 * `DELETE /security/sessions/user/:userId/:sessionId` (single-session)
 * admin route exists, unlike devices below. A real, checked asymmetry
 * between sessions and devices admin, not an oversight in this file.
 * `SessionService.revokeAllSessionsForUser` returns `{ revokedCount }`
 * (confirmed directly) — surfaced back through `UserActionState`'s own
 * optional `revokedCount` field so `SecurityAdminActions.tsx` can show
 * a real "3 sessions revoked" confirmation rather than a bare success
 * state.
 *
 * `revokeDevice` (`DELETE /security/devices/user/:userId/:deviceId`)
 * DOES support single-device revocation for admins — confirmed
 * directly — the other half of that asymmetry.
 */
export async function unlockAccount(userId: string, reason?: string): Promise<UserActionState> {
  try {
    await fetchApi(`/security/accounts/${userId}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || undefined }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to unlock account.' };
  }

  revalidatePath(`/users/${userId}`);
  return { ok: true };
}

export async function revokeAllSessions(userId: string): Promise<UserActionState> {
  let revokedCount: number | undefined;
  try {
    const result = await fetchApi<{ revokedCount: number }>(`/security/sessions/user/${userId}/revoke-all`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    revokedCount = result.revokedCount;
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke sessions.' };
  }

  revalidatePath(`/users/${userId}`);
  return { ok: true, revokedCount };
}

export async function revokeDevice(userId: string, deviceId: string): Promise<UserActionState> {
  try {
    await fetchApi(`/security/devices/user/${userId}/${deviceId}`, { method: 'DELETE' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke device.' };
  }

  revalidatePath(`/users/${userId}`);
  return { ok: true };
}
