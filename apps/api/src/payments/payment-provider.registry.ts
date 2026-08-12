import { Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';

/**
 * Release IE.1, Checkpoint B — Provider Registry.
 *
 * Deliberately NOT a plain module-load-time object like
 * INTEGRATION_DRIVER_REGISTRY (integrations/integration-provider-driver.interface.ts).
 * That pattern works for health-check drivers because they're stateless —
 * `new AwsS3HealthCheckDriver()` takes no constructor dependencies; config
 * and credentials are passed into `healthCheck()` per call by whatever
 * already has the IntegrationProvider row loaded.
 *
 * A real payment provider (Paystack/Flutterwave/Stripe, built in a later
 * checkpoint) needs to resolve its own credentials the way
 * AwsS3StorageProvider does (storage/providers/aws-s3-storage.provider.ts)
 * — injected IntegrationsService, lazily resolved — so calling code can
 * just say `initializePayment({...})` without first looking up which
 * IntegrationProvider row to use. That means concrete providers are
 * ordinary Nest-DI-constructed services, which can't be `new`'d into a
 * plain object outside the DI container. Hence: an injectable registry
 * that concrete provider modules register into via their own
 * `onModuleInit()` (where they can rely on their own constructor
 * injection having already run), not a static object.
 *
 * Unlike NoopIntegrationDriver's silent fallback, `get()` throws when no
 * provider is registered for a code — a health check silently reporting
 * "not verified" is acceptable; a payment operation silently doing
 * nothing is not.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  register(providerCode: string, provider: PaymentProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): PaymentProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No payment provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
      );
    }
    return provider;
  }

  isRegistered(providerCode: string): boolean {
    return this.providers.has(providerCode);
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}
