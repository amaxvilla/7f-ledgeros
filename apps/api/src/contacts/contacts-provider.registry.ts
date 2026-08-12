import { Injectable } from '@nestjs/common';
import { ContactsProvider } from './contacts-provider.interface';

/**
 * Release IG.1, Checkpoint E — Contacts Provider Registry.
 *
 * Same injectable-registry shape as CalendarProviderRegistry/
 * PaymentProviderRegistry/BankProviderRegistry, for the identical reason
 * given in all three: a real contacts provider
 * (MicrosoftGraphContactsProvider, built in a later checkpoint) needs to
 * resolve its own credentials via an injected IntegrationsService, so
 * concrete providers are ordinary Nest-DI-constructed services that
 * register themselves via their own `onModuleInit()`, not entries in a
 * plain module-load-time object like INTEGRATION_DRIVER_REGISTRY (which
 * only works for the stateless health-check drivers, not for services
 * with real dependencies).
 *
 * `get()` throws when nothing is registered for a code — same reasoning
 * as CalendarProviderRegistry/PaymentProviderRegistry/BankProviderRegistry:
 * a contacts operation silently doing nothing is not an acceptable
 * failure mode.
 */
@Injectable()
export class ContactsProviderRegistry {
  private readonly providers = new Map<string, ContactsProvider>();

  register(providerCode: string, provider: ContactsProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): ContactsProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No contacts provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
