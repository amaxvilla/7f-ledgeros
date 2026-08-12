import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { acquireGoogleAccessToken } from '@7f/config';

/**
 * Release IC.3 — Gmail API Driver.
 *
 * The fourth real driver registered into Release IA's
 * INTEGRATION_DRIVER_REGISTRY (AwsS3HealthCheckDriver, SmtpHealthCheckDriver,
 * MicrosoftGraphEmailHealthCheckDriver — this mirrors the latter's shape
 * exactly, down to "acquire a token, then do one cheap authenticated GET
 * to confirm the mailbox, don't send anything"). The one structural
 * difference: Gmail's OAuth2 refresh-token flow has no equivalent to
 * Graph's arbitrary config.senderUserId — the mailbox is whichever
 * account granted the refresh token, so this driver confirms it via
 * GET .../users/me/profile instead of a caller-supplied user id. See
 * google.ts's doc comment for why there's no config.senderUserId field
 * here at all (not an oversight — there is nothing to configure).
 */
export class GmailEmailHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const clientId = params.config?.clientId as string | undefined;
    const clientSecret = params.credentials?.clientSecret as string | undefined;
    const refreshToken = params.credentials?.refreshToken as string | undefined;

    if (!clientId) {
      return { ok: false, message: 'Missing config.clientId' };
    }
    if (!clientSecret) {
      return { ok: false, message: 'Missing credentials.clientSecret' };
    }
    if (!refreshToken) {
      return { ok: false, message: 'Missing credentials.refreshToken' };
    }

    let accessToken: string;
    try {
      accessToken = await acquireGoogleAccessToken(clientId, clientSecret, refreshToken);
    } catch (err) {
      return { ok: false, message: `Token acquisition failed: ${(err as Error).message}` };
    }

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return { ok: false, message: `Gmail rejected the profile lookup: HTTP ${res.status}` };
      }
      const profile = (await res.json()) as { emailAddress?: string };
      return { ok: true, message: `Token acquired and mailbox "${profile.emailAddress ?? 'unknown'}" confirmed` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
