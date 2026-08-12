import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { FLUTTERWAVE_API_BASE_URL } from './flutterwave.provider';

/**
 * Release IE.3, Checkpoint A — Flutterwave credential validation.
 *
 * Registered into Release IA's INTEGRATION_DRIVER_REGISTRY under
 * 'FLUTTERWAVE' (see payments.module.ts), same pattern as
 * PaystackHealthCheckDriver. Confirms the configured secret key actually
 * authenticates by calling Flutterwave's "Fetch All Banks for Nigeria"
 * endpoint (GET /banks/NG) — chosen for the identical reason
 * PaystackHealthCheckDriver calls Paystack's List Banks endpoint: a
 * plain authenticated GET with no side effects and no dependency on any
 * transaction/customer already existing.
 */
export class FlutterwaveHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const secretKey = params.credentials?.secretKey as string | undefined;

    if (!secretKey) {
      return { ok: false, message: 'Missing credentials.secretKey' };
    }

    try {
      const res = await fetch(`${FLUTTERWAVE_API_BASE_URL}/banks/NG`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, message: `Flutterwave auth check failed: HTTP ${res.status}${body ? ` — ${body}` : ''}` };
      }

      const json = (await res.json()) as { message?: string };
      return { ok: true, message: json.message ?? 'Flutterwave secret key is valid' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
