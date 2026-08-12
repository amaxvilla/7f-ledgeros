import { Module } from '@nestjs/common';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TwilioWebhookService } from './twilio-webhook.service';
import { TwilioHealthCheckDriver } from './twilio-health-check.driver';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';
import { QueueModule } from '../queue/queue.module';

// Release ID Part 1 — the fifth driver registered into Release IA's
// INTEGRATION_DRIVER_REGISTRY (after SMTP, MS_GRAPH_EMAIL, GMAIL_EMAIL,
// and Release IB's AWS_S3), same module-load-time registration as
// NotificationsModule's own drivers.
INTEGRATION_DRIVER_REGISTRY['TWILIO'] = new TwilioHealthCheckDriver();

@Module({
  imports: [IntegrationsModule, QueueModule],
  controllers: [TwilioWebhookController, SmsController],
  providers: [TwilioWebhookService, SmsService],
  exports: [TwilioWebhookService, SmsService],
})
export class SmsModule {}
