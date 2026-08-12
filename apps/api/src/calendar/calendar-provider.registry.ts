import { Injectable } from '@nestjs/common';
import { CalendarProvider } from './calendar-provider.interface';

/**
 * Release IG.1, Checkpoint A — Provider Registry.
 *
 * Same injectable-registry shape as PaymentProviderRegistry/
 * BankProviderRegistry, for the identical reason given in both: a real
 * calendar provider (MicrosoftGraphCalendarProvider, built in a later
 * checkpoint) needs to resolve its own credentials via an injected
 * IntegrationsService, so concrete providers are ordinary
 * Nest-DI-constructed services that register themselves via their own
 * `onModuleInit()`, not entries in a plain module-load-time object like
 * INTEGRATION_DRIVER_REGISTRY (which only works for the stateless
 * health-check drivers, not for services with real dependencies).
 *
 * `get()` throws when nothing is registered for a code — same reasoning
 * as PaymentProviderRegistry/BankProviderRegistry: a calendar operation
 * silently doing nothing is not an acceptable failure mode.
 */
@Injectable()
export class CalendarProviderRegistry {
  private readonly providers = new Map<string, CalendarProvider>();

  register(providerCode: string, provider: CalendarProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): CalendarProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No calendar provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
