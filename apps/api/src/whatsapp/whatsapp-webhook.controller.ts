import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, HttpStatus, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService, WhatsAppWebhookPayload } from './whatsapp-webhook.service';

/**
 * Release ID.2 Part 2 — WhatsApp Cloud API webhook.
 *
 * Same "outbound first, webhook second" split Release ID (SMS/Twilio)
 * used, and the same shape as TwilioWebhookController: @Public() since
 * Meta calls this directly with no JWT, ForbiddenException on any failed
 * verification rather than silently accepting, @ApiExcludeEndpoint() to
 * keep it out of the Swagger "try it" surface.
 *
 * Two routes, both required by Meta's Cloud API webhook contract:
 *  - GET  /whatsapp/webhook — the one-time subscription handshake Meta's
 *    App Dashboard performs when the webhook URL is first configured (and
 *    whenever it's re-verified).
 *  - POST /whatsapp/webhook — the actual callback delivery. This release
 *    only processes `value.statuses[]` (delivery/read/failure receipts for
 *    messages this system sent) — inbound `value.messages[]` (a customer
 *    messaging the business number) is a distinct feature (two-way
 *    messaging, conversation storage, opt-in/consent handling) intentionally
 *    out of scope here; entries containing only `messages[]` are safely
 *    ignored by WhatsAppWebhookService.applyCallback (statuses[] flatMap
 *    yields nothing for them) rather than erroring.
 */
@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(private readonly webhook: WhatsAppWebhookService) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  async verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): Promise<string> {
    const verified = await this.webhook.verifyHandshake(mode, token);
    if (!verified) {
      throw new ForbiddenException('WhatsApp webhook verification failed');
    }
    return challenge ?? '';
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  async callback(
    @Body() body: WhatsAppWebhookPayload,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    const verified = await this.webhook.verifySignature(req.rawBody, signature);
    if (!verified) {
      throw new ForbiddenException('Invalid WhatsApp webhook signature');
    }

    await this.webhook.applyCallback(body);
  }
}
