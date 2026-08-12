import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApplicationStage, OfferStatus, WorkflowInstanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow.service';
import { SignatureProviderRegistry } from '../signatures/signature-provider.registry';
import { DOCUSIGN_PROVIDER_CODE } from '../signatures/providers/docusign.provider';

interface CreateOfferDto {
  jobApplicationId: string;
  jobTitle: string;
  gradeLevel?: string;
  proposedSalary: number;
  currency?: string;
  startDate?: string;
  /**
   * Digital Signature Providers, Checkpoint M. Which registered
   * SignatureProvider (see SignatureProviderRegistry) this offer's
   * envelope should go through — e.g. ADOBE_SIGN, GENERIC_SIGNATURE, or
   * DOCUSIGN_PROVIDER_CODE explicitly. Optional: omitting it keeps the
   * exact pre-Checkpoint-M behavior (DOCUSIGN_PROVIDER_CODE). Not
   * validated against the registry here — same "best-effort, no
   * creation-time provider check" posture every other *ProviderCode
   * consumer in this codebase already takes (see trySendForSignature's
   * own isRegistered guard below); an offer can still be created even
   * if the chosen provider isn't currently registered, it just won't
   * sync until one is.
   */
  signatureProviderCode?: string;
}

/**
 * Offer letter generation is a plain-text render for now (returned as
 * letterUrl-ready content); swap in the docx/PDF template engine used
 * elsewhere in the ERP once one is wired up for HR documents.
 */
