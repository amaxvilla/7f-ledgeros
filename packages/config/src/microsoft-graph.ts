/**
 * Release IC.2 — Microsoft Graph Email Driver.
 *
 * App-only (client-credentials) OAuth2 token acquisition against a
 * tenant's v2.0 token endpoint. Lives here rather than in apps/api or
 * apps/worker individually because both need the exact same call:
 * apps/api's MicrosoftGraphEmailHealthCheckDriver to verify credentials,
 * apps/worker's MicrosoftGraphMailService to actually send mail — same
 * cross-app-sharing reason getIntegrationEncryptionKey/
 * decryptIntegrationCredentials live in this package instead of one
 * app's src tree (see encryption.ts's doc comment).
 *
 * Uses Node's built-in global fetch — no @azure/msal-node dependency for
 * what is, at this level, one HTTPS POST with a well-known response
 * shape.
 *
 * Power BI, Checkpoint B: the client-credentials grant itself
 * (`acquireAzureAdToken` below) is identical for any Azure AD-protected
 * API in this same tenant — only the `scope` (the resource being
 * requested a token for) differs. Extracted so `acquirePowerBiToken`
 * (Power BI's own token acquisition, needed before a concrete
 * `PowerBiProvider` can call any Power BI REST API) reuses this exact
 * HTTP call rather than duplicating it — the same "never duplicate
 * code" reasoning that kept `google-service-account.ts` a sibling file
 * to `google.ts` instead of its own copy of the fetch/error-handling
 * logic. `acquireMicrosoftGraphToken`'s own signature and behavior are
 * unchanged — every existing caller (Mail, Contacts, Calendar, Tasks,
 * Teams, Presence) keeps working exactly as before.
 */
async function acquireAzureAdToken(tenantId: string, clientId: string, clientSecret: string, scope: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Token response had no access_token');
  return json.access_token;
}

export async function acquireMicrosoftGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  return acquireAzureAdToken(tenantId, clientId, clientSecret, 'https://graph.microsoft.com/.default');
}

/**
 * Power BI, Checkpoint B — the prerequisite Power BI Checkpoint A's own
 * doc comment implied every concrete-provider checkpoint in this
 * codebase needs before it: a way to actually get a token. Power BI's
 * REST API sits behind the same Azure AD tenant/client-credentials flow
 * as Microsoft Graph, just a different resource — `.default` against
 * `https://analysis.windows.net/powerbi/api/` (Power BI's own service
 * principal resource URI) instead of Graph's. Nothing calls this yet;
 * a later checkpoint builds the concrete `PowerBiProvider` on top of it,
 * the same sequencing Checkpoint F (`acquireGoogleServiceAccountAccessToken`)
 * → Checkpoint G (credential shape) → Checkpoint H (concrete provider)
 * already established for Google Workspace Admin.
 */
export async function acquirePowerBiToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  return acquireAzureAdToken(tenantId, clientId, clientSecret, 'https://analysis.windows.net/powerbi/api/.default');
}
