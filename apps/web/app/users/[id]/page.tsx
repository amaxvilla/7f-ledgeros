import Link from 'next/link';
import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../../lib/api';
import { UserRolesForm, type RoleOption } from './UserRolesForm';
import { SecurityAdminActions } from './SecurityAdminActions';
import { RevokeDeviceButton } from './RevokeDeviceButton';
import { UserSessionsTable, UserTrustedDevicesTable, UserLoginHistoryTable } from '../UsersTables';

export const dynamic = 'force-dynamic';

interface UserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  lockedUntil: string | null;
  createdAt: string;
  roles: { id: string; code: string; name: string }[];
}

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

interface TrustedDevice {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  trustedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

interface LoginHistoryEntry {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  createdAt: string;
}

function isCurrentlyLocked(lockedUntil: string | null): boolean {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now();
}

/**
 * `LoginEventType` (confirmed directly against `schema.prisma`):
 * `LOGIN_SUCCESS`/`LOGIN_FAILURE`/`LOGOUT`/`ACCOUNT_LOCKED`/
 * `ACCOUNT_UNLOCKED` — five values, mapped here rather than left to
 * `Badge`'s own default tone, the same "don't let an unmapped enum
 * value fall back to something misleading" reasoning `STATUS_TONE`
 * maps already established elsewhere in this app (BOQ/Work Package
 * status, PMO document status).
 */
function loginEventTone(eventType: string): 'positive' | 'negative' | 'warning' | 'neutral' {
  switch (eventType) {
    case 'LOGIN_SUCCESS':
      return 'positive';
    case 'LOGIN_FAILURE':
    case 'ACCOUNT_LOCKED':
      return 'negative';
    case 'ACCOUNT_UNLOCKED':
      return 'warning';
    default:
      return 'neutral';
  }
}

async function loadUserDetail(userId: string) {
  const [user, allRoles, sessions, devices, loginHistory] = await Promise.all([
    fetchApi<UserDetail>(`/users/${userId}`),
    fetchApi<RoleOption[]>('/roles'),
    fetchApi<Session[]>(`/security/sessions/user/${userId}`),
    fetchApi<TrustedDevice[]>(`/security/devices/user/${userId}`),
    fetchApi<LoginHistoryEntry[]>(`/security/login-history/user/${userId}`),
  ]);
  return { user, allRoles, sessions, devices, loginHistory };
}

/**
 * Frontend Completion, Users.2 — the detail half of Users.1's own
 * recommended split ("role assignment first, then security admin
 * actions second"). `GET /users/:id` is NEW this checkpoint (see
 * `users.controller.ts`'s own doc comment for the full endpoint/
 * permission reasoning) — same genuinely-single-item shape
 * `/roles/[id]` already has (not the "no single-item endpoint, fetch
 * list + find by id" workaround `/work-packages/[id]` and
 * `/land-bank/estates/[estateId]` both need elsewhere in this app),
 * since this whole detail route was written fresh this checkpoint
 * rather than retrofitted onto a pre-existing gap.
 *
 * `GET /roles` (fetched here for `UserRolesForm`'s own checklist) is
 * the same endpoint `/roles` itself already lists from — its own
 * response already has exactly `{ id, code, name, ... }` per role,
 * more than `RoleOption` needs, which is fine (the extra
 * `permissionCount`/`userCount`/`description`/`isSystem` fields are
 * simply unused here, not stripped) — no new endpoint needed for this
 * side of the picker.
 *
 * `isCurrentlyLocked` duplicated here rather than imported from
 * `/users/page.tsx` — this app has no shared-helpers file for small,
 * page-local functions like this one, and every other page-local
 * helper in this app (`findCurrentReservationId`, `flattenUnits`, etc.)
 * is similarly duplicated-not-shared when it's small and page-specific;
 * not treated as a new problem to solve here.
 *
 * ADDENDUM (Users.3) — the security admin actions this page's own
 * history named as deferred are built now: `SecurityAdminActions.tsx`
 * (Unlock Account, gated on `isCurrentlyLocked`; Revoke All Sessions,
 * ungated) plus three read-only tables (Active Sessions, Trusted
 * Devices — with a per-row `RevokeDeviceButton`, the one admin action
 * on this controller that IS per-row rather than all-or-nothing, see
 * `actions.ts`'s own doc comment for the checked reason why — and
 * Login History, no actions at all). `loadUserDetail` below now fetches
 * all three lists in the same `Promise.all` as `user`/`allRoles`, not a
 * second round-trip.
 */
export default async function UserDetailPage({ params }: { params: { id: string } }) {
  let user: UserDetail | null = null;
  let allRoles: RoleOption[] = [];
  let sessions: Session[] = [];
  let devices: TrustedDevice[] = [];
  let loginHistory: LoginHistoryEntry[] = [];
  let error: string | null = null;
  try {
    const result = await loadUserDetail(params.id);
    user = result.user;
    allRoles = result.allRoles;
    sessions = result.sessions;
    devices = result.devices;
    loginHistory = result.loginHistory;
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load user.';
  }

  if (error || !user) {
    return (
      <PageContainer>
        <PageHeader title="User detail" />
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body }}>{error ?? 'User not found.'}</div>
        <p style={{ marginTop: tokens.space(4) }}>
          <Link href="/users" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
            ← Back to Users
          </Link>
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <p style={{ marginBottom: tokens.space(4) }}>
        <Link href="/users" style={{ color: tokens.color.accent, fontFamily: tokens.font.body, fontSize: '13px' }}>
          ← Back to Users
        </Link>
      </p>

      <PageHeader title={`${user.firstName} ${user.lastName}`} subtitle={user.email} />

      <div style={{ display: 'flex', gap: tokens.space(2), marginBottom: tokens.space(6) }}>
        {isCurrentlyLocked(user.lockedUntil) ? (
          <Badge tone="negative">Locked</Badge>
        ) : (
          <Badge tone={user.isActive ? 'positive' : 'neutral'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
        )}
        <Badge tone={user.mfaEnabled ? 'positive' : 'neutral'}>{user.mfaEnabled ? 'MFA enabled' : 'MFA off'}</Badge>
      </div>

      <section>
        <PageHeader title="Roles" subtitle={`${user.roles.length} of ${allRoles.length} assigned`} />
        <UserRolesForm userId={user.id} allRoles={allRoles} initiallyChecked={user.roles.map((r) => r.id)} />
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <PageHeader title="Security admin" />
        <SecurityAdminActions userId={user.id} locked={isCurrentlyLocked(user.lockedUntil)} />

        <PageHeader title="Active sessions" subtitle={`${sessions.length}`} />
        <UserSessionsTable rows={sessions} />

        <PageHeader title="Trusted devices" subtitle={`${devices.length}`} />
        <UserTrustedDevicesTable rows={devices} userId={user.id} />

        <PageHeader title="Login history" subtitle={`${loginHistory.length}`} />
        <UserLoginHistoryTable rows={loginHistory} />
      </section>
    </PageContainer>
  );
}
