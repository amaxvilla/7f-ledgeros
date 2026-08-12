import { Injectable } from '@nestjs/common';
import { TransferProvider } from './transfer-provider.interface';

/**
 * Enterprise Banking APIs (Transfer APIs), Checkpoint A — Transfer
 * Provider Registry.
 *
 * Same injectable-registry shape as every sibling registry in this
 * codebase (PaymentProviderRegistry, BankProviderRegistry,
 * ContactsProviderRegistry, WorkspaceAdminProviderRegistry) — a real
 * transfer provider needs to resolve its own credentials via an
 * injected IntegrationsService, so concrete providers are ordinary
 * Nest-DI-constructed services that register themselves via their own
 * `onModuleInit()`, not module-load-time entries.
 *
 * Supports multiple simultaneously-registered providers by design —
 * see transfer-provider.interface.ts's "PROVIDER CHOICE" note: this
 * release deliberately does not assume a single "the" transfer
 * provider.
 *
 * `get()` throws when nothing is registered for a code — same
 * reasoning as every sibling registry: a transfer operation silently
 * doing nothing is not an acceptable failure mode, and would be far
 * worse here than anywhere else in this codebase given what's at stake.
 */
@Injectable()
export class TransferProviderRegistry {
  private readonly providers = new Map<string, TransferProvider>();

  register(providerCode: string, provider: TransferProvider): void {
    this.providers.set(providerCode, provider);
  }

  get(providerCode: string): TransferProvider {
    const provider = this.providers.get(providerCode);
    if (!provider) {
      const known = [...this.providers.keys()];
      throw new Error(
        `No transfer provider registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
