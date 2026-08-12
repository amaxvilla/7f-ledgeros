import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { MONO_API_BASE_URL } from './mono.provider';

/**
 * Release IF.1, Checkpoint B — Mono credential validation.
 *
 * Registered into Release IA's INTEGRATION_DRIVER_REGISTRY under 'MONO'
 * (see bank-integration.module.ts), same pattern as
 * FlutterwaveHealthCheckDriver/PaystackHealthCheckDriver. Confirms the
 * configured secret key actually authenticates by calling Mono's List
 * Institutions endpoint (GET /institutions) — chosen for the identical
 * reason FlutterwaveHealthCheckDriver calls GET /banks/NG: a plain
 * authenticated GET with no side effects, no dependency on any linked
 * account existing (see mono.provider.ts's doc comment on why Mono has
 * no such thing yet in this codebase), and no consent/customer state.
 *
 * Mono's auth header is `mono-sec-key`, not `Authorization: Bearer` —
 * one of the concrete differences a health check like this exists to
 * catch (a wrong header name fails loud here rather than silently at
 * whatever first real call happens once later checkpoints add one).
 */
export class MonoHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const secretKey = params.credentials?.secretKey as string | undefined;

    if (!secretKey) {
      return { ok: false, message: 'Missing credentials.secretKey' };
    }

    try {
      const res = await fetch(`${MONO_API_BASE_URL}/institutions`, {
        headers: { 'mono-sec-key': secretKey },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, message: `Mono auth check failed: HTTP ${res.status}${body ? ` — ${body}` : ''}` };
      }

      const json = (await res.json()) as { data?: unknown[] };
      return { ok: true, message: `Mono secret key is valid (${json.data?.length ?? 0} institutions returned)` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
