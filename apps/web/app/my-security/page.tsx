import { ActionForm, Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { revokeSession, revokeDevice, revokeOtherSessions, renameDevice } from './actions';
import { EnrollMfaForm } from './EnrollMfaForm';
import { ChangePasswordForm } from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

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

interface LoginHistoryEvent {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Frontend Completion — "My Security". Self-service page over
 * `/security/sessions/me` and `/security/devices/me`
 * (security-hardening.controller.ts), both of which have existed since
 * the backend's Security Hardening release with no page until now.
 *
 * NO EntitySelector, deliberately — every page since Fixed Assets has
 * needed one because its data is entity-scoped (Prisma models with an
 * entityId column); RefreshToken/TrustedDevice are scoped to a USER,
 * not an entity, and the backend resolves that user from the request's
 * own JWT (@CurrentUser()) via fetchApi's accessToken-cookie-first
 * behavior (Checkpoint AJ) — there is no entityId parameter for either
 * endpoint to take. This is the first page in this app shaped this way;
 * worth noting for whichever future checkpoint builds the next
 * self-service (as opposed to module-data) page, so the "no
 * EntitySelector" choice isn't mistaken for an oversight there either.
 *
 * Revoking a row uses a Server Action bound to that row's id directly
 * in the table's own render callback (`revokeSession.bind(null, s.id)`)
 * rather than a separate client component — the first use of that
 * pattern in this app; every prior mutation (create* in
 * tenants/crm/tax/fixed-assets/lease-management/facility-management)
 * was a top-level form, not a per-row action inside a list, so there
 * was no earlier precedent to match here one way or the other.
 *
 * Deliberately NOT built into this checkpoint: "revoke all other
 * sessions" (`POST /security/sessions/me/revoke-others` — exists on the
 * backend, requires knowing the CURRENT session's own refreshToken to
 * exclude it, which is a small enough wrinkle to want its own
 * checkpoint rather than folded in here), device naming, and MFA
 * enrollment UI (`POST /security/mfa/enroll` — a materially different,
 * bigger piece of UI than a list-plus-revoke page). Named here rather
 * than silently left out.
 *
 * ADDENDUM — "revoke all other sessions" is wired
 * (`revokeOtherSessions`, actions.ts) via `ActionForm` (`@7f/ui`) next
 * to the "Active sessions" heading, same per-row Server Action pattern
 * the table's own Revoke buttons already use — only rendered when
 * there's more than one session, since revoking "everything but the
 * one you're on" is a no-op otherwise. Deliberately did NOT add an
 * `actions` slot to @7f/ui's PageHeader for this — that's a shared
 * component used by every page in this app; the button is composed
 * directly in this page's own layout instead, keeping the change local
 * to this module.
 *
 * ADDENDUM — all four of this page's forms (this one, the two table
 * Revoke buttons, and the device-rename form) originally used a raw
 * `<form action={...}>` DOM attribute pointing straight at a
 * state-returning Server Action. `tsc --noEmit` caught this as a real
 * type error (a `Promise<RevokeActionState>`-returning function isn't
 * assignable to the `void`-returning shape a bare `action` prop expects
 * under this app's pinned React 18) — the exact same caveat
 * `LogoutButton`'s own doc comment already named and fixed once for
 * `onLogout`. All four switched to `ActionForm` in the same checkpoint
 * that introduced it, rather than four near-identical one-off client
 * wrappers — see that component's own doc comment for the full
 * reasoning.
 *
 * ADDENDUM — MFA enrollment UI (EnrollMfaForm) now fills the third
 * named gap: begin → scan QR/enter secret → verify code → save recovery
 * codes. See that component's own doc comment for its step shape and
 * why recovery codes never leave its own React state.
 *
 * ADDENDUM — device naming (the one item the previous addendum left
 * open) is now wired too: `PATCH /security/devices/me/:deviceId`
 * (TrustedDeviceService.renameDevice) didn't exist when this page was
 * first built — confirmed absent by reading trusted-device.service.ts
 * before that checkpoint, not assumed — and now does, added in the same
 * checkpoint that wires this form. A per-row text input + "Save" button
 * next to the existing "Revoke" button, using the same bound-Server-
 * Action-per-row pattern as Revoke, except this is the first action on
 * this page that also needs a real form field alongside its bound id —
 * `renameDevice.bind(null, d.id)` receives the row's FormData as its
 * next argument the same way any bound function receives its remaining
 * arguments, no new pattern beyond what `.bind` already does. With this,
 * every gap named on this page since its first checkpoint is closed.
 *
 * ADDENDUM — Login History and Change Password close out the rest of
 * `security-hardening.controller.ts`'s own self-service surface (see
 * `actions.ts`'s own doc comment for the full before-coding check).
 * Login History is read-only — a `DataTable` straight off
 * `GET /security/login-history/me`, the same "no form, just KPIs/a
 * table" shape `security/page.tsx` uses where the backend has nothing
 * to mutate. Change Password gets its own component (`ChangePasswordForm`,
 * not inlined here) because it needs local success/error React state
 * across a submit-and-clear cycle, the same reason `EnrollMfaForm` is
 * its own component rather than inlined into this page directly.
 */
const EVENT_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  LOGIN_SUCCESS: 'positive',
  LOGIN_FAILURE: 'negative',
  LOGOUT: 'neutral',
  ACCOUNT_LOCKED: 'negative',
  ACCOUNT_UNLOCKED: 'warning',
};

