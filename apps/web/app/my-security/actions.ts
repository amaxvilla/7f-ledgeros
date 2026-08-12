'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface RevokeActionState {
  ok: boolean;
  error?: string;
}

export interface BeginMfaEnrollmentState {
  ok: boolean;
  /** True specifically for the "MFA is already enabled" case (MfaService.beginEnrollment's own ConflictException) — distinguished from a generic failure so the form can show "already enabled" rather than a raw error string. */
  alreadyEnabled?: boolean;
  secret?: string;
  qrCodeDataUrl?: string;
  error?: string;
}

export interface ConfirmMfaEnrollmentState {
  ok: boolean;
  recoveryCodes?: string[];
  error?: string;
}

/**
 * First half of the MFA enrollment gap this page's own doc comment
 * named as deliberately deferred ("a materially different, bigger
 * piece of UI than a list-plus-revoke page"). Calls
 * `POST /security/mfa/enroll` (MfaService.beginEnrollment), which
 * generates a new TOTP secret, persists it UNCONFIRMED
 * (`mfaEnabled` stays false until confirmMfaEnrollment below), and
 * returns a ready-to-render QR code as a data: URL — no client-side QR
 * library needed, the backend already did that work.
 *
 * There is no `/users/me` or `/auth/me` endpoint in this backend to
 * check `mfaEnabled` BEFORE offering this button — confirmed by
 * grepping the whole API surface before writing this, not assumed. So
 * this action is the check: MfaService.beginEnrollment itself throws a
 * ConflictException when MFA is already on, and that's translated to
 * `alreadyEnabled: true` here rather than surfaced as a generic error,
 * letting the form show "MFA is already enabled" instead of "MFA is
 * already enabled" wrapped in scarier error-red styling.
 */
export async function beginMfaEnrollment(): Promise<BeginMfaEnrollmentState> {
  try {
    const result = await fetchApi<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }>('/security/mfa/enroll', { method: 'POST' });
    return { ok: true, secret: result.secret, qrCodeDataUrl: result.qrCodeDataUrl };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { ok: false, alreadyEnabled: true };
    }
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to start MFA enrollment.' };
  }
}

/**
 * Second half — the user's first live TOTP code, proving they actually
 * scanned the QR code (or copied the secret) into a real authenticator
 * app, not just that beginMfaEnrollment succeeded. On success,
 * MfaService.confirmEnrollment flips `mfaEnabled` on server-side AND
 * returns freshly-generated recovery codes IN PLAINTEXT, exactly once
 * (only their hashes are ever persisted — MfaService's own doc
 * comment). This action passes them straight through; EnrollMfaForm's
 * own doc comment covers why they're never sent anywhere else (no
 * revalidatePath call needed here either — nothing on this page
 * currently reflects `mfaEnabled` status, since there's no `/me`
 * endpoint to have rendered it from in the first place).
 */
export async function confirmMfaEnrollment(token: string): Promise<ConfirmMfaEnrollmentState> {
  try {
    const result = await fetchApi<{ recoveryCodes: string[] }>('/security/mfa/enroll/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return { ok: true, recoveryCodes: result.recoveryCodes };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Invalid or expired code.' };
  }
}

/**
 * Frontend Completion — first checkpoint on the self-service security
 * surface (`/security/sessions/me`, `/security/devices/me`) that's
 * existed on the backend since Release Security-Hardening but never had
 * a page. Deliberately relies on the same accessToken-cookie-first
 * fetchApi Checkpoint AJ already wired — no new auth plumbing needed,
 * confirmed before starting rather than assumed (see this checkpoint's
 * own release report).
 *
 * revokeSession/revokeDevice both mirror facility-management/actions.ts's
 * createMaintenanceRequest shape (try/fetchApi/catch-ApiError,
 * revalidatePath on success) — the same Server Action pattern every
 * mutation in this app has used since tenants/actions.ts's createTenant,
 * just DELETE instead of POST.
 */
