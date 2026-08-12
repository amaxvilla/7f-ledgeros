import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { CreateIpRuleForm } from './CreateIpRuleForm';
import { DeactivateIpRuleButton } from './DeactivateIpRuleButton';
import { PasswordPolicyForm } from './PasswordPolicyForm';
import type { PasswordPolicyValues } from './PasswordPolicyForm';

export const dynamic = 'force-dynamic';

interface SecurityOverview {
  sinceHours: number;
  currentlyLocked: number;
  failedLogins: number;
  lockoutEvents: number;
}

interface MfaAdoptionOverview {
  totalActiveUsers: number;
  mfaEnabledUsers: number;
  adoptionRatePercent: number;
}

interface SessionSecurityOverview {
  activeSessions: number;
}

interface IpRestrictionOverview {
  activeGlobalRules: number;
  activeUserRules: number;
  totalRules: number;
}

interface IpRule {
  id: string;
  scope: string;
  userId: string | null;
  cidr: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
}

interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface PasswordPolicy {
  id: string;
  entityId: string | null;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays: number | null;
  historyCount: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Mirrors `PasswordPolicyService`'s own private `defaultPolicy()`
 * exactly (re-read directly, not assumed) — used only to pre-fill
 * `PasswordPolicyForm` when `GET /security/password-policy` returns no
 * global (`entityId: null`) row yet. There is no "get effective
 * policy" admin endpoint (`getEffectivePolicy` is internal-only, used
 * by `changePassword`, never exposed on `SecurityHardeningController`)
 * — this mirror is the only way to show the actually-in-effect values
 * before an admin has ever saved a policy row.
 */
const DEFAULT_PASSWORD_POLICY: PasswordPolicyValues = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
  expiryDays: null,
  historyCount: 5,
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
};

