import { NextRequest, NextResponse } from 'next/server';

const API_URL =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

/**
 * Frontend Completion, Checkpoint AN — refresh-on-expiry, the first of
 * the two gaps Checkpoint AM's own release report named as still open
 * in the Authentication UI arc (the other, a field-level edit form, is
 * unrelated to auth and deliberately left for a separate checkpoint).
 *
 * `lib/api.ts`'s `fetchApi` and `layout.tsx`'s `isLoggedIn` check both
 * already read the `accessToken` cookie (Checkpoints AJ/AK) but neither
 * can fix an expired one themselves: `fetchApi` runs inside Server
 * Component page renders, and `cookies().set(...)` can only be called
 * from a Server Action or Route Handler in the App Router — calling it
 * mid-render throws. Next.js middleware is the one place in this app
 * that both runs before every Server Component render AND is allowed to
 * mutate cookies, which is why the fix lives here rather than in
 * `fetchApi` itself (a retry-after-401 approach was considered and
 * rejected for the same reason: by the time `fetchApi` sees a 401,
 * there's no legal way for it to persist the refreshed cookie).
 *
 * Expiry is checked locally by decoding the access token's own `exp`
 * claim (the same JWT `AuthService.issueTokens`, auth.service.ts,
 * signs with `expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m'`)
 * rather than making a network round-trip just to find out — this
 * middleware runs on every matched request, so it deliberately does
 * nothing (one cheap local decode, no fetch) on the overwhelmingly
 * common case of a still-valid or altogether absent token.
 *
 * Deliberately NOT verifying the token's signature here — that's
 * `JwtStrategy`'s job on the actual API request this cookie will next
 * be sent with; a forged-but-unexpired token still gets rejected
 * server-side exactly as it did before this checkpoint, and a token
 * this can't even parse is treated as "not expired" (left alone,
 * falling through to the pre-existing 401 behavior) rather than guessed
 * at.
 *
 * Only ONE refresh is attempted per request, and only when BOTH cookies
 * are present and the access token specifically has expired — a missing
 * accessToken with no refreshToken either (never logged in) is
 * untouched, same as a refreshToken that itself turns out to be
 * invalid/revoked (POST /auth/refresh's own 401): both fall through
 * with cookies cleared, the same fail-open-to-logged-out bias
 * `logout()` (app/login/actions.ts) already documents for exactly this
 * reason — staying logged out is the safe default, unlike login.
 */
export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;

  if (!accessToken || !refreshToken || !isExpired(accessToken)) {
    return NextResponse.next();
  }

  let data: RefreshResponse;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Stored refresh token is invalid, expired, or already revoked —
      // clear both cookies so `layout.tsx`'s isLoggedIn check and every
      // page's fetchApi call stop sending a token that can never work
      // again, rather than repeating this same failed refresh attempt
      // on every subsequent request until the cookie's own maxAge runs
      // out.
      const cleared = NextResponse.next();
      cleared.cookies.delete('accessToken');
      cleared.cookies.delete('refreshToken');
      return cleared;
    }

    data = await res.json();
  } catch {
    // Network failure reaching the backend itself (not a token problem)
    // — leave both cookies untouched and let the request proceed;
    // fetchApi surfaces whatever the backend actually returns, same as
    // before this checkpoint existed.
    return NextResponse.next();
  }

  // Mutate the request's own cookie jar too, not just the response's —
  // NextResponse.next({ request }) is what forwards a mutated request
  // downstream, so the Server Component this request is about to render
  // sees the fresh accessToken via next/headers's cookies() on THIS
  // request, rather than one request later.
  request.cookies.set('accessToken', data.accessToken);
  request.cookies.set('refreshToken', data.refreshToken);
  const response = NextResponse.next({ request });

  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set('accessToken', data.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: data.expiresIn ?? 900,
  });
  // Refresh tokens rotate server-side on every use (AuthService.refresh
  // revokes the outgoing one and issues a replacement) — the old cookie
  // value is now dead on the backend regardless of what happens here, so
  // it must always be overwritten with the new one, never left as-is.
  response.cookies.set('refreshToken', data.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

function isExpired(accessToken: string): boolean {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

export const config = {
  // Skip Next's own static assets — nothing under _next/* ever needs a
  // fresh accessToken cookie for itself, and running this on every one
  // of them would just be wasted work on the common path.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
