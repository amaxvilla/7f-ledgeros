import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppCloudHealthCheckDriver } from './whatsapp-health-check.driver';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';
import { QueueModule } from '../queue/queue.module';

// Release ID.2 Part 1 — the sixth driver registered into Release IA's
// INTEGRATION_DRIVER_REGISTRY (after SMTP, MS_GRAPH_EMAIL, GMAIL_EMAIL,
// Release IB's AWS_S3, and Release ID's TWILIO), same module-load-time
// registration every prior driver uses.
INTEGRATION_DRIVER_REGISTRY['WHATSAPP_CLOUD'] = new WhatsAppCloudHealthCheckDriver();

@Module({
  // IntegrationsModule — Release ID.2 Part 2, needed by
  // WhatsAppWebhookService to resolve the configured provider's
  // decrypted app secret (same reason SmsModule imports it for
  // TwilioWebhookService).
  imports: [QueueModule, IntegrationsModule],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [WhatsAppService, WhatsAppWebhookService],
  exports: [WhatsAppService, WhatsAppWebhookService],
})
export class WhatsAppModule {}
