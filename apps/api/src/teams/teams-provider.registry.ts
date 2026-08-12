import { Injectable } from '@nestjs/common';
import { TeamsProvider } from './teams-provider.interface';

/**
 * Release IG.1, Checkpoint Q — Teams Provider Registry.
 *
 * Same injectable-registry shape as PresenceProviderRegistry/
 * TasksProviderRegistry/CalendarProviderRegistry/ContactsProviderRegistry,
 * for the identical reason given in all of them: a real Teams provider
 * (MicrosoftTeamsProvider, built in a later checkpoint) needs to resolve
 * its own credentials via an injected IntegrationsService, so concrete
 * providers are ordinary Nest-DI-constructed services that register
 * themselves via their own `onModuleInit()`, not entries in a plain
 * module-load-time object like INTEGRATION_DRIVER_REGISTRY (which only
 * works for the stateless health-check drivers, not for services with
 * real dependencies).
 *
 * `get()` throws when nothing is registered for a code — same reasoning
 * as every sibling registry: a meeting-creation call silently doing
 * nothing is not an acceptable failure mode.
 */
@Injectable()
export class TeamsProviderRegistry {
  private readonly providers = new Map<string, TeamsProvider>();

  register(providerCode: string, provider: TeamsProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): TeamsProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No Teams provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
