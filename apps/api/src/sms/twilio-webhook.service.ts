import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { verifyTwilioSignature } from './twilio-signature.util';

export interface TwilioStatusCallbackBody {
  MessageSid?: string;
  MessageStatus?: string;
  [key: string]: string | undefined;
}

/** Twilio status-callback values that mean "the message will never be
 *  delivered from here" — mapped to NotificationStatus.FAILED. Excludes
 *  the transient queued/sending/sent states, which SmsProcessor already
 *  set to SENT the moment Twilio accepted the send; this webhook only
 *  needs to move a notification forward from there. */
const FAILURE_STATUSES = new Set(['failed', 'undelivered']);

@Injectable()
export class TwilioWebhookService {
  private readonly logger = new Logger(TwilioWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  /** Same dual resolution TwilioSmsService uses (SMS_TWILIO_PROVIDER_ID →
   *  IntegrationProvider, else TWILIO_AUTH_TOKEN env var) — kept as a
   *  separate copy rather than a shared import because this runs in
   *  apps/api and that one runs in apps/worker; they resolve against
   *  different Prisma clients even though the schema is shared. */
  async resolveAuthToken(): Promise<string | null> {
    const providerId = process.env.SMS_TWILIO_PROVIDER_ID;
    if (providerId) {
      const credentials = await this.integrations.getDecryptedCredentials(providerId).catch(() => null);
      const authToken = credentials?.authToken as string | undefined;
      if (authToken) return authToken;
      this.logger.warn(`SMS_TWILIO_PROVIDER_ID=${providerId} has no usable authToken — falling back to TWILIO_AUTH_TOKEN env var`);
    }
    return process.env.TWILIO_AUTH_TOKEN ?? null;
  }

  async verifySignature(url: string, params: Record<string, string>, signature: string | undefined): Promise<boolean> {
    const authToken = await this.resolveAuthToken();
    if (!authToken) {
      // No auth token configured anywhere — same "never block the
      // pipeline when nothing is set up" posture as TwilioSmsService's
      // no-op send path, but for a webhook the safe default is to
      // REJECT (return false), not silently accept unverified callbacks.
      this.logger.warn('No Twilio auth token configured (SMS_TWILIO_PROVIDER_ID or TWILIO_AUTH_TOKEN) — rejecting webhook, cannot verify signature');
      return false;
    }
    return verifyTwilioSignature(authToken, url, params, signature);
  }

  /** Applies a verified status callback to the matching Notification row.
   *  Returns whether a matching notification was found — the controller
   *  still responds 200 to Twilio either way (an unmatched SID isn't
   *  Twilio's problem to retry over). */
  async applyStatusCallback(body: TwilioStatusCallbackBody): Promise<{ matched: boolean }> {
    if (!body.MessageSid || !body.MessageStatus) {
      this.logger.warn('Twilio status callback missing MessageSid or MessageStatus — ignoring');
      return { matched: false };
    }

    const notification = await this.prisma.notification.findFirst({
      where: { providerMessageId: body.MessageSid },
    });
    if (!notification) {
      this.logger.warn(`No notification found for Twilio MessageSid=${body.MessageSid} (status=${body.MessageStatus})`);
      return { matched: false };
    }

    if (body.MessageStatus === 'delivered') {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() },
      });
    } else if (FAILURE_STATUSES.has(body.MessageStatus)) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED },
      });
    }
    // queued/sending/sent: already reflected as SENT by SmsProcessor —
    // nothing further to update.

    return { matched: true };
  }
}