export default async function MySecurityPage() {
  let sessions: Session[] | null = null;
  let sessionsError: string | null = null;
  let devices: TrustedDevice[] | null = null;
  let devicesError: string | null = null;

  try {
    sessions = await fetchApi<Session[]>('/security/sessions/me');
  } catch (e) {
    sessionsError = e instanceof ApiError ? e.message : 'Failed to load active sessions.';
  }

  try {
    devices = await fetchApi<TrustedDevice[]>('/security/devices/me');
  } catch (e) {
    devicesError = e instanceof ApiError ? e.message : 'Failed to load trusted devices.';
  }

  let loginHistory: LoginHistoryEvent[] | null = null;
  let loginHistoryError: string | null = null;
  try {
    loginHistory = await fetchApi<LoginHistoryEvent[]>('/security/login-history/me');
  } catch (e) {
    loginHistoryError = e instanceof ApiError ? e.message : 'Failed to load login history.';
  }

  return (
    <PageContainer>
      <PageHeader title="My Security" subtitle="Active sessions and trusted devices for your account." />

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Two-factor authentication" />
        <EnrollMfaForm />
      </section>

      <section style={{ marginBottom: tokens.space(8) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <PageHeader title="Active sessions" />
          {/* Hidden when there's nothing else to revoke — a session list of exactly one (the current session) would make this button a confusing no-op rather than a real action. */}
          {sessions && sessions.length > 1 && (
            <ActionForm action={revokeOtherSessions}>
              <button
                type="submit"
                style={{
                  color: tokens.color.negative,
                  fontFamily: tokens.font.body,
                  fontSize: '13px',
                  background: 'none',
                  border: `1px solid ${tokens.color.negative}`,
                  borderRadius: tokens.radius.sm,
                  padding: `${tokens.space(2)} ${tokens.space(3)}`,
                  cursor: 'pointer',
                }}
              >
                Revoke all other sessions
              </button>
            </ActionForm>
          )}
        </div>
        {sessionsError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{sessionsError}</div>}
        {sessions && (
          <DataTable
            columns={[
              { header: 'IP address', render: (s: Session) => s.ipAddress ?? '—' },
              { header: 'Device', render: (s: Session) => s.userAgent ?? '—' },
              { header: 'Started', render: (s: Session) => new Date(s.createdAt).toLocaleString() },
              { header: 'Last used', render: (s: Session) => (s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : '—') },
              {
                header: '',
                render: (s: Session) => (
                  <ActionForm action={revokeSession.bind(null, s.id)}>
                    <button type="submit" style={{ color: tokens.color.negative, fontFamily: tokens.font.body, background: 'none', border: 'none', cursor: 'pointer' }}>
                      Revoke
                    </button>
                  </ActionForm>
                ),
              },
            ]}
            rows={sessions}
            keyOf={(s) => s.id}
            emptyMessage="No active sessions."
          />
        )}
      </section>

      <section>
        <PageHeader title="Trusted devices" />
        {devicesError && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{devicesError}</div>}
        {devices && (
          <DataTable
            columns={[
              { header: 'Device', render: (d: TrustedDevice) => d.deviceName ?? d.userAgent ?? 'Unnamed device' },
              { header: 'IP address', render: (d: TrustedDevice) => d.ipAddress ?? '—' },
              { header: 'Trusted since', render: (d: TrustedDevice) => new Date(d.trustedAt).toLocaleString() },
              { header: 'Last used', render: (d: TrustedDevice) => (d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleString() : '—') },
              {
                header: '',
                render: (d: TrustedDevice) => (
                  <ActionForm
                    action={renameDevice.bind(null, d.id)}
                    style={{ display: 'flex', gap: tokens.space(2), alignItems: 'center' }}
                  >
                    <input
                      name="deviceName"
                      defaultValue={d.deviceName ?? ''}
                      placeholder="Name this device"
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: '13px',
                        padding: `${tokens.space(1)} ${tokens.space(2)}`,
                        border: `1px solid ${tokens.color.border}`,
                        borderRadius: tokens.radius.sm,
                        width: '140px',
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        color: tokens.color.textMuted,
                        fontFamily: tokens.font.body,
                        fontSize: '13px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                  </ActionForm>
                ),
              },
              {
                header: '',
                render: (d: TrustedDevice) => (
                  <ActionForm action={revokeDevice.bind(null, d.id)}>
                    <button type="submit" style={{ color: tokens.color.negative, fontFamily: tokens.font.body, background: 'none', border: 'none', cursor: 'pointer' }}>
                      Revoke
                    </button>
                  </ActionForm>
                ),
              },
            ]}
            rows={devices}
            keyOf={(d) => d.id}
            emptyMessage="No trusted devices."
          />
        )}
      </section>

      <section style={{ marginTop: tokens.space(8), marginBottom: tokens.space(8) }}>
        <PageHeader title="Login history" />
        {loginHistoryError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>{loginHistoryError}</div>
        )}
        {loginHistory && (
          <DataTable
            columns={[
              { header: 'Event', render: (h: LoginHistoryEvent) => <Badge tone={EVENT_TONE[h.eventType] ?? 'neutral'}>{h.eventType}</Badge> },
              { header: 'IP address', render: (h: LoginHistoryEvent) => h.ipAddress ?? '—' },
              { header: 'Device', render: (h: LoginHistoryEvent) => h.userAgent ?? '—' },
              { header: 'Reason', render: (h: LoginHistoryEvent) => h.failureReason ?? '—' },
              { header: 'When', render: (h: LoginHistoryEvent) => new Date(h.createdAt).toLocaleString() },
            ]}
            rows={loginHistory}
            keyOf={(h) => h.id}
            emptyMessage="No login events recorded yet."
          />
        )}
      </section>

      <section style={{ marginTop: tokens.space(8) }}>
        <PageHeader title="Change password" />
        <ChangePasswordForm />
      </section>
    </PageContainer>
  );
}
