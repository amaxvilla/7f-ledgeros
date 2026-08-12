import { Injectable } from '@nestjs/common';
import { QueueProducerService } from '../queue/queue-producer.service';
import { SendWhatsAppDto } from './dto/send-whatsapp.dto';

/**
 * Release ID.2 Part 1 — WhatsApp Cloud API (outbound sending).
 *
 * Same shape as SmsService: the API-side entry point for an ad-hoc
 * WhatsApp message not tied to a Notification/User row (e.g. to a
 * Lead/Tenant/Customer phone number). Validates, enqueues via the
 * WHATSAPP queue, and lets WhatsAppProcessor (apps/worker) handle actual
 * delivery through WhatsAppCloudService.
 */
@Injectable()
export class WhatsAppService {
  constructor(private readonly queueProducer: QueueProducerService) {}

  async sendWhatsApp(dto: SendWhatsAppDto) {
    await this.queueProducer.enqueueWhatsApp({
      to: dto.to,
      body: dto.body,
      notificationId: dto.notificationId,
    });
    return { to: dto.to, queued: true };
  }
}
