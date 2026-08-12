import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { acquireMicrosoftGraphToken } from '@7f/config';

/**
 * Release IC.2 — Microsoft Graph Email Driver.
 *
 * The third real driver registered into Release IA's
 * INTEGRATION_DRIVER_REGISTRY (AwsS3HealthCheckDriver, then
 * SmtpHealthCheckDriver — this mirrors SmtpHealthCheckDriver's shape
 * exactly). Confirms an app-only (client-credentials) Microsoft Graph
 * token can be acquired for config.tenantId/config.clientId +
 * credentials.clientSecret, then does a lightweight GET on
 * config.senderUserId to confirm that mailbox actually exists — same
 * "verify credentials, don't send anything" spirit as SMTP's
 * transporter.verify().
 *
 * Token acquisition itself lives in @7f/config's
 * acquireMicrosoftGraphToken (not duplicated here) — apps/worker's
 * MicrosoftGraphMailService needs the exact same client-credentials call
 * to actually send mail, same reason decryptIntegrationCredentials was
 * moved there for IntegrationEncryptionService (see that file's doc
 * comment). No new npm dependency either way: both call sites use
 * Node 22's built-in global fetch rather than @azure/msal-node.
 */
export class MicrosoftGraphEmailHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const tenantId = params.config?.tenantId as string | undefined;
    const clientId = params.config?.clientId as string | undefined;
    const senderUserId = params.config?.senderUserId as string | undefined;
    const clientSecret = params.credentials?.clientSecret as string | undefined;

    const missing = ['tenantId', 'clientId', 'senderUserId'].filter((k) => !params.config?.[k]);
    if (missing.length) {
      return { ok: false, message: `Missing config.${missing.join(', config.')}` };
    }
    if (!clientSecret) {
      return { ok: false, message: 'Missing credentials.clientSecret' };
    }

    let accessToken: string;
    try {
      accessToken = await acquireMicrosoftGraphToken(tenantId!, clientId!, clientSecret);
    } catch (err) {
      return { ok: false, message: `Token acquisition failed: ${(err as Error).message}` };
    }

    try {
      const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUserId!)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return { ok: false, message: `Graph rejected sender mailbox lookup: HTTP ${res.status}` };
      }
      return { ok: true, message: `Token acquired and sender mailbox "${senderUserId}" confirmed` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
