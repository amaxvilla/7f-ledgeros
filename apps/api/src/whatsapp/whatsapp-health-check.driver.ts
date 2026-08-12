import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../integrations/integration-provider-driver.interface';

/**
 * Release ID.2 Part 1 — WhatsApp Cloud API.
 *
 * Registered into Release IA's INTEGRATION_DRIVER_REGISTRY under
 * providerCode 'WHATSAPP_CLOUD', same module-load-time pattern
 * TwilioHealthCheckDriver/SmtpHealthCheckDriver use (see
 * whatsapp.module.ts). Makes the existing generic
 * `POST /integrations/:id/health-check` endpoint (IntegrationsController,
 * unchanged) work for a WHATSAPP_CLOUD provider row.
 *
 * Confirms the stored phone number ID/access token are valid by fetching
 * the phone number resource itself (GET /{phone-number-id}) rather than
 * sending a test message — same "verify without sending" intent as
 * TwilioHealthCheckDriver fetching the Account resource.
 */
export class WhatsAppCloudHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const accessToken = params.credentials?.accessToken as string | undefined;
    const phoneNumberId = params.config?.phoneNumberId as string | undefined;

    if (!accessToken) {
      return { ok: false, message: 'Missing credentials.accessToken' };
    }
    if (!phoneNumberId) {
      return { ok: false, message: 'Missing config.phoneNumberId' };
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=display_phone_number,verified_name`;

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = (await res.json().catch(() => ({}))) as {
        display_phone_number?: string;
        verified_name?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        return { ok: false, message: `Meta rejected the credentials: HTTP ${res.status}${json.error?.message ? ` — ${json.error.message}` : ''}` };
      }
      return { ok: true, message: `WhatsApp number "${json.display_phone_number ?? phoneNumberId}" (${json.verified_name ?? 'unverified name'}) verified` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
