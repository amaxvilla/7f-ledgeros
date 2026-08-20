import Link from 'next/link';
import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { UsersTable } from './UsersTables';

export const dynamic = 'force-dynamic';

interface UserRoleSummary {
  id: string;
  code: string;
  name: string;
}

interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  lockedUntil: string | null;
  createdAt: string;
  roles: UserRoleSummary[];
}

function isCurrentlyLocked(lockedUntil: string | null): boolean {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now();
}

async function loadUsers() {
  return fetchApi<UserSummary[]>('/users');
}

/**
 * Frontend Completion, FE-6 — Users. Directly follows Roles.1's own
 * recommended next checkpoint. `GET /users` is NEW this checkpoint —
 * see `apps/api/src/users/users.controller.ts`'s own doc comment for
 * the full "why this didn't exist before, why `SECURITY_ACCESS_VIEW`
 * rather than a new permission code" reasoning; not repeated here.
 *
 * NO `EntitySelector` — `User` is system-wide, same structural posture
 * `/roles` already established (and, before that, `/security`) for a
 * non-entity-scoped page.
 *
 * READ-ONLY this checkpoint, deliberately — no create-user form (users
 * are created via the auth/signup flow, not an admin-facing form; this
 * checkpoint didn't touch that), no deactivate/reactivate action, no
 * role-assignment action. Each `roles` badge shown per-user is
 * display-only; assigning/removing a role is the natural next
 * checkpoint (see this page's own closing note in the checkpoint
 * report) once both this list AND `/roles/[id]`'s own
 * `RolePermissionsForm` exist to make that a two-sided picker rather
 * than a guess at either end.
 *
 * `lockedUntil` is a raw nullable timestamp, not a live boolean — a
 * user's lock can expire on its own (`AccountLockoutService`'s own
 * logic, confirmed directly: locks are time-bounded, not permanent
 * until manually unlocked). `isCurrentlyLocked` compares it against
 * "now" at render time rather than trusting a stale badge from a
 * server-rendered page that might be viewed minutes later — a real,
 * if minor, distinction worth getting right for a security-adjacent
 * status rather than a cosmetic one.
 *
 * ADDENDUM (Users.2) — added a "Manage" column linking each row to the
 * new `/users/[id]` role-assignment detail page (the same `Link`ed-
 * column-in-a-`DataTable` shape `/roles/page.tsx` already established
 * for its own register). Named "Manage" rather than reusing "Roles" —
 * that header already belongs to the existing display-only badge
 * column above; this is a second, genuinely different column, not a
 * replacement for it.
 */
export default async function UsersPage() {
  let users: UserSummary[] | null = null;
  let error: string | null = null;
  try {
    users = await loadUsers();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load users.';
  }

  const activeCount = users ? users.filter((u) => u.isActive).length : 0;
  const mfaCount = users ? users.filter((u) => u.mfaEnabled).length : 0;
  const lockedCount = users ? users.filter((u) => isCurrentlyLocked(u.lockedUntil)).length : 0;

  return (
    <PageContainer>
      <PageHeader title="Users" subtitle="System-wide — not scoped to a single entity" />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>{error}</div>
      )}

      {users && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard label="Users" value={String(users.length)} />
            <KpiCard label="Active" value={String(activeCount)} />
            <KpiCard label="MFA enabled" value={String(mfaCount)} />
            <KpiCard label="Currently locked" value={String(lockedCount)} tone={lockedCount > 0 ? 'warning' : 'positive'} />
          </section>

          <section>
            <PageHeader title="Users" />
            <UsersTable rows={users} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
