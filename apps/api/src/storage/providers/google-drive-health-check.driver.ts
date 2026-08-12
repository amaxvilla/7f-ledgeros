import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { acquireGoogleAccessToken } from '@7f/config';

/**
 * Release IH (Google Workspace), Checkpoint C.
 *
 * GoogleDriveStorageProvider (storage/providers/google-drive-storage.provider.ts,
 * Checkpoint B) has its own dedicated IntegrationProvider row
 * (STORAGE_DRIVE_PROVIDER_ID, providerCode "GOOGLE_DRIVE") — deliberately
 * NOT the same row GoogleCalendarProvider reuses from the GMAIL_EMAIL
 * email driver (see that provider's own doc comment). That means, unlike
 * Calendar — whose credentials are already covered by
 * GmailEmailHealthCheckDriver's existing GMAIL_EMAIL registration —
 * Drive's row had genuinely never been health-checked by anything.
 * Verified by grepping INTEGRATION_DRIVER_REGISTRY's registrations
 * before writing this file: AWS_S3, SMTP, MS_GRAPH_EMAIL, GMAIL_EMAIL,
 * and every payment/SMS/WhatsApp/bank provider all have one; GOOGLE_DRIVE
 * did not.
 *
 * Mirrors GmailEmailHealthCheckDriver's shape exactly — same
 * acquireGoogleAccessToken call, same "acquire a token, then one cheap
 * authenticated GET to confirm the specific configured resource is
 * reachable, don't upload/delete anything" posture. The one structural
 * difference: Drive's key config value is config.folderId (the "where
 * do our files live" setting — see GoogleDriveStorageProvider's own doc
 * comment), so this driver confirms THAT specific folder is reachable
 * with the given credentials, not just "some Drive account" — a more
 * specific check than Gmail's users/me/profile, closer to how a
 * hypothetical AWS_S3 driver would check the configured bucket rather
 * than just "valid AWS credentials".
 */
export class GoogleDriveHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const clientId = params.config?.clientId as string | undefined;
    const folderId = params.config?.folderId as string | undefined;
    const clientSecret = params.credentials?.clientSecret as string | undefined;
    const refreshToken = params.credentials?.refreshToken as string | undefined;

    const missingConfig = [!clientId && 'clientId', !folderId && 'folderId'].filter(Boolean);
    if (missingConfig.length) {
      return { ok: false, message: `Missing config.${missingConfig.join(', config.')}` };
    }
    const missingCredentials = [!clientSecret && 'clientSecret', !refreshToken && 'refreshToken'].filter(Boolean);
    if (missingCredentials.length) {
      return { ok: false, message: `Missing credentials.${missingCredentials.join(', credentials.')}` };
    }

    let accessToken: string;
    try {
      accessToken = await acquireGoogleAccessToken(clientId!, clientSecret!, refreshToken!);
    } catch (err) {
      return { ok: false, message: `Token acquisition failed: ${(err as Error).message}` };
    }

    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId!)}?fields=id,name`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return { ok: false, message: `Drive rejected the configured folder lookup: HTTP ${res.status}` };
      }
      const folder = (await res.json()) as { name?: string };
      return { ok: true, message: `Token acquired and folder "${folder.name ?? folderId}" confirmed` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
