import { Module } from '@nestjs/common';
import { SignatureProviderRegistry } from './signature-provider.registry';
import { DocuSignProvider } from './providers/docusign.provider';
import { AdobeSignProvider } from './providers/adobe-sign.provider';
import { GenericSignatureProvider } from './providers/generic-signature.provider';
import { ManualSignatureService } from './manual-signature.service';
import { SignaturesController } from './signatures.controller';
import { SignatureService } from './signature.service';
import { SignatureController } from './signature.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { StorageModule } from '../storage/storage.module';

/**
 * Digital Signature Providers, Checkpoint A. Registry only, same
 * minimal shape CalendarModule/ContactsModule/BankIntegrationModule/
 * TransfersModule all started with at their own Checkpoint A.
 *
 * Checkpoint B added the first concrete provider — DocuSignProvider — as
 * a real Nest provider (constructor-injecting IntegrationsService +
 * SignatureProviderRegistry) self-registering via onModuleInit(),
 * exactly like every other concrete provider in this codebase. Checkpoint
 * F added AdobeSignProvider the same way — see that provider's own doc
 * comment for why it needs its own dedicated IntegrationProvider row and
 * why its send flow is a two-step transientDocument-then-agreement call
 * unlike DocuSignProvider's single create-envelope call. Checkpoint H
 * added GenericSignatureProvider as a third registered provider — see its
 * own doc comment for why it needs StorageModule (not IntegrationsModule)
 * for its dependencies, having no external vendor of its own. Checkpoint
 * I adds ManualSignatureService/SignaturesController — the manual-
 * completion path Checkpoint H's own doc comment flagged as missing —
 * as this module's first controller.
 *
 * Checkpoint K adds SignatureService/SignatureController — the generic,
 * provider-selectable passthrough layer PowerBiService/WorkspaceAdminService
 * already gave their own domains, exposing sendForSignature/getStatus/
 * downloadSignedDocument/voidEnvelope directly. This does NOT replace
 * recruitment/offer.service.ts's own existing, still-hardcoded
 * DOCUSIGN_PROVIDER_CODE flow (Checkpoint C) — the two coexist, the same
 * relationship CandidateService's hardcoded Outlook sync has to the
 * generic ContactsService. Making OfferService itself provider-selectable
 * remains a separate, later checkpoint.
 *
 * Checkpoint L adds ManualSignatureService.findAll +
 * SignaturesController's new GET (list) route — no new provider, no new
 * controller, so no change to this module's own providers/controllers
 * arrays below. See ListManualSignatureEnvelopesQueryDto's own doc
 * comment for why it has no entityId filter.
 *
 * Checkpoint M closes the gap this doc comment itself used to flag:
 * OfferService (recruitment/offer.service.ts) is now provider-selectable
 * — CreateOfferDto.signatureProviderCode lets a caller pick any
 * registered SignatureProvider at offer-creation time, defaulting to
 * DOCUSIGN_PROVIDER_CODE for unchanged pre-Checkpoint-M behavior. No
 * change to this module itself (no new provider, no new controller) —
 * see OfferService's own doc comments for the actual change.
 */
@Module({
  imports: [IntegrationsModule, StorageModule],
  controllers: [SignaturesController, SignatureController],
  providers: [SignatureProviderRegistry, DocuSignProvider, AdobeSignProvider, GenericSignatureProvider, ManualSignatureService, SignatureService],
  exports: [SignatureProviderRegistry],
})
export class SignaturesModule {}
