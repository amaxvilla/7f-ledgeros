'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { setUserRoles } from './actions';

export interface RoleOption {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion, Users.2 — role assignment, the checkpoint
 * Users.1's own report split off explicitly ("role assignment first,
 * then security admin actions second"). Mirrors
 * `RolePermissionsForm.tsx`'s own shape exactly — same `Set<string>`
 * local-state-until-Save pattern, same full-replace submit (the entire
 * checked set, not a diff, matching `PUT /users/:id/roles`'s own
 * full-replace contract, confirmed directly against
 * `UsersController.setRoles`) — with one real difference: NOT grouped
 * by anything. `RolePermissionsForm` groups by `module` because the
 * permission catalog is 190+ codes (confirmed there, re-confirmed not
 * true here: `GET /roles` is a small, flat list with no natural
 * grouping field of its own on `Role` itself) — a flat checkbox list is
 * the right shape for this one, not grouping-for-its-own-sake copied
 * from the other form.
 *
 * State keyed by role ID (`Set<string>` of role ids), not role code —
 * `SetUserRolesDto.roleIds` takes ids (confirmed directly against
 * `UsersController.setRoles`), unlike `SetRolePermissionsDto`, which
 * takes permission CODES — a real, checked difference between the two
 * DTOs, not assumed symmetric.
 */
export function UserRolesForm({ userId, allRoles, initiallyChecked }: { userId: string; allRoles: RoleOption[]; initiallyChecked: string[] }) {
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(initiallyChecked));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function toggle(roleId: string) {
    setSaved(false);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await setUserRoles(userId, Array.from(checked));
    setPending(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Failed to save roles.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1), marginBottom: tokens.space(5) }}>
        {allRoles.map((role) => (
          <label
            key={role.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space(2),
              fontFamily: tokens.font.body,
              fontSize: '13px',
              color: tokens.color.textPrimary,
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={checked.has(role.id)} onChange={() => toggle(role.id)} />
            <span>{role.code}</span>
            <span style={{ color: tokens.color.textMuted }}>— {role.name}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? 'Saving…' : 'Save roles'}
        </Button>
        {saved && <span style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Saved.</span>}
        {error && <span style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</span>}
      </div>
    </div>
  );
}
