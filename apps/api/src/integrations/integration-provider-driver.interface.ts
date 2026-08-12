/**
 * Release IA — Core Integration Framework.
 *
 * Vendor-agnostic health-check contract, same pattern as StorageProvider
 * (apps/api/src/storage/storage.interface.ts): every concrete integration
 * driver built in a later release (S3StorageProvider-equivalent for
 * Twilio, Paystack, Microsoft Graph, ...) implements this interface and
 * registers itself in INTEGRATION_DRIVER_REGISTRY below, keyed by the
 * IntegrationProvider.providerCode it drives. IntegrationsService.runHealthCheck
 * looks the driver up by providerCode and never needs a switch statement
 * of its own as new providers are added.
 *
 * No concrete driver shipped in Release IA itself —
 * INTEGRATION_DRIVER_REGISTRY starts empty here and is populated at
 * module-load time by whichever provider modules are actually imported:
 * StorageModule registers 'AWS_S3' (Release IB), NotificationsModule
 * registers 'SMTP' (Release IC.1). A providerCode with no registered
 * driver still falls back to NoopIntegrationDriver (checks that
 * credentials/config are present, not that the vendor is actually
 * reachable).
 */
export interface IntegrationHealthCheckResult {
  ok: boolean;
  message?: string;
}

export interface IntegrationProviderDriver {
  healthCheck(params: { config: Record<string, unknown> | null; credentials: Record<string, unknown> | null }): Promise<IntegrationHealthCheckResult>;
}

/** Used for any providerCode with no registered driver yet. */
export class NoopIntegrationDriver implements IntegrationProviderDriver {
  async healthCheck(params: { config: Record<string, unknown> | null; credentials: Record<string, unknown> | null }): Promise<IntegrationHealthCheckResult> {
    if (!params.credentials) {
      return { ok: false, message: 'No credentials configured' };
    }
    return { ok: true, message: 'No driver registered for this provider yet — credentials are present but connectivity was not verified' };
  }
}

/** providerCode -> driver. Populated at module-load time by the provider modules above, not by this file. */
export const INTEGRATION_DRIVER_REGISTRY: Record<string, IntegrationProviderDriver> = {};
