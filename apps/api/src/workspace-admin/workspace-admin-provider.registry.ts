import { Injectable } from '@nestjs/common';
import { WorkspaceAdminProvider } from './workspace-admin-provider.interface';

/**
 * Release IH, Checkpoint E — Workspace Admin Provider Registry.
 *
 * Same injectable-registry shape as ContactsProviderRegistry/
 * CalendarProviderRegistry/PaymentProviderRegistry/BankProviderRegistry,
 * for the identical reason given in all four: a real provider needs to
 * resolve its own credentials via an injected IntegrationsService, so
 * concrete providers are ordinary Nest-DI-constructed services that
 * register themselves via their own `onModuleInit()`, not entries in a
 * plain module-load-time object like INTEGRATION_DRIVER_REGISTRY.
 *
 * Stays empty for now — see workspace-admin-provider.interface.ts's
 * Architectural Gap note for why a concrete provider isn't a
 * same-shaped follow-on checkpoint the way GoogleContactsProvider was.
 *
 * `get()` throws when nothing is registered — same reasoning as every
 * sibling registry: a directory-admin operation silently doing nothing
 * is not an acceptable failure mode.
 */
@Injectable()
export class WorkspaceAdminProviderRegistry {
  private readonly providers = new Map<string, WorkspaceAdminProvider>();

  register(providerCode: string, provider: WorkspaceAdminProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): WorkspaceAdminProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No workspace admin provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
