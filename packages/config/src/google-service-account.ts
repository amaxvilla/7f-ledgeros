/**
 * Release IH — Google Workspace, Checkpoint F: Google service-account
 * JWT-bearer token acquisition (domain-wide delegation).
 *
 * Prerequisite flagged by workspace-admin-provider.interface.ts's own
 * Architectural Gap note: Google's Admin SDK Directory API — the only
 * way a future GoogleWorkspaceAdminProvider can provision/suspend/list
 * OTHER users in a Workspace domain — requires domain-wide delegation,
 * which needs a service-account JSON key (clientEmail + RSA private
 * key) signing its own JWT assertion, not the refresh-token flow
 * acquireGoogleAccessToken (google.ts) uses for every other Google
 * integration in this codebase (Gmail, Calendar, Contacts all act as
 * one already-consenting end user; domain-wide delegation impersonates
 * an arbitrary user via `sub` instead).
 *
 * This checkpoint is deliberately scoped to ONLY the token-acquisition
 * primitive — same reasoning workspace-admin-provider.interface.ts gave
 * for why a concrete GoogleWorkspaceAdminProvider isn't a same-shaped
 * follow-on the way GoogleContactsProvider was to GoogleCalendarProvider.
 * Nothing calls this yet; WorkspaceAdminProviderRegistry stays empty
 * until a later checkpoint builds the concrete provider on top of this.
 *
 * Lives here, not in apps/api or apps/worker, for the identical
 * cross-app reason acquireGoogleAccessToken/acquireMicrosoftGraphToken
 * do (see their own doc comments): whichever app ends up owning the
 * concrete provider — and, per the interface's own note, a future
 * Microsoft Entra ID/Graph Users API equivalent could reuse the RS256
 * JWT-assertion shape too, just against a different token endpoint and
 * claim set — needs the identical call, not a duplicated one.
 *
 * Signs the JWT itself with Node's built-in `crypto` (RS256) rather
 * than adding google-auth-library, matching every other Google/
 * Microsoft token helper in this package: one HTTPS POST with a
 * well-known response shape, at the cost of implementing RFC 7519's
 * compact serialization by hand instead of importing it.
 */

import { createSign } from 'crypto';

export interface GoogleServiceAccountCredentials {
  /** The service account's client_email, from its downloaded JSON key. */
  clientEmail: string;
  /** The service account's private_key (PEM, including headers/newlines), from its downloaded JSON key. */
  privateKey: string;
}

export interface AcquireGoogleServiceAccountTokenOptions {
  /** OAuth scopes to request, e.g. ['https://www.googleapis.com/auth/admin.directory.user']. */
  scopes: string[];
  /**
   * The Workspace user to impersonate (the JWT's `sub` claim) — domain-wide
   * delegation requires this; omitting it produces a token scoped to the
   * service account's own (non-Workspace) identity, which the Directory
   * API will reject. Almost always required in practice; left optional
   * only because the JWT-bearer grant itself doesn't strictly require it.
   */
  impersonatedUserEmail?: string;
  /** Overrides the token endpoint. Defaults to Google's, exposed for testing. */
  tokenUri?: string;
  /** Overrides the assertion lifetime in seconds. Defaults to 3600 (Google's own maximum). */
  expiresInSeconds?: number;
}

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Builds and RS256-signs the JWT assertion (RFC 7523 sec. 3). Exported for testability, not meant as a public entry point. */
export function buildGoogleServiceAccountAssertion(
  credentials: GoogleServiceAccountCredentials,
  options: AcquireGoogleServiceAccountTokenOptions,
): string {
  const tokenUri = options.tokenUri ?? DEFAULT_TOKEN_URI;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims: Record<string, unknown> = {
    iss: credentials.clientEmail,
    scope: options.scopes.join(' '),
    aud: tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + (options.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS),
  };
  if (options.impersonatedUserEmail) {
    claims.sub = options.impersonatedUserEmail;
  }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64url(signer.sign(credentials.privateKey));
  return `${signingInput}.${signature}`;
}

/**
 * Exchanges a service-account JWT assertion for an access token via the
 * `urn:ietf:params:oauth:grant-type:jwt-bearer` grant (RFC 7523 sec. 4).
 */
export async function acquireGoogleServiceAccountAccessToken(
  credentials: GoogleServiceAccountCredentials,
  options: AcquireGoogleServiceAccountTokenOptions,
): Promise<string> {
  const tokenUri = options.tokenUri ?? DEFAULT_TOKEN_URI;
  const assertion = buildGoogleServiceAccountAssertion(credentials, options);

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Token response had no access_token');
  return json.access_token;
}
