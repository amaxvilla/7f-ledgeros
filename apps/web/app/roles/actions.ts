'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateRoleFormState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-6 — Roles & Permissions. `POST /roles`
 * requires `rbac.manage` (a new permission code added this same
 * checkpoint — see `packages/config/src/permissions.ts`'s own comment
 * for why no existing code fit). Same shared-service-account-token
 * caveat `security/actions.ts`'s own `createIpRule` doc comment already
 * states: a 403 from a token lacking `rbac.manage` surfaces through
 * `fetchApi`'s own `ApiError` the same way any other permission failure
 * would, not handled specially here.
 *
 * Always creates a zero-permission, `isSystem: false` role — assigning
 * permissions is a separate step on the role's own detail page
 * (`/roles/[id]`, `RolePermissionsForm`), not part of this action.
 */
export async function createRole(input: {
  code: string;
  name: string;
  description?: string;
}): Promise<CreateRoleFormState> {
  try {
    await fetchApi('/roles', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create role.' };
  }

  revalidatePath('/roles');
  return { ok: true };
}
