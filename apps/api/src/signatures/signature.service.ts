import { Injectable } from '@nestjs/common';
import { SignatureProviderRegistry } from './signature-provider.registry';
import { Signer } from './signature-provider.interface';

/**
 * Digital Signature Providers, Checkpoint K.
 *
 * The piece SignatureProviderRegistry/DocuSignProvider/AdobeSignProvider/
 * GenericSignatureProvider were missing: something that actually calls
 * sendForSignature/getStatus/downloadSignedDocument/voidEnvelope.
 * Mirrors PowerBiService/WorkspaceAdminService exactly, including their
 * scope decision: no Prisma persistence here, and no opinion on which of
 * this codebase's documents should be sent for signature —
 * signature-provider.interface.ts's own design notes explicitly defer
 * that decision to whichever caller needs it.
 *
 * NOT a replacement for OfferService's own existing, hardcoded
 * DOCUSIGN_PROVIDER_CODE flow (recruitment/offer.service.ts, Checkpoint
 * C) — that caller keeps working exactly as it does today. This is a
 * second, provider-selectable entry point into the same registry, the
 * same "hardcoded domain caller and a separate generic passthrough
 * service coexist" relationship this codebase already has between
 * CandidateService's own hardcoded Outlook-contact sync and the generic
 * ContactsService, and between InterviewService's own hardcoded Teams/
 * Presence calls and TeamsService/PresenceService.
 *
 * Also NOT the same thing as ManualSignatureService/SignaturesController
 * (Checkpoint I/J) — that is the fallback path for when no real e-
 * signature provider is configured (a human signs on paper/PDF and
 * someone uploads proof); this service is for the real
 * DocuSign/Adobe Sign/GenericSignatureProvider-driven flow.
 */
@Injectable()
export class SignatureService {
  constructor(private readonly registry: SignatureProviderRegistry) {}

  sendForSignature(
    providerCode: string,
    params: { documentName: string; documentBuffer: Buffer; documentContentType: string; signers: Signer[]; subject?: string; message?: string },
  ) {
    return this.registry.get(providerCode).sendForSignature(params);
  }

  getStatus(providerEnvelopeId: string, providerCode: string) {
    return this.registry.get(providerCode).getStatus(providerEnvelopeId);
  }

  downloadSignedDocument(providerEnvelopeId: string, providerCode: string) {
    return this.registry.get(providerCode).downloadSignedDocument(providerEnvelopeId);
  }

  voidEnvelope(providerEnvelopeId: string, providerCode: string, reason?: string) {
    return this.registry.get(providerCode).voidEnvelope({ providerEnvelopeId, reason });
  }
}
