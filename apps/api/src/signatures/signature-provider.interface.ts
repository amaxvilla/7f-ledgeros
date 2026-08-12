/**
 * Vendor-agnostic e-signature abstraction (Digital Signature Providers,
 * Checkpoint A: abstraction only — following the exact same
 * abstraction-first progression CalendarProvider/ContactsProvider/
 * PresenceProvider/TransferProvider all started with in this codebase).
 *
 * Same role those interfaces play for their own domains: every caller
 * that needs a document signed depends on this interface, never on a
 * concrete DocuSignProvider (or a future AdobeSignProvider — this
 * codebase's roadmap explicitly names both as siblings, the same way
 * CalendarProvider's own doc comment named a future GoogleCalendarProvider
 * before one existed) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) SignatureProviderRegistry — no concrete provider, no
 * caller, no Prisma model yet. Checkpoint B
 * (providers/docusign.provider.ts) adds the first concrete provider,
 * DocuSignProvider — see that file's own doc comment for why it uses
 * the simpler OAuth2 refresh-token flow instead of DocuSign's own
 * recommended JWT Grant, and why it needs its own dedicated
 * IntegrationProvider row. Still no caller — that's a later checkpoint.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - No caller has been identified yet for what in this codebase should
 *    be sent for signature (Mortgage offer letters? Procurement
 *    contracts? HR offer letters? Lease agreements?) — that decision
 *    belongs to whichever checkpoint adds the first real caller, not
 *    this one, the same way ContactsProvider's own doc comment left
 *    "which of this codebase's existing contact-like records syncs as a
 *    provider contact" for a later checkpoint to decide.
 *  - documentBuffer/documentContentType (not a pre-uploaded file
 *    reference) — a signature request is initiated with the document's
 *    actual bytes in hand, mirroring how StorageProvider.upload takes a
 *    Buffer directly rather than a path; if a later checkpoint's caller
 *    already has a file via StorageProvider, resolving it to a Buffer
 *    first is that caller's own concern, not this interface's.
 *  - providerEnvelopeId (not "id"), matching CalendarProvider's own
 *    providerEventId / ContactsProvider's providerContactId /
 *    PaymentProvider's providerReference — the provider's own opaque id
 *    for this signature request, needed by getStatus/
 *    downloadSignedDocument/voidEnvelope's own `providerEnvelopeId`
 *    param to address the same request later. "Envelope" (not
 *    "request"/"document") because it's the term both DocuSign and
 *    Adobe Sign use natively for a signable package.
 *  - No update method (unlike ContactsProvider's updateContact or
 *    CalendarProvider's updateEvent) — every e-signature vendor treats
 *    an in-flight envelope as effectively immutable once sent (you void
 *    it and send a new one, you don't edit its content or signer list
 *    mid-flight), so there is nothing for an updateEnvelope to
 *    meaningfully do.
 */

export interface Signer {
  email: string;
  name: string;
}

export interface SendForSignatureParams {
  documentName: string;
  documentBuffer: Buffer;
  documentContentType: string;
  signers: Signer[];
  subject?: string;
  message?: string;
}

export interface SendForSignatureResult {
  /** The provider's own opaque id for this envelope — pass back into getStatus/downloadSignedDocument/voidEnvelope to address it again. */
  providerEnvelopeId: string;
}

/**
 * Deliberately narrowed to the states every major e-signature vendor's
 * own status vocabulary maps onto cleanly (DocuSign: sent/delivered/
 * completed/declined/voided; Adobe Sign: OUT_FOR_SIGNATURE/SIGNED/
 * CANCELLED/...) — a concrete provider's own resolveStatus-style mapping
 * function (the same pattern PaystackProvider.mapPaystackStatus and
 * PaystackProvider.mapPaystackRefundStatus already use) is expected to
 * narrow the vendor's real vocabulary down to this union, not the other
 * way around.
 */
export type SignatureStatus = 'SENT' | 'DELIVERED' | 'COMPLETED' | 'DECLINED' | 'VOIDED';

export interface SignatureStatusResult {
  status: SignatureStatus;
}

export interface VoidEnvelopeParams {
  providerEnvelopeId: string;
  /** A short note recorded against the voided envelope, if the provider supports one. */
  reason?: string;
}

export interface SignatureProvider {
  sendForSignature(params: SendForSignatureParams): Promise<SendForSignatureResult>;
  getStatus(providerEnvelopeId: string): Promise<SignatureStatusResult>;
  downloadSignedDocument(providerEnvelopeId: string): Promise<Buffer>;
  voidEnvelope(params: VoidEnvelopeParams): Promise<void>;
}

/** DI token for the active signature provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const SIGNATURE_PROVIDER = Symbol('SIGNATURE_PROVIDER');
