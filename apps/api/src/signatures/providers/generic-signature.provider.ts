import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ManualSignatureStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../../storage/storage.interface';
import { SignatureProviderRegistry } from '../signature-provider.registry';
import {
  SendForSignatureParams,
  SendForSignatureResult,
  SignatureProvider,
  SignatureStatus,
  SignatureStatusResult,
  VoidEnvelopeParams,
} from '../signature-provider.interface';

export const GENERIC_SIGNATURE_PROVIDER_CODE = 'GENERIC_SIGNATURE';

/**
 * Digital Signature Providers, Checkpoint H — the third SignatureProvider,
 * and the "Generic Signature Provider" named in this codebase's own
 * roadmap alongside DocuSign (Checkpoint B) and Adobe Sign (Checkpoint F).
 * Registers into the same SignatureProviderRegistry those two do;
 * OfferService (Checkpoint C's caller) is still hardcoded to
 * DOCUSIGN_PROVIDER_CODE — making it provider-selectable remains a later
 * checkpoint, same as Checkpoint F's own doc comment says for itself.
 *
 * WHY THIS ONE HAS NO IntegrationsService/IntegrationProvider ROW, UNLIKE
 * ITS TWO SIBLINGS: DocuSignProvider and AdobeSignProvider each wrap a
 * real vendor API and need vendor credentials resolved via
 * IntegrationsService. This provider wraps no vendor at all — it exists
 * for entities/environments that haven't (or won't) stand up a DocuSign
 * or Adobe Sign account, and instead track signature completion the way
 * paper-and-courier HR already worked before either vendor existed: send
 * the document out by hand (email, printed, whatever the caller's own
 * delivery step already does with the returned document URL), then a
 * human later records that it came back signed. There is no vendor
 * status to poll, so THIS provider has to be the system of record for
 * envelope state itself — hence the new ManualSignatureEnvelope table
 * (prisma/schema.prisma) this class reads and writes directly via
 * PrismaService, the same direct-Prisma-access shape
 * NotificationsService itself uses for its own delivery-log bookkeeping,
 * rather than going through a further abstraction for a table this
 * provider is the only writer of.
 *
 * WHY IT USES StorageProvider, NOT A Bytes COLUMN: this codebase has no
 * existing precedent for storing file content directly in Postgres, and
 * already has a vendor-agnostic file abstraction for exactly this
 * (StorageProvider, storage/storage.interface.ts) — used here for both
 * the outgoing document (sendForSignature's documentBuffer) and, once a
 * human uploads one, the countersigned copy. STORAGE_PROVIDER is
 * whichever concrete disk/S3/Drive provider StorageModule's own
 * factory currently resolves to (see that module's own doc comment) —
 * this class has no opinion on which.
 *
 * WHAT THIS CHECKPOINT DELIBERATELY DOES NOT ADD: any way for a human to
 * actually record that a document came back signed (no "markCompleted"/
 * "uploadSignedCopy" method exists anywhere — not on SignatureProvider,
 * which every vendor-backed provider must also satisfy and which has no
 * such concept; not a new endpoint here either). Without one, every
 * envelope this provider creates is permanently stuck at SENT once
 * created — getStatus/downloadSignedDocument/voidEnvelope below are
 * fully real against the table, but nothing in this codebase can ever
 * move a row past SENT yet. That completion path is real, necessary,
 * follow-on work for a later checkpoint (the same "provider before
 * caller"/"one piece at a time" sequencing DocuSignProvider's own doc
 * comment used — a provider landing before anything can fully exercise
 * it is this codebase's established pattern, not a defect here).
 *
 * UPDATE (Checkpoint I): that completion path now exists —
 * ManualSignatureService.recordCompletion (manual-signature.service.ts),
 * exposed via SignaturesController's `POST
 * signatures/manual-envelopes/:id/complete`. Deliberately not a method
 * on this class — see that service's own doc comment for why.
 */
@Injectable()
export class GenericSignatureProvider implements SignatureProvider, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly registry: SignatureProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(GENERIC_SIGNATURE_PROVIDER_CODE, this);
  }

  async sendForSignature(params: SendForSignatureParams): Promise<SendForSignatureResult> {
    const envelope = await this.prisma.manualSignatureEnvelope.create({
      data: {
        documentName: params.documentName,
        documentContentType: params.documentContentType,
        // Placeholder key, replaced immediately below once the row's own
        // id exists — the upload key is namespaced by envelope id so two
        // envelopes for identically-named documents never collide.
        documentKey: '',
        signersJson: params.signers as unknown as object,
        subject: params.subject,
        message: params.message,
        status: ManualSignatureStatus.SENT,
      },
    });

    const uploaded = await this.storage.upload({
      key: `signatures/manual/${envelope.id}/${params.documentName}`,
      buffer: params.documentBuffer,
      contentType: params.documentContentType,
    });

    await this.prisma.manualSignatureEnvelope.update({
      where: { id: envelope.id },
      data: { documentKey: uploaded.key },
    });

    return { providerEnvelopeId: envelope.id };
  }

  async getStatus(providerEnvelopeId: string): Promise<SignatureStatusResult> {
    const envelope = await this.prisma.manualSignatureEnvelope.findUnique({ where: { id: providerEnvelopeId } });
    if (!envelope) {
      throw new Error(`No manual signature envelope found for id "${providerEnvelopeId}"`);
    }
    return { status: envelope.status as SignatureStatus };
  }

  /**
   * Only ever succeeds once a human has recorded a countersigned copy
   * (signedDocumentKey) — which, per this class's own doc comment above,
   * nothing in this codebase can do yet. Throws rather than falling back
   * to the original unsigned document, the same "don't silently hand
   * back the wrong thing" posture DocuSignProvider/AdobeSignProvider
   * take by surfacing a real HTTP error instead of a placeholder buffer.
   */
  async downloadSignedDocument(providerEnvelopeId: string): Promise<Buffer> {
    const envelope = await this.prisma.manualSignatureEnvelope.findUnique({ where: { id: providerEnvelopeId } });
    if (!envelope) {
      throw new Error(`No manual signature envelope found for id "${providerEnvelopeId}"`);
    }
    if (!envelope.signedDocumentKey) {
      throw new Error(`Manual signature envelope "${providerEnvelopeId}" has no signed document recorded yet`);
    }

    const url = await this.storage.getUrl(envelope.signedDocumentKey);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not retrieve signed document for envelope "${providerEnvelopeId}": HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async voidEnvelope(params: VoidEnvelopeParams): Promise<void> {
    const envelope = await this.prisma.manualSignatureEnvelope.findUnique({ where: { id: params.providerEnvelopeId } });
    if (!envelope) {
      throw new Error(`No manual signature envelope found for id "${params.providerEnvelopeId}"`);
    }
    await this.prisma.manualSignatureEnvelope.update({
      where: { id: params.providerEnvelopeId },
      data: { status: ManualSignatureStatus.VOIDED, voidReason: params.reason },
    });
  }
}