async function loadSecurity() {
  const [security, mfa, sessions, ipRestrictions, ipRules, users, passwordPolicies] = await Promise.all([
    fetchApi<SecurityOverview>('/dashboard/security-overview'),
    fetchApi<MfaAdoptionOverview>('/dashboard/mfa-adoption-overview'),
    fetchApi<SessionSecurityOverview>('/dashboard/session-security-overview'),
    fetchApi<IpRestrictionOverview>('/dashboard/ip-restriction-overview'),
    fetchApi<IpRule[]>('/security/ip-rules'),
    fetchApi<UserSummary[]>('/users'),
    fetchApi<PasswordPolicy[]>('/security/password-policy'),
  ]);
  const userLabelById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName} — ${u.email}`]));
  const globalPolicy = passwordPolicies.find((p) => p.entityId === null);
  const currentPasswordPolicy: PasswordPolicyValues = globalPolicy
    ? {
        minLength: globalPolicy.minLength,
        requireUppercase: globalPolicy.requireUppercase,
        requireLowercase: globalPolicy.requireLowercase,
        requireNumber: globalPolicy.requireNumber,
        requireSymbol: globalPolicy.requireSymbol,
        expiryDays: globalPolicy.expiryDays,
        historyCount: globalPolicy.historyCount,
        maxFailedLoginAttempts: globalPolicy.maxFailedLoginAttempts,
        lockoutDurationMinutes: globalPolicy.lockoutDurationMinutes,
      }
    : DEFAULT_PASSWORD_POLICY;
  return { security, mfa, sessions, ipRestrictions, ipRules, userLabelById, passwordPolicies, currentPasswordPolicy };
}

/**
 * Frontend Completion, Checkpoint D — the fourth Module Page (after the
 * finance dashboard at `/`, Recruitment, and Payments), and the fourth
 * link in AppShell's own nav. Security was picked over a fifth
 * entity-scoped domain specifically because it's system-wide rather
 * than per-entity: `security-overview`/`mfa-adoption-overview`/
 * `session-security-overview`/`ip-restriction-overview` (Releases K/M/
 * N/P) take no `entityId` at all, unlike every endpoint the three
 * existing pages consume — see dashboard.controller.ts's own four
 * routes. That's a genuine structural difference this page leans into
 * rather than papers over: NO EntitySelector here, and no "enter an
 * entity ID" empty state — the page always has something to show.
 *
 * Also structurally different from Recruitment/Payments in a second
 * way: none of the four aggregates above back a list endpoint the way
 * `GET /payments` or `GET /recruitment/vacancies` do, so the KPI/badge
 * sections stay list-free — just KPIs and Badge clusters. (This was
 * true of the whole page at Checkpoint D; Security.2's own ADDENDUM
 * below added the one DataTable this page now has, for IP rules
 * specifically — `GET /security/ip-rules` is a real list endpoint the
 * other four aggregates never had.)
 *
 * `security-overview`'s own `sinceHours` param is left at its
 * server-side default (24) rather than exposed as a control here —
 * same "don't build ahead of what's needed" discipline this app's
 * earlier checkpoints have followed; a time-range picker is a
 * reasonable future addition once this page has a reason to need one.
 *
 * CreateIpRuleForm added as this app's seventh data-entry form — see
 * that component's own doc comment. Rendered inside the existing "IP
 * restriction rules" section below, the first form in this app added
 * to a page without also being the reason that page's own module gap
 * was closed (Security already existed as a page since Checkpoint D).
 *
 * ADDENDUM (Security.2) — the register half of "IP restriction rules"
 * this section was missing (aggregate counts + create form only, no
 * way to see or deactivate an individual rule) is built now:
 * `GET /security/ip-rules` (no filters passed — every rule, active or
 * not, see `actions.ts`'s own `deactivateIpRule` doc comment for why)
 * and `GET /users` (folded into the same `Promise.all`, resolving each
 * rule's own `userId` to a real name/email via `userLabelById` rather
 * than a raw id) are both new fetches here. `DeactivateIpRuleButton`
 * handles the one row action. Also corrects a real, checked error in
 * Users.3's own report, which described IP Restrictions as "entirely
 * unbuilt" — creation already existed; only this register half didn't.
 *
 * ADDENDUM (Security.3) — Password Policy. `GET /security/password-policy`
 * (folded into the same `Promise.all`) returns EVERY policy row,
 * global and per-entity alike; `currentPasswordPolicy` here picks out
 * the one with `entityId === null` (falling back to
 * `DEFAULT_PASSWORD_POLICY`, a direct mirror of the backend's own
 * `defaultPolicy()`, when no row has been saved yet) and passes it to
 * `PasswordPolicyForm` — see that component's and `actions.ts`'s own
 * doc comments for why this form is scoped to the global policy only.
 * A small read-only table below the form still lists every row
 * `findPolicies()` returns, including any per-entity ones, so that data
 * isn't hidden even though it isn't editable from here.
 */
export default async function SecurityPage() {
  let data: Awaited<ReturnType<typeof loadSecurity>> | null = null;
  let error: string | null = null;
  try {
    data = await loadSecurity();
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Failed to load security data.';
  }

  return (
    <PageContainer>
      <PageHeader title="Security" subtitle="System-wide — not scoped to a single entity" />

      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: tokens.space(4),
              marginBottom: tokens.space(8),
            }}
          >
            <KpiCard
              label="Currently locked accounts"
              value={String(data.security.currentlyLocked)}
              tone={data.security.currentlyLocked > 0 ? 'negative' : 'positive'}
            />
            <KpiCard
              label="Failed logins"
              value={String(data.security.failedLogins)}
              tone={data.security.failedLogins > 0 ? 'warning' : 'positive'}
              caption={`last ${data.security.sinceHours}h`}
            />
            <KpiCard label="MFA adoption" value={`${data.mfa.adoptionRatePercent}%`} tone={data.mfa.adoptionRatePercent >= 80 ? 'positive' : 'warning'} caption={`${data.mfa.mfaEnabledUsers} of ${data.mfa.totalActiveUsers} users`} />
            <KpiCard label="Active sessions" value={String(data.sessions.activeSessions)} />
          </section>

          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Lockout activity" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3) }}>
              <Badge tone={data.security.lockoutEvents > 0 ? 'negative' : 'positive'}>
                Lockout events: {data.security.lockoutEvents}
              </Badge>
              <Badge tone="neutral">Window: last {data.security.sinceHours}h</Badge>
            </div>
          </section>

          <section>
            <PageHeader title="IP restriction rules" />
            <CreateIpRuleForm />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), marginBottom: tokens.space(4) }}>
              {data.ipRestrictions.totalRules === 0 ? (
                <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                  No IP restriction rules configured.
                </span>
              ) : (
                <>
                  <Badge tone="neutral">Global rules: {data.ipRestrictions.activeGlobalRules}</Badge>
                  <Badge tone="neutral">User-scoped rules: {data.ipRestrictions.activeUserRules}</Badge>
                  <Badge tone="neutral">Total configured: {data.ipRestrictions.totalRules}</Badge>
                </>
              )}
            </div>
            <DataTable
              columns={[
                { header: 'Scope', render: (r: IpRule) => <Badge tone={r.scope === 'GLOBAL' ? 'neutral' : 'warning'}>{r.scope}</Badge> },
                { header: 'User', render: (r: IpRule) => (r.userId ? (data!.userLabelById.get(r.userId) ?? r.userId) : '—') },
                { header: 'CIDR', render: (r: IpRule) => r.cidr },
                { header: 'Label', render: (r: IpRule) => r.label ?? '—' },
                { header: 'Status', render: (r: IpRule) => <Badge tone={r.isActive ? 'positive' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
                { header: 'Created', render: (r: IpRule) => new Date(r.createdAt).toLocaleDateString() },
                { header: 'Actions', align: 'right', render: (r: IpRule) => <DeactivateIpRuleButton id={r.id} isActive={r.isActive} /> },
              ]}
              rows={data.ipRules}
              keyOf={(r) => r.id}
              emptyMessage="No IP restriction rules configured."
            />
          </section>

          <section>
            <PageHeader title="Password policy" subtitle="Applies globally — enforced at login and password change" />
            <PasswordPolicyForm current={data.currentPasswordPolicy} />
            {data.passwordPolicies.length > 0 && (
              <DataTable
                columns={[
                  { header: 'Scope', render: (p: PasswordPolicy) => <Badge tone={p.entityId === null ? 'neutral' : 'warning'}>{p.entityId === null ? 'GLOBAL' : 'ENTITY'}</Badge> },
                  { header: 'Min length', render: (p: PasswordPolicy) => String(p.minLength) },
                  { header: 'Expiry', render: (p: PasswordPolicy) => (p.expiryDays ? `${p.expiryDays} days` : 'Never') },
                  { header: 'History', render: (p: PasswordPolicy) => String(p.historyCount) },
                  { header: 'Lockout', render: (p: PasswordPolicy) => `${p.maxFailedLoginAttempts} attempts / ${p.lockoutDurationMinutes}m` },
                  { header: 'Updated', render: (p: PasswordPolicy) => new Date(p.updatedAt).toLocaleDateString() },
                ]}
                rows={data.passwordPolicies}
                keyOf={(p) => p.id}
                emptyMessage="No password policy configured yet — defaults are in effect."
              />
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
