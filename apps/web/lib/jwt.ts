/**
 * Frontend Completion, FE-1.2 — User Profile (header indicator).
 *
 * Decodes an access token's payload for DISPLAY ONLY (the email shown
 * next to "Log out") — never for authorization or validity checking.
 * `AuthService.login`'s own JWT payload is `{ sub: userId, email }`
 * (confirmed by reading `auth.service.ts` directly before writing this,
 * not assumed) — no name or roles are embedded in it, so this can only
 * ever surface an email, not a full profile. A real "My Profile" page
 * (name, roles, avatar) would need a new backend endpoint (no existing
 * route returns basic account info independent of HR Employee linkage —
 * `GET /hr/me/profile` only works for users who also have an `Employee`
 * row, confirmed by reading `self-service.controller.ts`/`self-service.
 * service.ts`, which not every account has) — out of scope for this
 * checkpoint's own "smallest, backend-free" scoping, same discipline
 * FE-1.1 used to defer Sidebar.
 *
 * Deliberately does NOT verify the signature — this only ever runs
 * against a cookie this same server already trusts enough to send as a
 * bearer token on every `fetchApi` call (see that module's own doc
 * comment); a forged or expired token here would just show a wrong (or
 * no) email, not grant any access `JwtStrategy`'s own real verification
 * doesn't already gate. Returns `null` on any decode failure — this
 * function has no user-facing error path of its own; a missing email is
 * just a slightly emptier header, not a broken page.
 */
export function decodeAccessTokenEmail(accessToken: string): string | null {
  try {
    const payloadSegment = accessToken.split('.')[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as { email?: unknown };
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}