function renderOfferLetterText(offer: {
  jobTitle: string;
  gradeLevel: string | null;
  proposedSalary: unknown;
  currency: string;
  startDate: Date | null;
}, candidateName: string): string {
  return [
    `Dear ${candidateName},`,
    '',
    `We are pleased to offer you the position of ${offer.jobTitle}${offer.gradeLevel ? ` (${offer.gradeLevel})` : ''}.`,
    `Proposed compensation: ${offer.currency} ${offer.proposedSalary}.`,
    offer.startDate ? `Proposed start date: ${offer.startDate.toDateString()}.` : '',
    '',
    'Please confirm your acceptance of this offer.',
  ]
    .filter(Boolean)
    .join('\n');
}

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowEngineService,
    private readonly signatureProviders: SignatureProviderRegistry,
  ) {}

  async create(dto: CreateOfferDto, createdById: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: dto.jobApplicationId },
      include: { offer: true, vacancy: true },
    });
    if (!app) throw new NotFoundException(`Application ${dto.jobApplicationId} not found`);
    if (app.offer) throw new ConflictException('An offer already exists for this application');
    if (dto.proposedSalary <= 0) throw new BadRequestException('proposedSalary must be positive');

    return this.prisma.offer.create({
      data: {
        jobApplicationId: dto.jobApplicationId,
        jobTitle: dto.jobTitle,
        gradeLevel: dto.gradeLevel,
        proposedSalary: dto.proposedSalary,
        currency: dto.currency ?? 'NGN',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        createdById,
        status: OfferStatus.DRAFT,
        // Digital Signature Providers, Checkpoint M — recorded at
        // creation (not only after a successful send, as this field's
        // pre-Checkpoint-M semantics were) so send()/retrySignatureSync()
        // both know which provider to target without needing a dto at
        // that later call site. Defaults to DOCUSIGN_PROVIDER_CODE,
        // preserving every pre-Checkpoint-M offer's actual behavior for
        // callers who don't pass signatureProviderCode explicitly.
        signatureProviderCode: dto.signatureProviderCode ?? DOCUSIGN_PROVIDER_CODE,
      },
    });
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { jobApplication: { include: { candidate: true, vacancy: true } } },
    });
    if (!offer) throw new NotFoundException(`Offer ${id} not found`);
    return offer;
  }

  /** Submits the offer into the Workflow Engine (e.g. compensation-band approval). */
  async submitForApproval(id: string, userId: string) {
    const offer = await this.findOne(id);
    if (offer.status !== OfferStatus.DRAFT) {
      throw new ConflictException(`Only DRAFT offers can be submitted (current status: ${offer.status})`);
    }

    const instance = await this.workflow.startInstance(
      {
        workflowCode: 'RECRUITMENT_OFFER',
        entityType: 'Offer',
        entityId: offer.id,
        context: { amount: Number(offer.proposedSalary), entityId: offer.jobApplication.vacancy.entityId },
      },
      userId,
    );

    return this.prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.PENDING_APPROVAL, workflowInstanceId: instance.id },
    });
  }

  async refreshApproval(id: string) {
    const offer = await this.findOne(id);
    if (!offer.workflowInstanceId) return offer;
    const instance = await this.workflow.getInstance(offer.workflowInstanceId);
    if (instance.status === WorkflowInstanceStatus.APPROVED && offer.status !== OfferStatus.APPROVED) {
      return this.prisma.offer.update({ where: { id }, data: { status: OfferStatus.APPROVED } });
    }
    if (
      (instance.status === WorkflowInstanceStatus.REJECTED || instance.status === WorkflowInstanceStatus.RETURNED) &&
      offer.status !== OfferStatus.WITHDRAWN
    ) {
      return this.prisma.offer.update({ where: { id }, data: { status: OfferStatus.WITHDRAWN } });
    }
    return offer;
  }

  /** Generates the offer letter text, sends it for e-signature (best-effort), and marks the offer SENT. */
  async send(id: string) {
    const offer = await this.findOne(id);
    if (offer.status !== OfferStatus.APPROVED) {
      throw new ConflictException('Only an APPROVED offer can be sent');
    }
    const candidate = offer.jobApplication.candidate;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const letterText = renderOfferLetterText(offer, candidateName);

    const updated = await this.prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.SENT, sentAt: new Date() },
    });
    await this.prisma.jobApplication.update({
      where: { id: offer.jobApplicationId },
      data: { stage: ApplicationStage.OFFER },
    });

    // E-signature send (Digital Signature Providers, Checkpoint C) —
    // best-effort, same shape as InterviewService.schedule()'s calendar
    // sync and CandidateService.upsertCandidate()'s contacts sync: a
    // DocuSign API failure must never lose the offer state already
    // persisted above (the candidate still needs their offer letter,
    // signature-tracking or not).
    //
    // Uses `offer.signatureProviderCode` (from the findOne() read above),
    // not `updated.signatureProviderCode` — the update() call just above
    // only sets status/sentAt, so it never touches this column; sourcing
    // it from the row we already have avoids depending on the update
    // call's return value echoing back a field it didn't write.
    const synced = await this.trySendForSignature(
      updated.id,
      letterText,
      candidate.email,
      candidateName,
      offer.signatureProviderCode,
    );

    return { ...(synced ?? updated), letterText };
  }

  /**
   * Best-effort e-signature send for a just-sent offer. Returns the
   * updated offer row (with signatureProviderEnvelopeId/
   * signatureProviderCode set) on success, or undefined if sync was
   * skipped/failed — send()'s caller falls back to the pre-sync row it
   * already has, same contract InterviewService.trySyncCreate/
   * CandidateService.trySyncContactCreate both have.
   *
   * Digital Signature Providers, Checkpoint M — provider-selectable.
   * `providerCode` is whatever create() persisted onto the offer
   * (caller-chosen, or DOCUSIGN_PROVIDER_CODE by default — see
   * CreateOfferDto's own doc comment); falls back to
   * DOCUSIGN_PROVIDER_CODE here too for any offer row created before
   * this checkpoint, where the column is still null. This replaces the
   * previous hardcoded-to-DOCUSIGN_PROVIDER_CODE behavior Checkpoint C
   * originally shipped — see signatures.module.ts's own Checkpoint K
   * doc comment for why that hardcoding was left as explicitly flagged
   * future work rather than solved incidentally by Checkpoint F merely
   * adding a second provider to the registry.
   *
   * Sent as text/plain (not application/pdf) — renderOfferLetterText
   * really does only produce plain text (see its own doc comment: "swap
   * in the docx/PDF template engine ... once one is wired up"), so
   * documentName ends in .txt to match what's actually being sent
   * rather than mislabeling it as a PDF DocuSignProvider.inferExtension
   * would otherwise default unrecognized content types to.
   */
  private async trySendForSignature(
    offerId: string,
    letterText: string,
    candidateEmail: string,
    candidateName: string,
    providerCode: string | null,
  ) {
    const resolvedProviderCode = providerCode ?? DOCUSIGN_PROVIDER_CODE;
    if (!this.signatureProviders.isRegistered(resolvedProviderCode)) return undefined;

    try {
      const provider = this.signatureProviders.get(resolvedProviderCode);
      const result = await provider.sendForSignature({
        documentName: `offer-letter-${offerId}.txt`,
        documentBuffer: Buffer.from(letterText, 'utf-8'),
        documentContentType: 'text/plain',
        signers: [{ email: candidateEmail, name: candidateName }],
        subject: 'Your offer letter — please sign',
      });

      return await this.prisma.offer.update({
        where: { id: offerId },
        data: {
          signatureProviderCode: resolvedProviderCode,
          signatureProviderEnvelopeId: result.providerEnvelopeId,
          signatureSyncFailedAt: null,
        },
      });
    } catch (err) {
      this.logger.warn(`Sent offer ${offerId} but could not send it for e-signature: ${(err as Error).message}`);
      await this.tryMarkSignatureSyncFailed(offerId);
      return undefined;
    }
  }

  /**
   * Best-effort persistence of the signature-sync failure flag itself,
   * isolated from the try/catch it's called from — same reasoning
   * InterviewService.tryMarkSyncFailed / CandidateService.tryMarkContactsSyncFailed
   * both give: if THIS update also fails, it must not throw past a
   * caller that has already decided to swallow the original error.
   */
  private async tryMarkSignatureSyncFailed(offerId: string): Promise<void> {
    try {
      await this.prisma.offer.update({ where: { id: offerId }, data: { signatureSyncFailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Could not persist signatureSyncFailedAt for offer ${offerId}: ${(err as Error).message}`);
    }
  }

  /**
   * The list backing recruitment's "needs attention" widget's
   * signature-sync half — same role InterviewService.findWithFailedCalendarSync/
   * CandidateService.findWithFailedContactSync play for their own sync
   * types. Not yet wired into DashboardService/DashboardController —
   * that's a later checkpoint, the same split Checkpoint T (Teams sync)
   * and Checkpoint U (its dashboard wiring) had.
   */
  findWithFailedSignatureSync() {
    return this.prisma.offer.findMany({
      where: { signatureSyncFailedAt: { not: null } },
      select: { id: true, jobTitle: true, status: true, sentAt: true, signatureSyncFailedAt: true },
      orderBy: { signatureSyncFailedAt: 'desc' },
    });
  }

  /**
   * Digital Signature Providers, Checkpoint E — manual retry for a
   * failed signature send, same "give a human a direct action instead
   * of re-sending automatically" reasoning retryCalendarSync/
   * retryContactSync/retryDirectorySync each give for their own domain.
   *
   * Single-shape unlike retryCalendarSync's/retryContactSync's own
   * two-branch structure (never-synced vs. failed-update): the only
   * place signatureSyncFailedAt is ever set is trySendForSignature's own
   * catch block, and that only runs when sendForSignature itself threw —
   * meaning signatureProviderEnvelopeId is always still null whenever
   * this flag is set. voidEnvelope is only ever reached via withdraw()'s
   * own separate envelope-guard (Checkpoint G), never from this retry
   * path, so signatureProviderEnvelopeId and signatureSyncFailedAt
   * remain mutually exclusive in every state retrySignatureSync itself
   * can observe, the identical
   * situation retryDirectorySync's own doc comment describes for
   * directoryUserId/directorySyncFailedAt. Guarded explicitly below
   * instead of silently mis-retrying as a second send — the same
   * defensive choice retryDirectorySync makes, and consistent with
   * SignatureProvider's own doc comment on why it has no updateEnvelope
   * (an in-flight envelope is immutable once sent).
   */
  async retrySignatureSync(id: string) {
    const offer = await this.findOne(id);
    if (!offer.signatureSyncFailedAt) {
      throw new BadRequestException(`Offer ${id} has no failed signature sync to retry`);
    }
    if (offer.signatureProviderEnvelopeId) {
      throw new ConflictException(
        `Offer ${id} already has a signature envelope (${offer.signatureProviderEnvelopeId}); no update/void retry path exists yet`,
      );
    }

    const candidate = offer.jobApplication.candidate;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const letterText = renderOfferLetterText(offer, candidateName);

    // Digital Signature Providers, Checkpoint M — retries against the
    // SAME provider the original (failed) send targeted, read straight
    // off the offer row (create() persisted it, unchanged by a failed
    // attempt — see trySendForSignature's own doc comment), rather than
    // always retrying against DOCUSIGN_PROVIDER_CODE regardless of what
    // was actually requested.
    const synced = await this.trySendForSignature(id, letterText, candidate.email, candidateName, offer.signatureProviderCode);
    if (!synced) {
      throw new ConflictException(`Signature sync retry failed for offer ${id}`);
    }
    return { ...synced, letterText };
  }

  /** Candidate portal: accept/decline the offer. */
  async respond(id: string, accepted: boolean, declineReason?: string) {
    const offer = await this.findOne(id);
    if (offer.status !== OfferStatus.SENT) {
      throw new ConflictException('Only a SENT offer can be responded to');
    }
    return this.prisma.offer.update({
      where: { id },
      data: {
        status: accepted ? OfferStatus.ACCEPTED : OfferStatus.DECLINED,
        respondedAt: new Date(),
        declineReason: accepted ? undefined : declineReason,
      },
    });
  }

  /**
   * Digital Signature Providers, Checkpoint L — closes the gap left
   * since Checkpoint C: nothing previously observed a candidate actually
   * completing (or declining) the DocuSign/Adobe Sign envelope itself —
   * respond() above is the ONLY path that has ever moved an offer to
   * ACCEPTED/DECLINED, and it requires a caller (the candidate portal,
   * presumably) to invoke it directly. This method is the bridge: it
   * asks the provider for the envelope's actual current state and, if
   * the provider reports the signer completed or declined it, applies
   * the identical transition respond() would have made — same status
   * values, same respondedAt/declineReason semantics, so a candidate who
   * signs via the provider's own UI ends up in exactly the same state a
   * candidate who called POST /offers/:id/respond directly would.
   *
   * Pull-only (a human/schedule calls this), not a webhook — see
   * PaystackWebhookHandler's own doc comment for the shape a
   * provider-push equivalent would need if a later checkpoint adds one;
   * this checkpoint deliberately mirrors TransferProvider's own
   * verifyTransfer (pull) landing before a push mechanism did, not the
   * other way around.
   *
   * SIGNED -> ACCEPTED, DECLINED -> DECLINED (declineReason set to a
   * fixed marker string, since neither DocuSign nor Adobe Sign's own
   * SignatureStatusResult carries a free-text decline reason a signer
   * typed — see signature-provider.interface.ts's own SignatureStatus
   * union). SENT (still outstanding) is a no-op: returns the offer
   * unchanged with the raw provider status attached for visibility.
   * VOIDED/EXPIRED are deliberately NOT mapped to anything here — an
   * envelope reaching either of those states via the provider's own UI
   * (rather than this codebase's own withdraw()) is an edge case left
   * unhandled for a later checkpoint to decide the right local status
   * for, the same "flagged, not silently guessed at" posture this
   * codebase takes elsewhere (see PaystackWebhookHandler's own KNOWN
   * LIMITATION note for the precedent).
   *
   * FIX (FC-6.3): this comment's own first line said "SIGNED ->
   * ACCEPTED", and the method below matched that literally — but
   * `SignatureStatus` (signature-provider.interface.ts) has no `'SIGNED'`
   * member at all (`'SENT' | 'DELIVERED' | 'COMPLETED' | 'DECLINED' |
   * 'VOIDED'`), a real, independent (non-Prisma-cascading) compile error
   * FC-6.1's own report named and left for a later checkpoint. Confirmed
   * `'COMPLETED'` is the actually-intended value directly against
   * `DocuSignProvider.mapDocuSignStatus`'s own switch (`case 'completed':
   * return 'COMPLETED'`), not guessed from the type union alone — a
   * signed envelope was never actually being detected here before this
   * fix, meaning `checkSignatureStatus` could never auto-accept an offer
   * on a genuinely completed signature; a caller would have had to fall
   * through to `respond()` directly instead.
   *
   * Only meaningful for a SENT offer with an outstanding envelope — an
   * offer already ACCEPTED/DECLINED/WITHDRAWN locally has nothing left
   * to reconcile, and one that was never sent for signature
   * (signatureProviderEnvelopeId null) has no envelope to check at all.
   * Both are ConflictException, not silent no-ops, so a caller doesn't
   * mistake "nothing to check" for "checked, still outstanding".
   */
  async checkSignatureStatus(id: string) {
    const offer = await this.findOne(id);
    if (!offer.signatureProviderEnvelopeId || !offer.signatureProviderCode) {
      throw new ConflictException(`Offer ${id} has no outstanding signature envelope to check`);
    }
    if (offer.status !== OfferStatus.SENT) {
      throw new ConflictException(`Offer ${id} is ${offer.status}, not SENT — nothing to reconcile against the signature provider`);
    }

    const provider = this.signatureProviders.get(offer.signatureProviderCode);
    const result = await provider.getStatus(offer.signatureProviderEnvelopeId);

    if (result.status === 'COMPLETED') {
      const updated = await this.respond(id, true);
      return { ...updated, providerStatus: result.status };
    }
    if (result.status === 'DECLINED') {
      const updated = await this.respond(id, false, 'Declined via signature provider');
      return { ...updated, providerStatus: result.status };
    }

    return { ...offer, providerStatus: result.status };
  }

  /**
   * Digital Signature Providers, Checkpoint G — void the outstanding
   * envelope on withdrawal, the same pairing InterviewService.cancel()
   * has with its own calendarEventId-guarded cancelEvent call (schedule
   * pairs with create-sync, cancel pairs with cancelEvent; send() pairs
   * with trySendForSignature, withdraw() pairs with voidEnvelope here).
   * Best-effort, same reasoning as every sync call in this file: a
   * SignatureProvider failure must never block the withdrawal itself —
   * the offer row is already updated above by the time this runs.
   *
   * Guarded on signatureProviderEnvelopeId alone (no signatureSyncFailedAt
   * check, unlike retrySignatureSync) — an offer can be withdrawn
   * regardless of whether its last sync attempt succeeded, same as
   * InterviewService.cancel() only checks calendarEventId, not
   * calendarSyncFailedAt.
   */
  async withdraw(id: string) {
    const offer = await this.findOne(id);
    const updated = await this.prisma.offer.update({ where: { id }, data: { status: OfferStatus.WITHDRAWN } });

    if (offer.signatureProviderEnvelopeId && offer.signatureProviderCode) {
      try {
        const provider = this.signatureProviders.get(offer.signatureProviderCode);
        await provider.voidEnvelope({ providerEnvelopeId: offer.signatureProviderEnvelopeId, reason: 'Offer withdrawn' });
      } catch (err) {
        this.logger.warn(
          `Withdrew offer ${id} but could not void its signature envelope ${offer.signatureProviderEnvelopeId}: ${(err as Error).message}`,
        );
      }
    }

    return updated;
  }

  findForApplication(jobApplicationId: string) {
    return this.prisma.offer.findUnique({ where: { jobApplicationId } });
  }
}
