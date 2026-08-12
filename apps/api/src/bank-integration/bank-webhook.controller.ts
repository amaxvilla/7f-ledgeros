import { Controller, ForbiddenException, HttpCode, HttpStatus, NotFoundException, Param, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { BankWebhookHandlerRegistry } from './bank-webhook-handler.registry';
import { MonoLinkedAccountService } from './mono-linked-account.service';

/**
 * Release IF.1, Checkpoint G — the generic webhook endpoint
 * BankWebhookHandlerRegistry exists to back, deliberately mirroring
 * PaymentWebhookController (payments/payment-webhook.controller.ts)
 * structurally: @Public() since a bank-data provider calls this
 * directly with no JWT, raw-body signature verification before
 * anything is trusted, @ApiExcludeEndpoint() to keep it off Swagger's
 * "try it" surface, `main.ts`'s app-wide `rawBody: true` (added for the
 * WhatsApp webhook) already makes `req.rawBody` available here for free.
 *
 * One route per provider code, same reasoning as the payments
 * equivalent — a second bank provider (Okra/Stitch) registers its own
 * BankWebhookHandler under its own code, not a new route.
 *
 * Applying a `link_status` event is delegated to MonoLinkedAccountService
 * specifically, not a vendor-agnostic "BankLinkedAccountsService" —
 * unlike PaymentTransaction (one shared table every payment provider's
 * webhook updates), there is no shared cross-provider linked-account
 * table today; MonoLinkedAccount is Mono-specific. A genuinely
 * vendor-agnostic apply path is future work once a second bank provider
 * with its own linked-account model exists — flagged here rather than
 * built speculatively for a provider that doesn't exist yet.
 */
@Controller('bank-integration/webhook')
export class BankWebhookController {
  constructor(
    private readonly handlers: BankWebhookHandlerRegistry,
    private readonly monoLinkedAccounts: MonoLinkedAccountService,
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
      throw new NotFoundException(`No bank webhook handler registered for providerCode "${providerCode}"`);
    }

    const handler = this.handlers.get(providerCode);
    const rawBody = req.rawBody ?? Buffer.from('');
    const verified = await handler.verifySignature(rawBody, req.headers as Record<string, string | undefined>);
    if (!verified) {
      throw new ForbiddenException(`Invalid webhook signature for providerCode "${providerCode}"`);
    }

    const parsed = handler.parseEvent(rawBody);
    if (parsed.kind === 'ignored') {
      return;
    }

    // providerCode-keyed dispatch, same shape as the class doc comment
    // describes — today there is exactly one bank webhook handler
    // (Mono), so this is a direct call rather than a second registry;
    // a second provider adds a branch here (or, if a third arrives,
    // promotes this to its own small registry — same escalation
    // PaymentWebhookController never needed because PaymentTransaction
    // was already shared from Checkpoint C).
    if (providerCode === 'MONO') {
      await this.monoLinkedAccounts.applyLinkStatusWebhookEvent(parsed.event.providerAccountId, parsed.event.status);
    }
  }
}
