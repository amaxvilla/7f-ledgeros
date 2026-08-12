import { Controller, ForbiddenException, HttpCode, HttpStatus, NotFoundException, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PaymentWebhookHandlerRegistry } from './payment-webhook-handler.registry';
import { PaymentsService } from './payments.service';

/**
 * Release IE.1, Checkpoint F2 — the generic webhook endpoint Checkpoint
 * F's PaymentWebhookHandlerRegistry existed to eventually back. Same
 * shape as TwilioWebhookController/WhatsAppWebhookController: @Public()
 * since a payment provider calls this directly with no JWT, raw-body
 * signature verification before anything is trusted,
 * @ApiExcludeEndpoint() to keep it off the Swagger "try it" surface.
 *
 * One route per provider code (`:providerCode` — e.g. "PAYSTACK",
 * matching PaymentTransaction.providerCode / the registry keys) rather
 * than one controller per provider, since the verify → parse → apply
 * sequence is identical regardless of which concrete handler is
 * resolved — a new gateway in a later checkpoint (IE.2) is a new
 * PaymentWebhookHandler registered under its own code, not a new route
 * here.
 *
 * `main.ts` already sets `rawBody: true` app-wide (added for the
 * WhatsApp webhook), so `req.rawBody` is available here for free — no
 * new global wiring needed for this checkpoint.
 *
 * No concrete PaymentWebhookHandler is registered yet (that's
 * Checkpoint IE.2, alongside the concrete PaymentProvider), so hitting
 * this route today throws "No payment webhook handler registered for
 * providerCode ..." via PaymentWebhookHandlerRegistry.get() — the same
 * "framework wired, no real gateway yet" state Checkpoint D left
 * PaymentProviderRegistry in.
 */
@Controller('payments/webhook')
export class PaymentWebhookController {
  constructor(
    private readonly handlers: PaymentWebhookHandlerRegistry,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @Post(':providerCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  async receive(
    @Param('providerCode') providerCode: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    if (!this.handlers.isRegistered(providerCode)) {
      // Distinct from an invalid signature: an unknown providerCode is a
      // routing problem (nothing is misconfigured on the caller's end,
      // there's just nothing registered to verify against yet), so this
      // is a 404, not the 403 an unverified signature gets below.
      throw new NotFoundException(`No payment webhook handler registered for providerCode "${providerCode}"`);
    }

    const handler = this.handlers.get(providerCode);
    const rawBody = req.rawBody ?? Buffer.from('');
    const verified = await handler.verifySignature(rawBody, req.headers as Record<string, string | undefined>);
    if (!verified) {
      throw new ForbiddenException(`Invalid webhook signature for providerCode "${providerCode}"`);
    }

    const event = handler.parseEvent(rawBody);
    if (event.kind === 'refund') {
      await this.payments.applyRefundWebhookEvent(event.event);
    } else {
      await this.payments.applyWebhookEvent(event.event);
    }
  }
}
