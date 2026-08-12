'use client';

import * as React from 'react';
import { Button, tokens } from '@7f/ui';
import { setRolePermissions } from './actions';

export interface PermissionOption {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

/**
 * Frontend Completion, FE-6 — this app's first checkbox-GROUP form.
 * `@7f/ui` has no multi-select checkbox primitive (confirmed by
 * checking `packages/ui/src/index.ts`'s own export list) — plain
 * `<input type="checkbox">`, styled inline with `tokens`, the same
 * "plain native element when the shared component doesn't fit"
 * precedent `ProjectSelector` already set for a native `<select>`
 * inside a GET form.
 *
 * Grouped by `module` (`Permission.module`, e.g. "GL", "AR", "PMO") —
 * confirmed the permission catalog is large enough (190+ codes as of
 * this checkpoint) that one long flat list would be unusable; grouping
 * by the field the schema itself already provides for exactly this
 * purpose (confirmed against `Permission.module`'s own `@@index`) is a
 * genuine UX necessity here, not a nice-to-have this checkpoint
 * invented a reason for.
 *
 * State is `Set<string>` of currently-checked permission codes,
 * initialized from the role's own current `permissions` prop and
 * otherwise entirely local — no per-checkbox network call on toggle
 * (unlike `PostAPInvoiceButton`'s own Select+Button row action, this
 * isn't a single scalar field, it's the WHOLE set, so the natural shape
 * is "check/uncheck freely, one Save button submits the final state" —
 * `setRolePermissions` is called with the full `Set` converted back to
 * an array on submit, matching `PUT /roles/:id/permissions`'s own
 * full-replace contract exactly, not a diff).
 *
 * `isSystem` is NOT used to disable this form — deliberately: no stated
 * business rule anywhere in this backend blocks editing a system role's
 * permissions (confirmed directly, `RolesController.setPermissions` has
 * no `isSystem` check at all), and inventing a client-side block for a
 * rule the backend itself doesn't enforce would create a false sense of
 * protection while being trivially bypassable via the API directly —
 * worse than not blocking it at all. The role's own `isSystem` badge
 * (rendered on `page.tsx`, not here) is the only signal given.
 */
export function RolePermissionsForm({
  roleId,
  allPermissions,
  initiallyChecked,
}: {
  roleId: string;
  allPermissions: PermissionOption[];
  initiallyChecked: string[];
}) {
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(initiallyChecked));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const byModule = React.useMemo(() => {
    const groups = new Map<string, PermissionOption[]>();
    for (const permission of allPermissions) {
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions]);

  function toggle(code: string) {
    setSaved(false);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await setRolePermissions(roleId, Array.from(checked));
    setPending(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Failed to save permissions.');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(5), marginBottom: tokens.space(5) }}>
        {byModule.map(([module, permissions]) => (
          <div key={module}>
            <h3 style={{ fontFamily: tokens.font.display, fontSize: '14px', color: tokens.color.textPrimary, marginBottom: tokens.space(2) }}>
              {module}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
              {permissions.map((permission) => (
                <label
                  key={permission.id}
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
                  <input type="checkbox" checked={checked.has(permission.code)} onChange={() => toggle(permission.code)} />
                  <span>{permission.code}</span>
                  {permission.description && (
                    <span style={{ color: tokens.color.textMuted }}>— {permission.description}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="button" disabled={pending} onClick={handleSave}>
          {pending ? 'Saving…' : 'Save permissions'}
        </Button>
        {saved && <span style={{ color: tokens.color.positive, fontFamily: tokens.font.body, fontSize: '13px' }}>Saved.</span>}
        {error && <span style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</span>}
      </div>
    </div>
  );
}
