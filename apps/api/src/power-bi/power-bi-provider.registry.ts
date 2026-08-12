import { Injectable } from '@nestjs/common';
import { PowerBiProvider } from './power-bi-provider.interface';

/**
 * Power BI, Checkpoint A — Power BI Provider Registry.
 *
 * Same injectable-registry shape as SignatureProviderRegistry/
 * ContactsProviderRegistry/CalendarProviderRegistry/PaymentProviderRegistry/
 * BankProviderRegistry/TransferProviderRegistry, for the identical
 * reason given in all of them: a real Power BI provider (built in a
 * later checkpoint) needs to resolve its own credentials via an
 * injected IntegrationsService, so concrete providers are ordinary
 * Nest-DI-constructed services that register themselves via their own
 * `onModuleInit()`, not entries in a plain module-load-time object.
 *
 * `get()` throws when nothing is registered for a code — same reasoning
 * as every sibling registry: a Power BI operation silently doing
 * nothing is not an acceptable failure mode.
 */
@Injectable()
export class PowerBiProviderRegistry {
  private readonly providers = new Map<string, PowerBiProvider>();

  register(providerCode: string, provider: PowerBiProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): PowerBiProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No Power BI provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
