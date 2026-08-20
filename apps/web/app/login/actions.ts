'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchApi, ApiError } from '../../lib/api';

export interface LoginFormState {
  ok: boolean;
  error?: string;
  /** Checkpoint AP — set when the account has MFA enabled and a second
   * step is needed. `challengeToken` must be handed back to `verifyMfa`
   * below along with the user's TOTP/recovery code; it proves the
   * password step already succeeded and expires in 5 minutes
   * (AuthService.verifyMfaAndLogin's own doc comment). */
  mfaRequired?: boolean;
  challengeToken?: string;
}

interface LoginResponse {
  mfaRequired: boolean;
  challengeToken?: string;
  passwordExpired?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

interface VerifyMfaResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  /** Release N — only present when the caller passed rememberDevice: true. See setDeviceCookie's own comment. */
  deviceToken?: string;
}

const TRUSTED_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // Release N's own TRUSTED_DEVICE_DAYS (trusted-device.service.ts) — kept in sync deliberately, not derived from the response (verifyMfaAndLogin doesn't return an expiresAt alongside deviceToken).

/**
 * Checkpoint AQ — the trusted-device cookie itself. httpOnly for the
 * same reason accessToken/refreshToken already are (setSessionCookies
 * above) — this token is a bearer credential (checkTrustedDevice trusts
 * whoever presents it, the same way a session cookie does), not
 * something client JS has any legitimate reason to read.
 */
function setDeviceCookie(deviceToken: string): void {
  cookies().set('deviceToken', deviceToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TRUSTED_DEVICE_COOKIE_MAX_AGE,
  });
}

/**
 * Checkpoint AP — shared by `login()` and `verifyMfa()` below, both of
 * which reach a real token pair by different routes (straight through
 * on a non-MFA account, or via the challenge/verify round trip on one
 * with MFA enabled) but need to persist it identically either way. Pulled
 * out here rather than left duplicated the way it was across just
 * `login()` before this checkpoint.
 */
function setSessionCookies(accessToken: string, refreshToken: string, expiresIn?: number): void {
  const cookieStore = cookies();
  const secure = process.env.NODE_ENV === 'production';
  cookieStore.set('accessToken', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: expiresIn ?? 900,
  });
  cookieStore.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Frontend Completion, Checkpoint AI — first slice of Authentication UI.
 * Checkpoint AH's own release report flagged this as a genuinely
 * different shape of work than the additive form/field checkpoints that
 * filled most of this roadmap item, and recommended a scoping read of
 * `lib/api.ts`/`layout.tsx` before picking a first slice. That read
 * turned up a materially bigger backend than a single checkpoint could
 * front entirely: `POST /auth/login` (auth.controller.ts) can return
 * either real tokens OR `{ mfaRequired: true, challengeToken }`, and a
 * second endpoint (`POST /auth/mfa/verify`) exists to complete that
 * second case. This checkpoint deliberately handled only the first
 * (non-MFA) path — see `verifyMfa()` below (Checkpoint AP) for the
 * second, which was deferred here rather than attempted in the same
 * checkpoint as this app's very first login form.
 *
 * `fetchApi` is reused as-is, same as every other action in this app —
 * `POST /auth/login` is `@Public()` on the backend, so the service
 * account bearer token `fetchApi` already attaches is simply unused by
 * this endpoint, not a conflict with it.
 *
 * On success, `accessToken`/`refreshToken` are written to httpOnly
 * cookies via `next/headers`'s `cookies()` — this app's first use of
 * response cookies anywhere. Deliberately NOT wired into `fetchApi`'s
 * own Authorization header in this checkpoint: `JwtStrategy`
 * (jwt.strategy.ts) extracts the bearer token from the Authorization
 * header only, never from a cookie, so making a logged-in user's own
 * token actually replace `API_SERVICE_TOKEN` on subsequent requests is
 * real, separate work (deciding per-request whether a user session
 * exists, what happens when it doesn't, how `expiresIn`-driven refresh
 * is triggered) — named as follow-on work, not attempted here. The
 * `refreshToken` cookie's own `maxAge` is a 30-day ceiling chosen on
 * this end; the backend's actual `RefreshToken.expiresAt` (set server-
 * side per `AuthService.getRefreshTokenExpiryDays()`) remains the real
 * source of truth and isn't returned by this endpoint to mirror exactly.
 *
 * `redirect('/')` on success is this app's first use of `redirect()` in
 * a Server Action — every prior action instead calls `revalidatePath`
 * and lets its own form reset in place, because none of them navigate
 * the user anywhere; a successful login legitimately does. Called after
 * the try/catch (not inside it) per Next's own requirement that
 * `redirect()`'s thrown signal not be swallowed by an unrelated catch
 * clause.
 */
