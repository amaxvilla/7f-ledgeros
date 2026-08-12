import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ManualSignatureStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.interface';
import { UploadedFileLike } from '../admin-branding/admin-branding.service';

const TERMINAL_STATUSES: ManualSignatureStatus[] = [
  ManualSignatureStatus.COMPLETED,
  ManualSignatureStatus.DECLINED,
  ManualSignatureStatus.VOIDED,
];

/**
 * Digital Signature Providers, Checkpoint I — the manual-completion path
 * GenericSignatureProvider's own doc comment (Checkpoint H) flagged as
 * necessary follow-on work: without it, every envelope that provider
 * creates was permanently stuck at SENT, since nothing in this codebase
 * could move a row past that state.
 *
 * Deliberately a separate service from GenericSignatureProvider itself
 * rather than new methods on it: SignatureProvider's own interface has
 * no "complete"/"decline" concept (every vendor-backed provider must
 * also satisfy that interface, and DocuSign/Adobe Sign have no such
 * operation — their equivalent is a signer acting in the vendor's own
 * UI, observed here only via getStatus's polling). This service is
 * purely an internal HR/ops action on a manual-envelope row, addressed
 * directly by its id, the same way AdminBrandingService.uploadBrandAsset
 * uses StorageProvider directly for a file this codebase's own upload
 * flow owns rather than routing a plain file upload through an
 * abstraction built for a different purpose.
 *
 * Only handles completion (uploading the countersigned copy) as of
 * Checkpoint I. Checkpoint J adds the corresponding decline action below
 * — a candidate can refuse to sign just as easily as they could decline
 * in DocuSign/Adobe Sign's own UI (mapDocuSignStatus/AdobeSignProvider's
 * own status-mapping both already handle a vendor-reported DECLINED;
 * a manual envelope had no equivalent until now).
 */
@Injectable()
export class ManualSignatureService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async findEnvelope(id: string) {
    const envelope = await this.prisma.manualSignatureEnvelope.findUnique({ where: { id } });
    if (!envelope) {
      throw new NotFoundException(`Manual signature envelope ${id} not found`);
    }
    return envelope;
  }

  /**
   * Checkpoint L — the register list findEnvelope's own doc comment
   * (and several Frontend Completion checkpoints' own reports) flagged
   * as missing: a way to discover which envelope ids exist at all,
   * rather than requiring one already in hand. No entityId/dimension
   * param — see ListManualSignatureEnvelopesQueryDto's own doc comment
   * for why this model has none to filter or RLS-scope by. Newest
   * first, the same default ordering AR/AP's own invoice lists use.
   */
  findAll(status?: ManualSignatureStatus) {
    return this.prisma.manualSignatureEnvelope.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Uploads the countersigned copy via StorageProvider (same as
   * GenericSignatureProvider.sendForSignature's own outgoing-document
   * upload) and moves the row to COMPLETED. Rejects a SENT/DELIVERED ->
   * (any terminal state) transition attempted twice — an envelope
   * already COMPLETED, DECLINED, or VOIDED has nothing left to complete,
   * the same "don't silently re-apply a terminal state change" guard
   * retrySignatureSync's own doc comment gives for signatureProviderEnvelopeId.
   */
  async recordCompletion(id: string, file: UploadedFileLike) {
    const envelope = await this.findEnvelope(id);
    if (TERMINAL_STATUSES.includes(envelope.status)) {
      throw new ConflictException(`Manual signature envelope ${id} is already ${envelope.status}; nothing to complete`);
    }

    const uploaded = await this.storage.upload({
      key: `signatures/manual/${id}/signed-${file.originalname}`,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return this.prisma.manualSignatureEnvelope.update({
      where: { id },
      data: { signedDocumentKey: uploaded.key, status: ManualSignatureStatus.COMPLETED },
    });
  }

  /**
   * Digital Signature Providers, Checkpoint J — the "record a decline"
   * counterpart to recordCompletion, same SENT/DELIVERED-only guard and
   * same reasoning: an envelope already in a terminal state has nothing
   * left to decline. No file upload here — a decline has no document to
   * attach, unlike a completion.
   */
  async recordDecline(id: string, reason?: string) {
    const envelope = await this.findEnvelope(id);
    if (TERMINAL_STATUSES.includes(envelope.status)) {
      throw new ConflictException(`Manual signature envelope ${id} is already ${envelope.status}; nothing to decline`);
    }

    return this.prisma.manualSignatureEnvelope.update({
      where: { id },
      data: { status: ManualSignatureStatus.DECLINED, declineReason: reason },
    });
  }
}
