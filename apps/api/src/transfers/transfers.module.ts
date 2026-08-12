import { Module } from '@nestjs/common';
import { TransferProviderRegistry } from './transfer-provider.registry';
import { BankTransferService } from './bank-transfer.service';
import { BankTransferController } from './bank-transfer.controller';
import { PaystackTransferProvider } from './providers/paystack-transfer.provider';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Checkpoint A. Registry only, same minimal shape every other provider
 * domain in this codebase started with — no controller, no concrete
 * provider, no Prisma model yet. A concrete provider (Paystack
 * Transfers, Flutterwave Transfers, or a dedicated bank-transfer API)
 * self-registers into TransferProviderRegistry via its own
 * onModuleInit() in a later checkpoint, the same way every other
 * concrete provider in this codebase does.
 *
 * Checkpoint B adds the BankTransfer Prisma model (see the migration's
 * own comment for the idempotency guarantee) and BankTransferService —
 * record management only, deliberately not calling
 * TransferProviderRegistry yet since nothing is registered into it
 * until a later checkpoint. Same "model + minimal service in the same
 * checkpoint" granularity MonoLinkedAccount's own Checkpoint C used.
 *
 * Checkpoint C adds BankTransferController — the reachability gap
 * Checkpoint B's own service left open. Still no provider wiring; see
 * BankTransferController's own doc comment for exactly what is and
 * isn't exposed as a route.
 *
 * Checkpoint D adds the first concrete TransferProvider —
 * PaystackTransferProvider, reusing the existing Paystack payment
 * credential row rather than a new one (see that file's own doc
 * comment). BankTransferService itself still does NOT call
 * TransferProviderRegistry — this checkpoint only makes a provider
 * available to be orchestrated by a later checkpoint, the same
 * "provider exists before its first caller" sequencing Tasks/Contacts/
 * Calendar all followed in Release IG.1.
 *
 * Checkpoint E wires BankTransferService.initiateTransfer() to actually
 * call TransferProviderRegistry — see that method's own doc comment for
 * why it's a separate call from createRecord() rather than folded into
 * it, and for why provider failures are re-thrown rather than swallowed
 * (unlike this codebase's other best-effort integration-sync patterns).
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [BankTransferController],
  providers: [TransferProviderRegistry, BankTransferService, PaystackTransferProvider],
  exports: [TransferProviderRegistry, BankTransferService],
})
export class TransfersModule {}
