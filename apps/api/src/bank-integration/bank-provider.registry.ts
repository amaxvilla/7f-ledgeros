import { Injectable } from '@nestjs/common';
import { BankProvider } from './bank-provider.interface';

/**
 * Release IF.1, Checkpoint A — Provider Registry.
 *
 * Same injectable-registry shape as PaymentProviderRegistry
 * (payments/payment-provider.registry.ts), for the identical reason
 * given there: a real bank/open-banking provider (Mono/Okra/Stitch,
 * built in a later checkpoint) needs to resolve its own credentials via
 * an injected IntegrationsService, the same way AwsS3StorageProvider and
 * PaystackProvider already do — so concrete providers are ordinary
 * Nest-DI-constructed services that register themselves via their own
 * `onModuleInit()`, not entries in a plain module-load-time object like
 * INTEGRATION_DRIVER_REGISTRY (which only works for the stateless
 * health-check drivers, not for services with real dependencies).
 *
 * `get()` throws when nothing is registered for a code — same reasoning
 * as PaymentProviderRegistry: a bank operation silently doing nothing
 * is not an acceptable failure mode.
 */
@Injectable()
export class BankProviderRegistry {
  private readonly providers = new Map<string, BankProvider>();

  register(providerCode: string, provider: BankProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): BankProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No bank provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
