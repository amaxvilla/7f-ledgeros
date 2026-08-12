'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../../lib/api';

export interface SetRolePermissionsFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-6. `PUT /roles/:id/permissions` requires
 * `rbac.manage` and replaces the role's ENTIRE permission set in one
 * call (confirmed directly against `RolesController.setPermissions` —
 * deletes every existing `RolePermission` row for the role, recreates
 * from the given `permissionCodes` array) — matching a checkbox-grid
 * "one form, one Save" shape, not an incremental add/remove-one API.
 * `RolePermissionsForm` always submits its own full current checkbox
 * state, not a diff.
 */
export async function setRolePermissions(roleId: string, permissionCodes: string[]): Promise<SetRolePermissionsFormState> {
  try {
    await fetchApi(`/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionCodes }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to save permissions.' };
  }

  revalidatePath(`/roles/${roleId}`);
  revalidatePath('/roles');
  return { ok: true };
}
