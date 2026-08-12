'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface CreateIpRuleFormState {
  ok: boolean;
  error?: string;
}

/**
 * Seventh Server Action in this app, same reasoning as every prior
 * create action (tenants/actions.ts, crm/actions.ts, tax/actions.ts,
 * fixed-assets/actions.ts, lease-management/actions.ts,
 * facility-management/actions.ts).
 *
 * `POST /security/ip-rules` requires `security.access.manage` — this
 * page's shared service-account token already carries whatever
 * permissions it carries (see this app's own "one shared token, not
 * per-user auth" standing limitation); a 403 from a token lacking that
 * permission surfaces through fetchApi's own ApiError the same way any
 * other permission failure would.
 *
 * `userId` is only meaningful when `scope === 'USER'` —
 * IpRestrictionService.createRule() itself enforces that pairing
 * server-side (see CreateIpRuleDto's own comment), so this action just
 * passes `userId` through as-is rather than duplicating that
 * validation on the frontend.
 */
export async function createIpRule(input: {
  scope: string;
  cidr: string;
  userId?: string;
  label?: string;
}): Promise<CreateIpRuleFormState> {
  try {
    await fetchApi('/security/ip-rules', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create IP restriction rule.' };
  }

  revalidatePath('/security');
  return { ok: true };
}

export interface IpRuleActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, Security.2 — the list half of this section this
 * app's own history hadn't built yet: `page.tsx` previously only
 * showed aggregate counts (`GET /dashboard/ip-restriction-overview`)
 * plus `CreateIpRuleForm`, with no way to see or deactivate an
 * individual rule. Corrects a real error in Users.3's own report,
 * which claimed IP Restrictions were "entirely unbuilt" — re-checked
 * directly this checkpoint and found that claim stale: creation already
 * existed (`createIpRule` above), only the register/deactivate half was
 * actually missing.
 *
 * `DELETE /security/ip-rules/:id` (`IpRestrictionService.deactivateRule`,
 * confirmed directly) is a SOFT delete — sets `isActive: false`, the
 * row itself is never removed — so `listIpRules` (below, in `page.tsx`)
 * deliberately does NOT filter to active-only: every existing register
 * in this app that has a soft-delete/close/cancel concept
 * (BOQ/WorkPackage status, Risk/Issue status, Real Estate allocation
 * events) shows every row with a status `Badge`, not hides the inactive
 * ones, and this follows that same convention rather than inventing a
 * hide-when-inactive rule for just this one register.
 */
export async function deactivateIpRule(id: string): Promise<IpRuleActionState> {
  try {
    await fetchApi(`/security/ip-rules/${id}`, { method: 'DELETE' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to deactivate IP restriction rule.' };
  }

  revalidatePath('/security');
  return { ok: true };
}

export interface PasswordPolicyActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, Security.3 — Password Policy, Security.2's own
 * recommended next checkpoint (picked over API Keys — both were
 * investigated directly; Password Policy is the smaller, and a
 * genuinely different shape from this app's many register-style
 * checkpoints, a single settings object rather than a create+list+
 * action resource).
 *
 * `UpsertAuthSecurityPolicyDto` (read directly) has EVERY field
 * optional, including `entityId` — confirmed directly in
 * `PasswordPolicyService.upsertPolicy` that `entityId` defaults to
 * `null` (the GLOBAL policy) when omitted, and that a missing/omitted
 * value for any other field is left `undefined` in the Prisma
 * `update`/`create` call, which Prisma treats as "not provided" (falls
 * back to the column's own schema `@default` on create, leaves the
 * existing value untouched on update) — confirmed directly against
 * `schema.prisma`'s own `AuthSecurityPolicy` model, every numeric/
 * boolean column has a `@default`.
 *
 * This action — and `PasswordPolicyForm.tsx` — deliberately scope to
 * the GLOBAL policy only (`entityId` never sent, always the implicit
 * `null` case): confirmed directly in `PasswordPolicyService`'s own
 * doc comment that per-entity policies, while creatable via this same
 * DTO, are NOT YET resolved anywhere at authentication/change-password
 * time ("AuthService has no entity context at authentication time" —
 * a stated, known Release K limitation, not a frontend gap to work
 * around). Building a per-entity policy editor would be building UI for
 * a setting the backend doesn't actually enforce yet — deliberately not
 * attempted. `page.tsx`'s own read-only policy list still shows every
 * row `GET /security/password-policy` (`findPolicies()`) returns,
 * including any per-entity ones that already exist, so none of that
 * data is hidden — just not editable from this form.
 *
 * No client-side default-filling for the numeric fields beyond what
 * the HTML `number` input itself does — `minLength`'s own `@Min(6)`
 * and the other `@Min` constraints are server-validated, surfaced
 * through the same "let the backend validate, show its error" posture
 * this app takes throughout.
 */
export async function savePasswordPolicy(input: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays?: number;
  historyCount: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}): Promise<PasswordPolicyActionState> {
  try {
    await fetchApi('/security/password-policy', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to save password policy.' };
  }

  revalidatePath('/security');
  return { ok: true };
}
