import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { PAYSTACK_API_BASE_URL } from './paystack.provider';

/**
 * Release IE.2, Checkpoint A — Paystack credential validation.
 *
 * Registered into Release IA's INTEGRATION_DRIVER_REGISTRY under
 * 'PAYSTACK' (see payments.module.ts), same pattern as
 * TwilioHealthCheckDriver (sms/providers/twilio-health-check.driver.ts).
 * Confirms the configured secret key actually authenticates by calling
 * Paystack's "List Banks" endpoint — chosen because it's a plain
 * authenticated GET with no side effects and no dependency on any
 * transaction/customer already existing, so it works as a pure
 * "is this key valid" check the same day a fresh key is configured.
 */
export class PaystackHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const secretKey = params.credentials?.secretKey as string | undefined;

    if (!secretKey) {
      return { ok: false, message: 'Missing credentials.secretKey' };
    }

    try {
      const res = await fetch(`${PAYSTACK_API_BASE_URL}/bank?perPage=1`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, message: `Paystack auth check failed: HTTP ${res.status}${body ? ` — ${body}` : ''}` };
      }

      const json = (await res.json()) as { message?: string };
      return { ok: true, message: json.message ?? 'Paystack secret key is valid' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
