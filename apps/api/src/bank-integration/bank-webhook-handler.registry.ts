import { Injectable } from '@nestjs/common';
import { BankWebhookHandler } from './bank-webhook-handler.interface';

/**
 * Release IF.1, Checkpoint G — Bank webhook handler registry.
 *
 * Same injectable-registry shape as PaymentWebhookHandlerRegistry
 * (payments/payment-webhook-handler.registry.ts) and BankProviderRegistry,
 * for the identical reasons those two give for themselves. See
 * bank-webhook-handler.interface.ts's own doc comment for why this is a
 * separate registry from both of those rather than folded into either.
 */
@Injectable()
export class BankWebhookHandlerRegistry {
  private readonly handlers = new Map<string, BankWebhookHandler>();

  register(providerCode: string, handler: BankWebhookHandler): void {
    this.handlers.set(providerCode, handler);
  }

  get(providerCode: string): BankWebhookHandler {
    const handler = this.handlers.get(providerCode);
    if (!handler) {
      const known = [...this.handlers.keys()];
      throw new Error(
        `No bank webhook handler registered for providerCode "${providerCode}". Registered: ${known.length ? known.join(', ') : '(none)'}`,
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
