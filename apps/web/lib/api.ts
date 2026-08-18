import { cookies } from 'next/headers';

const API_URL =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

// Server-only bearer token for this dashboard's own service account.
// Never exposed to the client — only read inside Server Components /
// route handlers, which run on the server in the Next.js app router.
// Checkpoint AJ: now a FALLBACK, not the only source — see fetchApi's
// own doc comment below.
const SERVICE_TOKEN = process.env.API_SERVICE_TOKEN;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Frontend Completion, Checkpoint AJ — the accessToken cookie login()
 * (Checkpoint AI, app/login/actions.ts) started writing is now actually
 * read here, rather than sitting unused. `cookies().get('accessToken')`
 * is checked first; only when it's absent (no one has logged in yet
 * this session, or the cookie expired) does this fall back to
 * `SERVICE_TOKEN`, exactly as Checkpoint AI's own release report scoped
 * this next slice — every page keeps working unauthenticated during
 * this transition, same as before this checkpoint.
 *
 * `cookies()` is safe to call here because every page that calls
 * fetchApi already opts into `export const dynamic = 'force-dynamic'`
 * (verified directly against every `app/*\/page.tsx` before making this
 * change, not assumed) — this function never runs outside a live
 * request's scope, where `cookies()` would throw.
 *
 * Deliberately NOT doing here: refresh-on-expiry (a request made with
 * an expired accessToken still just gets whatever 401 the backend
 * returns — JwtStrategy's own `ignoreExpiration: false` — surfaced as
 * an ApiError like any other failure, not silently retried against
 * `POST /auth/refresh`), and no logged-in/logged-out indicator in
 * AppShell. Both remain open, named in this checkpoint's own release
 * report rather than guessed at here.
 */
export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const userToken = cookies().get('accessToken')?.value;
  const bearerToken = userToken || SERVICE_TOKEN;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      ...init?.headers,
    },
    // Dashboard data changes frequently; don't let Next cache stale KPIs.
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}
