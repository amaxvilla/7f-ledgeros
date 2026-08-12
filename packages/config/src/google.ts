/**
 * Release IC.3 — Gmail API Driver.
 *
 * OAuth2 refresh-token token acquisition against Google's token
 * endpoint. Lives here for the exact same cross-app reason
 * acquireMicrosoftGraphToken does (see microsoft-graph.ts's doc
 * comment): apps/api's GmailEmailHealthCheckDriver needs it to verify
 * credentials, apps/worker's GmailMailService needs the identical call
 * to actually send mail.
 *
 * Unlike Microsoft Graph's client-credentials (app-only, arbitrary
 * senderUserId) flow, Gmail has no equivalent without full Workspace
 * domain-wide-delegation setup, so this driver is scoped to exactly one
 * mailbox per IntegrationProvider row: whichever Google account the
 * stored refresh token was originally granted for (Gmail API always
 * refers to it as "me", not a configurable sender). See
 * gmail-email-health-check.driver.ts's doc comment.
 *
 * Uses Node's built-in global fetch — no googleapis/google-auth-library
 * dependency, matching the microsoft-graph.ts precedent of not adding a
 * vendor SDK for what is, at this level, one HTTPS POST with a
 * well-known response shape.
 */
export async function acquireGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
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