export async function login(input: { email: string; password: string }): Promise<LoginFormState> {
  // Checkpoint AQ — a previously-trusted device (see verifyMfa's
  // rememberDevice branch below) skips the MFA challenge entirely on
  // the backend when this is present and valid; absent or expired, this
  // is simply undefined and the request behaves exactly as it always
  // has (JSON.stringify drops an undefined property).
  const deviceToken = cookies().get('deviceToken')?.value;

  let result: LoginResponse;
  try {
    result = await fetchApi<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ ...input, deviceToken }) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Login failed.' };
  }

  if (result.mfaRequired || !result.accessToken || !result.refreshToken) {
    // Checkpoint AP — this used to be a dead-end error ("contact an
    // administrator"). challengeToken is safe to hand back to the
    // client: it's a short-lived (5m), server-signed token that only
    // proves the password step already succeeded, the same shape
    // AuthService.verifyMfaAndLogin's own doc comment describes; it
    // carries no session privileges by itself.
    return { ok: false, mfaRequired: true, challengeToken: result.challengeToken };
  }

  setSessionCookies(result.accessToken, result.refreshToken, result.expiresIn);
  return { ok: true };
}

/**
 * Checkpoint AP — completes the two-step login `login()` above has
 * handed off to since Checkpoint AI first split password verification
 * from token issuance. Calls the backend's existing `POST
 * /auth/mfa/verify` (`@Public()`, same reasoning as `login()`'s own
 * bearer-token note above — the challenge token IS the credential this
 * step needs, not a session bearer token) with the `challengeToken`
 * `login()` returned plus the user's TOTP/recovery code, then persists
 * the resulting session exactly the way `login()` does on its own
 * non-MFA success path (`setSessionCookies`, `redirect('/')`) — from
 * this point on, an MFA account and a non-MFA account end up in an
 * identical logged-in state.
 *
 * Checkpoint AQ — rememberDevice/deviceName are now wired through to
 * `VerifyMfaDto`'s own matching fields (`auth.controller.ts`), and a
 * `deviceToken` in the response is persisted via `setDeviceCookie` —
 * the follow-on work this doc comment used to defer. `deviceName` is
 * intentionally omitted from the request body for now: there's no
 * device-naming UI in this checkpoint either (a text field asking to
 * name the device is its own small addition, not assumed here) — the
 * backend already treats it as optional (`TrustedDeviceService`
 * defaults an unset name), so omitting it is a real supported case, not
 * a workaround.
 */
export async function verifyMfa(input: { challengeToken: string; token: string; rememberDevice: boolean }): Promise<LoginFormState> {
  let result: VerifyMfaResponse;
  try {
    result = await fetchApi<VerifyMfaResponse>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken: input.challengeToken, token: input.token, rememberDevice: input.rememberDevice }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Verification failed.' };
  }

  if (result.deviceToken) {
    setDeviceCookie(result.deviceToken);
  }

  setSessionCookies(result.accessToken, result.refreshToken, result.expiresIn);
  return { ok: true };
}

/**
 * Frontend Completion, Checkpoint AK — pairs with `login()` above to
 * complete the minimal "am I logged in" chrome Checkpoint AJ's release
 * report named as the next slice. Reuses the backend's existing
 * `POST /auth/logout` (`@Public()`, `auth.controller.ts`) rather than
 * just dropping the cookies locally — that endpoint revokes the stored
 * `RefreshToken` row server-side (`AuthService.logout`), so a cleared-
 * but-still-valid refresh token can't be replayed after logout.
 *
 * The backend call is best-effort: if it fails (network error, token
 * already revoked, etc.), the local cookies are still cleared and the
 * redirect still happens — a user clicking "Log out" should always end
 * up logged out of *this browser* regardless of whether the server-side
 * revoke itself succeeded, same reasoning `login()`'s own `mfaRequired`
 * branch gives for surfacing real failures rather than pretending to
 * succeed, just applied to the opposite bias (this direction, failing
 * open — staying logged out — is the safe default; failing open on
 * login would not be).
 *
 * No `LogoutFormState`/error return — `AppShell`'s own logout control
 * is a plain `<form action={logout}>` (see that component's doc
 * comment for why passing this action down as a prop, rather than
 * AppShell importing it itself, keeps that package decoupled from this
 * app's auth internals), not a form with its own pending/error UI to
 * report back to; the only two outcomes are "still logged in because
 * this action never got called" and "redirected to /login", and
 * `redirect()` already covers the second.
 */
export async function logout(): Promise<void> {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  if (refreshToken) {
    try {
      await fetchApi('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } catch {
      // Best-effort revoke — see doc comment above. Local cookies are
      // cleared and the redirect happens regardless of this outcome.
    }
  }

  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');
  redirect('/login');
}
