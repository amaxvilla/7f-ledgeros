import { Module } from '@nestjs/common';
import { BankProviderRegistry } from './bank-provider.registry';
import { MonoProvider } from './providers/mono.provider';
import { MonoHealthCheckDriver } from './providers/mono-health-check.driver';
import { MonoWebhookHandler } from './providers/mono-webhook.handler';
import { PaystackBankProvider } from './providers/paystack-bank.provider';
import { BankWebhookHandlerRegistry } from './bank-webhook-handler.registry';
import { BankWebhookController } from './bank-webhook.controller';
import { MonoLinkedAccountService } from './mono-linked-account.service';
import { MonoLinkedAccountController } from './mono-linked-account.controller';
import { BankAccountValidationController } from './bank-account-validation.controller';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BankReconciliationModule } from '../bank-reconciliation/bank-reconciliation.module';

// Release IF.1, Checkpoint B — same module-load-time registration pattern
// payments.module.ts uses for PAYSTACK/FLUTTERWAVE, after SMTP,
// MS_GRAPH_EMAIL, GMAIL_EMAIL, TWILIO, WHATSAPP_CLOUD.
INTEGRATION_DRIVER_REGISTRY['MONO'] = new MonoHealthCheckDriver();

/**
 * Release IF.1, Checkpoint A. Registry only, same minimal shape
 * PaymentsModule started with at its own Checkpoint B — no controller,
 * no concrete provider, no Prisma model yet. A concrete provider
 * (e.g. Mono/Okra/Stitch) in a later checkpoint self-registers into
 * BankProviderRegistry via its own onModuleInit(), the same way
 * PaystackProvider/FlutterwaveProvider do into PaymentProviderRegistry.
 *
 * Release IF.1, Checkpoint B adds the first concrete provider —
 * MonoProvider — as a real Nest provider (constructor-injecting
 * IntegrationsService + BankProviderRegistry) rather than a
 * module-load-time object, self-registering via onModuleInit(), exactly
 * like FlutterwaveProvider's own Checkpoint A. Its three BankProvider
 * methods are intentionally still stubs — see MonoProvider's own doc
 * comment for why (an architectural gap this checkpoint surfaced:
 * Mono needs a linked-account model that doesn't exist yet).
 *
 * Release IF.1, Checkpoint C adds that linked-account model
 * (MonoLinkedAccount, prisma/schema.prisma) plus the Mono Connect
 * code-exchange endpoint (MonoLinkedAccountController/Service) that
 * populates it. MonoProvider's own validateAccount/fetchStatement/
 * fetchBalance remain stubs — this checkpoint only adds the linking
 * step those methods will depend on in a later checkpoint (D+).
 *
 * Release IF.1, Checkpoint D implements MonoProvider's fetchStatement/
 * fetchBalance for real (see that file), but nothing consumed them yet.
 *
 * Release IF.1, Checkpoint E wires them up: MonoLinkedAccountService
 * gained getBalance()/importStatement(), the latter importing
 * BankReconciliationModule to reuse BankReconciliationService.importStatement
 * rather than a second BankStatement-creation path.
 *
 * Release IF.1, Checkpoint F closes the one gap Checkpoint E left
 * documented as outstanding: MonoProvider.validateAccount, re-scoped
 * (see that method's own doc comment) to mean "is this accountNumber
 * currently linked via an ACTIVE MonoLinkedAccount" rather than a
 * NIBSS-style arbitrary lookup Mono has no endpoint for. No new files —
 * this checkpoint only touches mono.provider.ts and its tests.
 *
 * Release IF.1, Checkpoint G adds inbound webhook handling — the
 * operational gap Checkpoint F's own checkpoint report named as the
 * recommended next step: a MonoLinkedAccount going stale
 * (reauthorisation required at Mono's end) had no way to surface itself
 * short of a failed statement pull. BankWebhookHandlerRegistry/
 * BankWebhookController/MonoWebhookHandler mirror the IE.1 Checkpoint
 * F/F2 payment-webhook framework's shape; MonoLinkStatus gained
 * REQUIRES_REAUTH (prisma/schema.prisma) and MonoLinkedAccountService
 * gained applyLinkStatusWebhookEvent() to set/clear it.
 *
 * (Checkpoints H/I/J — worker statement-sync, dashboard, and reporting
 * integration — live in apps/worker's mono-statement-sync.processor.ts,
 * dashboard.service.ts, and reporting.service.ts respectively; none of
 * them needed a change to this file, which is why this changelog skips
 * straight to the next entry below.)
 *
 * Release IF.2, Checkpoint A — Open Banking: real account validation.
 * PaystackBankProvider (providers/paystack-bank.provider.ts) closes the
 * gap MonoProvider.validateAccount's Checkpoint F re-scoping documented
 * as outstanding — resolving an arbitrary accountNumber+bankCode pair
 * to an account holder name via Paystack's bank/resolve endpoint,
 * reusing the SAME PAYMENT_PAYSTACK_PROVIDER_ID credential
 * payments/providers/paystack.provider.ts already resolves, not a new
 * IntegrationProvider row. Self-registers into BankProviderRegistry
 * under providerCode "PAYSTACK" — a bank-data-lookup entry, sharing the
 * vendor name with but functionally independent of the
 * payment-collection "PAYSTACK" entry in PaymentProviderRegistry (two
 * separate maps, not a collision). See that file's own doc comment for
 * the full reasoning, including why fetchStatement/fetchBalance are
 * deliberately left unimplemented for this provider.
 *
 * Release IF.2, Checkpoint B — Account Validation API endpoint.
 * Checkpoint A implemented PaystackBankProvider.validateAccount() for
 * real but this audit found nothing ever called it.
 * BankAccountValidationController (bank-account-validation.controller.ts)
 * is that missing caller: a thin POST /bank-integration/validate-account
 * pass-through to BankProviderRegistry.get(providerCode ?? 'PAYSTACK')
 * .validateAccount(), not a new validation mechanism. Deliberately its
 * own controller, not added to MonoLinkedAccountController — see that
 * file's own doc comment for why.
 */
@Module({
  imports: [IntegrationsModule, BankReconciliationModule],
  controllers: [MonoLinkedAccountController, BankWebhookController, BankAccountValidationController],
  providers: [BankProviderRegistry, MonoProvider, MonoLinkedAccountService, BankWebhookHandlerRegistry, MonoWebhookHandler, PaystackBankProvider],
  exports: [BankProviderRegistry, MonoProvider, MonoLinkedAccountService, BankWebhookHandlerRegistry, PaystackBankProvider],
})
export class BankIntegrationModule {}
