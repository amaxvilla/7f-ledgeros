import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { TwilioWebhookService, TwilioStatusCallbackBody } from './twilio-webhook.service';

/**
 * Release ID Part 1 — Twilio delivery-receipt webhook.
 *
 * @Public() — Twilio calls this directly, with no JWT to present, so it
 * must sit outside JwtAuthGuard the same way /auth/login does. The
 * X-Twilio-Signature check below is what actually authenticates the
 * caller instead. @ApiExcludeEndpoint() keeps it out of the Swagger UI's
 * "try it" surface — it's not a route a human user of this API ever
 * calls, and documenting request/response shapes here would be
 * misleading (there is no meaningful response body, only a status code).
 */
@Controller('sms/webhook')
export class TwilioWebhookController {
  constructor(private readonly webhook: TwilioWebhookService) {}

  @Public()
  @Post('status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  async status(
    @Body() body: TwilioStatusCallbackBody,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Req() req: Request,
  ): Promise<void> {
    const url = this.resolveWebhookUrl(req);
    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') stringParams[key] = value;
    }

    const verified = await this.webhook.verifySignature(url, stringParams, signature);
    if (!verified) {
      throw new ForbiddenException('Invalid Twilio signature');
    }

    await this.webhook.applyStatusCallback(body);
  }

  /**
   * The signature Twilio sent was computed over the EXACT URL it POSTed
   * to. Behind a load balancer/reverse proxy, `req.protocol`/`req.get('host')`
   * often don't match what Twilio actually used (internal vs public
   * hostname, terminated TLS, etc.), so re-deriving the URL from the
   * request is unreliable in production. SMS_TWILIO_WEBHOOK_URL, when
   * set, is the exact public URL configured on the Twilio console/number
   * (recommended practice) and is used as-is; only when it's unset (bare
   * local/dev) does this fall back to reconstructing from the request.
   */
  private resolveWebhookUrl(req: Request): string {
    const configured = process.env.SMS_TWILIO_WEBHOOK_URL;
    if (configured) return configured;
    return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  }
}
