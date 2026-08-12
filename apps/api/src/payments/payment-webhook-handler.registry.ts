import { Injectable } from '@nestjs/common';
import { PaymentWebhookHandler } from './payment-webhook-handler.interface';

/**
 * Release IE.1, Checkpoint F — Webhook handler registry.
 *
 * Same injectable-registry shape as PaymentProviderRegistry
 * (payment-provider.registry.ts) and for the same reason: a real
 * webhook handler (built in a later checkpoint alongside its matching
 * PaymentProvider) needs injected dependencies — at minimum
 * IntegrationsService, to resolve the provider's own webhook secret the
 * way AwsS3StorageProvider resolves its credentials — so it has to be an
 * ordinary Nest-DI-constructed service that registers itself via
 * `onModuleInit()`, not a `new`'d entry in a plain object.
 *
 * A distinct registry from PaymentProviderRegistry rather than folding
 * webhook handlers into the same map, because the two are keyed by the
 * same providerCode but resolved from different call sites at different
 * times (PaymentProviderRegistry from an authenticated request inside
 * PaymentsService; this one from an unauthenticated webhook endpoint) —
 * conflating them would mean a provider registering only one of the two
 * looks, from the type system's perspective, like it registered both.
 *
 * `get()` throws when no handler is registered for a code, same as
 * PaymentProviderRegistry — a webhook silently doing nothing with a
 * provider's callback is exactly the kind of missed-webhook gap
 * Checkpoint E's reconciliation job exists to catch, not something this
 * registry should paper over by pretending to succeed.
 */
@Injectable()
export class PaymentWebhookHandlerRegistry {
  private readonly handlers = new Map<string, PaymentWebhookHandler>();

  register(providerCode: string, handler: PaymentWebhookHandler): void {
    this.handlers.set(providerCode, handler);
  }

  get(providerCode: string): PaymentWebhookHandler {
    const handler = this.handlers.get(providerCode);
    if (!handler) {
      const known = [...this.handlers.keys()];
      throw new Error(
        `No payment webhook handler registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
      );
    }
    return handler;
  }

  isRegistered(providerCode: string): boolean {
    return this.handlers.has(providerCode);
  }

  list(): string[] {
    return [...this.handlers.keys()];
  }
}
