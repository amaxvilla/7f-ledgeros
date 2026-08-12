import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../integrations/integration-provider-driver.interface';

/**
 * Release ID Part 1 — SMS Integration (Twilio).
 *
 * Registered into Release IA's INTEGRATION_DRIVER_REGISTRY under
 * providerCode 'TWILIO', same module-load-time pattern
 * SmtpHealthCheckDriver/MicrosoftGraphEmailHealthCheckDriver/
 * GmailEmailHealthCheckDriver use (see sms.module.ts). This is what makes
 * the existing generic `POST /integrations/:id/health-check` endpoint
 * (IntegrationsController, unchanged) work for a TWILIO provider row —
 * no new "SMS health endpoint" was needed, only a driver for the
 * existing one to look up.
 *
 * Confirms the stored Account SID/Auth Token are valid by fetching the
 * account resource itself (GET .../Accounts/{Sid}.json) rather than
 * sending a test SMS — same "verify without sending" intent as
 * SmtpHealthCheckDriver's transporter.verify().
 */
export class TwilioHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const accountSid = params.credentials?.accountSid as string | undefined;
    const authToken = params.credentials?.authToken as string | undefined;
    const fromNumber = params.config?.fromNumber as string | undefined;

    if (!accountSid || !authToken) {
      return { ok: false, message: 'Missing credentials.accountSid or credentials.authToken' };
    }
    if (!fromNumber) {
      return { ok: false, message: 'Missing config.fromNumber' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    try {
      const res = await fetch(url, { headers: { Authorization: `Basic ${basicAuth}` } });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        return { ok: false, message: `Twilio rejected the credentials: HTTP ${res.status}${body.message ? ` — ${body.message}` : ''}` };
      }
      const json = (await res.json()) as { status?: string; friendly_name?: string };
      if (json.status && json.status !== 'active') {
        return { ok: false, message: `Twilio account status is "${json.status}", not active` };
      }
      return { ok: true, message: `Twilio account "${json.friendly_name ?? accountSid}" verified` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
