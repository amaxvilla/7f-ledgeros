import { Module } from '@nestjs/common';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentWebhookHandlerRegistry } from './payment-webhook-handler.registry';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaystackProvider } from './providers/paystack.provider';
import { PaystackWebhookHandler } from './providers/paystack-webhook.handler';
import { PaystackHealthCheckDriver } from './providers/paystack-health-check.driver';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { FlutterwaveWebhookHandler } from './providers/flutterwave-webhook.handler';
import { FlutterwaveHealthCheckDriver } from './providers/flutterwave-health-check.driver';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';

// Release IE.2, Checkpoint A — registers Paystack's credential-validation
// driver into Release IA's INTEGRATION_DRIVER_REGISTRY (after SMTP,
// MS_GRAPH_EMAIL, GMAIL_EMAIL, TWILIO, WHATSAPP_CLOUD), same
// module-load-time pattern sms.module.ts/whatsapp.module.ts use — this
// class is stateless (no constructor deps), so it doesn't need Nest DI.
INTEGRATION_DRIVER_REGISTRY['PAYSTACK'] = new PaystackHealthCheckDriver();
// Release IE.3, Checkpoint A — same pattern, for Flutterwave.
INTEGRATION_DRIVER_REGISTRY['FLUTTERWAVE'] = new FlutterwaveHealthCheckDriver();

/**
 * Release IE.1. Checkpoint B added just the outbound registry.
 * Checkpoint D added the synchronous service/controller that actually
 * calls into it and persists PaymentTransaction/PaymentRefund rows.
 * Checkpoint E added the background reconciliation queue/worker on top
 * of verifyPayment(). Checkpoint F added PaymentWebhookHandlerRegistry.
 * Checkpoint F2 added PaymentWebhookController.
 *
 * Release IE.2, Checkpoint A adds the first concrete provider —
 * PaystackProvider — as a real Nest provider (constructor-injecting
 * IntegrationsService + PaymentProviderRegistry) rather than a
 * module-load-time object, self-registering via onModuleInit().
 * Checkpoint B implemented initializePayment; Checkpoint C implemented
 * verifyPayment; Checkpoint E implemented refundPayment — all three
 * PaymentProvider methods are now real, nothing left stubbed.
 * Checkpoint D adds PaystackWebhookHandler, self-registering into
 * PaymentWebhookHandlerRegistry the identical way — PaymentWebhookController
 * (already built in IE.1, Checkpoint F2) now has a real handler to
 * resolve for providerCode "PAYSTACK" instead of throwing.
 * Release IE.3, Checkpoint A adds the second concrete provider —
 * FlutterwaveProvider — as a skeleton: registered, config-resolving,
 * credential-validated, but its four PaymentProvider methods started as
 * stubs (Checkpoints C/F/G filled in verifyPayment/refundPayment/
 * verifyRefund respectively). Checkpoint B implements initializePayment;
 * Checkpoint C implements verifyPayment. Checkpoint D adds
 * FlutterwaveWebhookHandler (charge events only — refund events are a
 * later checkpoint, same split PaystackWebhookHandler's own D/E had),
 * self-registering into PaymentWebhookHandlerRegistry the identical way
 * — PaymentWebhookController now has a real handler to resolve for
 * providerCode "FLUTTERWAVE" instead of throwing. Checkpoint F
 * implements refundPayment (resolving Flutterwave's own numeric
 * transaction id via a verify_by_reference call first, then calling its
 * refund endpoint — see FlutterwaveProvider.refundPayment's own doc
 * comment). Checkpoint G implements verifyRefund (GET /refunds/:id,
 * keyed directly by the refund id refundPayment already returns) — all
 * four PaymentProvider methods are now real for Flutterwave too.
 * Checkpoint H adds refund-event parsing to FlutterwaveWebhookHandler
 * (refund.* events), the same charge/refund split
 * PaystackWebhookHandler's own D/E had — FlutterwaveWebhookHandler now
 * understands both charge- and refund-shaped events, matching
 * PaystackWebhookHandler's own scope exactly.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [
    PaymentProviderRegistry,
    PaymentWebhookHandlerRegistry,
    PaymentsService,
    PaystackProvider,
    PaystackWebhookHandler,
    FlutterwaveProvider,
    FlutterwaveWebhookHandler,
  ],
  controllers: [PaymentsController, PaymentWebhookController],
  exports: [PaymentProviderRegistry, PaymentWebhookHandlerRegistry, PaymentsService],
})
export class PaymentsModule {}
