import { Injectable } from '@nestjs/common';
import { QueueProducerService } from '../queue/queue-producer.service';
import { SendSmsDto } from './dto/send-sms.dto';

/**
 * Release ID Part 1 (completion) — the API-side entry point that was
 * missing: TwilioSmsService (send) and SmsProcessor (queue consumer)
 * existed in apps/worker, and NotificationProcessor already hands
 * channel=SMS notifications to the SMS queue, but nothing let a caller
 * send an ad-hoc SMS not tied to a Notification/User row (e.g. to a
 * Lead/Tenant/Customer phone number) — the same gap
 * EmailTemplateService.sendTemplatedEmail() fills for email. This is
 * that same shape for SMS: validate, enqueue via the now-registered SMS
 * queue, and let the existing worker pipeline handle delivery.
 */
@Injectable()
export class SmsService {
  constructor(private readonly queueProducer: QueueProducerService) {}

  async sendSms(dto: SendSmsDto) {
    await this.queueProducer.enqueueSms({
      to: dto.to,
      body: dto.body,
      notificationId: dto.notificationId,
    });
    return { to: dto.to, queued: true };
  }
}