export async function revokeSession(sessionId: string): Promise<RevokeActionState> {
  try {
    await fetchApi(`/security/sessions/me/${sessionId}`, { method: 'DELETE' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke session.' };
  }
  revalidatePath('/my-security');
  return { ok: true };
}

export async function revokeDevice(deviceId: string): Promise<RevokeActionState> {
  try {
    await fetchApi(`/security/devices/me/${deviceId}`, { method: 'DELETE' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke device.' };
  }
  revalidatePath('/my-security');
  return { ok: true };
}

/**
 * Frontend Completion — the "device naming" gap named in this page's
 * own doc comment as blocked on a backend endpoint that didn't exist
 * yet (`PATCH /security/devices/me/:deviceId`, TrustedDeviceService.
 * renameDevice — confirmed present by reading the service before
 * wiring this, not assumed).
 *
 * Bound with BOTH a device id AND a FormData argument
 * (`renameDevice.bind(null, d.id)`) — every other action on this page
 * takes one or the other (revokeSession/revokeDevice take only a bound
 * id, no form fields; revokeOtherSessions takes no arguments at all),
 * so this is the first per-row action on this page that also needs a
 * real form field. Next.js Server Actions support this directly: a
 * bound argument list followed by the trailing FormData the form
 * submission itself provides, no new pattern beyond what `.bind`
 * already does in JS.
 */
export async function renameDevice(deviceId: string, formData: FormData): Promise<RevokeActionState> {
  const deviceName = formData.get('deviceName');
  if (typeof deviceName !== 'string' || deviceName.trim().length === 0) {
    return { ok: false, error: 'Enter a device name.' };
  }

  try {
    await fetchApi(`/security/devices/me/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ deviceName: deviceName.trim() }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to rename device.' };
  }
  revalidatePath('/my-security');
  return { ok: true };
}

export interface ChangePasswordState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Login History + Change Password, the last two
 * self-service gaps on this page's own security-hardening.controller.ts
 * surface: `POST /security/change-password` (PasswordPolicyService.
 * changePassword) and `GET /security/login-history/me`
 * (LoginHistoryService.findForUser) — both confirmed present and
 * unconsumed by re-reading the controller directly before starting,
 * same discipline every prior addendum on this page has followed.
 *
 * `changePassword` surfaces PasswordPolicyService's own three failure
 * modes (wrong current password, complexity policy violation, password
 * reuse against `historyCount` prior hashes) as plain `ApiError`
 * messages rather than distinguishing them the way `beginMfaEnrollment`
 * distinguishes its one "already enabled" case — there's no single
 * "expected, non-scary" outcome here the way "MFA already enabled" was;
 * all three are genuine rejections the user needs to read and act on.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordState> {
  try {
    await fetchApi('/security/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to change password.' };
  }
  return { ok: true };
}

/**
 * The gap this page's own doc comment named as deliberately deferred:
 * `POST /security/sessions/me/revoke-others` (security-hardening.controller.ts)
 * needs the CALLER's own current refresh token to identify (and
 * exclude) the session making the request — same
 * `currentRefreshToken`-in-body convention `/auth/logout` already uses,
 * not a new pattern. That token lives in the httpOnly `refreshToken`
 * cookie `login()`/`verifyMfa()` (app/login/actions.ts) already set —
 * read here via `next/headers`'s `cookies()`, the same server-only
 * access `logout()` itself uses for the identical cookie.
 *
 * If the cookie is somehow absent (shouldn't happen — this action only
 * renders on a page a logged-in session can even reach), this returns a
 * clear error rather than calling the backend with an empty string,
 * which the DTO's own `@IsString()` would reject anyway with a less
 * useful message.
 */
export async function revokeOtherSessions(): Promise<RevokeActionState> {
  const currentRefreshToken = cookies().get('refreshToken')?.value;
  if (!currentRefreshToken) {
    return { ok: false, error: 'No active session found.' };
  }

  try {
    await fetchApi('/security/sessions/me/revoke-others', {
      method: 'POST',
      body: JSON.stringify({ currentRefreshToken }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revoke other sessions.' };
  }
  revalidatePath('/my-security');
  return { ok: true };
}
