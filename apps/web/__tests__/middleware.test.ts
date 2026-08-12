// @vitest-environment node
//
// middleware.ts has no DOM dependency at all, and NextResponse.next({
// request }) (used on the refresh-success path) does a strict
// `instanceof Headers` check internally against Next's own Request/
// Headers classes — under the package-wide jsdom environment those are
// a different realm than jsdom's own Headers, so the same construction
// that works in a real Next.js server (or under Node) fails here with
// an unrelated-looking error. Overriding just this file's environment
// avoids that mismatch without changing the jsdom default every other
// test in this package still needs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Builds a JWT-shaped string with a real base64-encoded payload —
// middleware.ts's own isExpired() only ever reads the payload segment,
// never verifies the signature (that's JwtStrategy's job on the actual
// API request), so the header/signature segments are arbitrary.
function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.sig`;
}

function requestWithCookies(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const headers = new Headers();
  if (cookieHeader) headers.set('cookie', cookieHeader);
  // NextResponse.next({ request }) (used on the refresh-success path)
  // requires request.headers to be a real Headers instance — the plain
  // object form NextRequest's own constructor otherwise accepts isn't
  // enough for that call specifically, even though it's fine everywhere
  // else NextRequest is used.
  return new NextRequest('https://app.example.com/', { headers });
}

describe('middleware — cases that skip refresh entirely', () => {
  it('does nothing when there is no accessToken cookie at all', async () => {
    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({}));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get('accessToken')).toBeUndefined();
  });

  it('does nothing when the accessToken is present but not expired', async () => {
    const accessToken = makeToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 900 });
    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken, refreshToken: 'rt-1' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get('accessToken')).toBeUndefined();
  });

  it('does nothing when the accessToken has expired but there is no refreshToken to use', async () => {
    const accessToken = makeToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 });
    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an unparseable token as not-expired rather than throwing', async () => {
    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken: 'not-a-jwt', refreshToken: 'rt-1' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get('accessToken')).toBeUndefined();
  });
});

describe('middleware — silent refresh', () => {
  it('calls POST /auth/refresh with the refreshToken and sets fresh cookies on success', async () => {
    const accessToken = makeToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 }),
    });

    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken, refreshToken: 'old-refresh' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/refresh');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'old-refresh' });

    expect(response.cookies.get('accessToken')?.value).toBe('new-access');
    expect(response.cookies.get('refreshToken')?.value).toBe('new-refresh');
  });

  it('always overwrites the refreshToken cookie with the rotated value, never reusing the old one', async () => {
    const accessToken = makeToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'new-access', refreshToken: 'rotated-refresh' }),
    });

    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken, refreshToken: 'old-refresh' }));

    expect(response.cookies.get('refreshToken')?.value).toBe('rotated-refresh');
  });

  it('clears both cookies when the backend rejects the refresh token', async () => {
    const accessToken = makeToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 });
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken, refreshToken: 'revoked-refresh' }));

    // NextResponse's cookies.delete() sets an empty value with an
    // immediate expiry rather than removing the Set-Cookie header —
    // asserting the value is empty is the correct way to check this.
    expect(response.cookies.get('accessToken')?.value).toBe('');
    expect(response.cookies.get('refreshToken')?.value).toBe('');
  });

  it('leaves cookies untouched when the refresh request itself fails (network error)', async () => {
    const accessToken = makeToken({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 });
    fetchMock.mockRejectedValue(new Error('fetch failed'));

    const { middleware } = await import('../middleware');
    const response = await middleware(requestWithCookies({ accessToken, refreshToken: 'some-refresh' }));

    expect(response.cookies.get('accessToken')).toBeUndefined();
    expect(response.cookies.get('refreshToken')).toBeUndefined();
  });
});
