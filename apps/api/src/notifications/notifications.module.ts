import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateController } from './email-template.controller';
import { QueueModule } from '../queue/queue.module';
import { SmtpHealthCheckDriver } from './providers/smtp-health-check.driver';
import { MicrosoftGraphEmailHealthCheckDriver } from './providers/microsoft-graph-email-health-check.driver';
import { GmailEmailHealthCheckDriver } from './providers/gmail-email-health-check.driver';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';

// Release IC.1 — the second real driver registered into Release IA's
// INTEGRATION_DRIVER_REGISTRY, same module-load-time registration
// StorageModule uses for AwsS3HealthCheckDriver (see that module's own
// comment for why this stays a one-way dependency: Notifications
// depends on Integrations' interface, not the reverse).
INTEGRATION_DRIVER_REGISTRY['SMTP'] = new SmtpHealthCheckDriver();
// Release IC.2 — the third.
INTEGRATION_DRIVER_REGISTRY['MS_GRAPH_EMAIL'] = new MicrosoftGraphEmailHealthCheckDriver();
// Release IC.3 — the fourth.
INTEGRATION_DRIVER_REGISTRY['GMAIL_EMAIL'] = new GmailEmailHealthCheckDriver();

@Module({
  imports: [QueueModule],
  controllers: [NotificationsController, EmailTemplateController],
  providers: [NotificationsService, EmailTemplateService],
  exports: [NotificationsService, EmailTemplateService],
})
export class NotificationsModule {}
