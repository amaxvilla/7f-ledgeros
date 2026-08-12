/**
 * Vendor-agnostic contact abstraction (Release IG.1 — Microsoft Graph
 * Enhancements, Checkpoint E: abstraction only — the "Contacts" sub-area,
 * following Calendar's own A/B/C/D progression).
 *
 * Same role CalendarProvider (calendar/calendar-provider.interface.ts)
 * plays for calendar events, and PaymentProvider/BankProvider play for
 * their own domains: every caller that needs to create/update/delete a
 * contact depends on this interface, never on a concrete
 * MicrosoftGraphContactsProvider (or a future GoogleContactsProvider —
 * same "IG.2 Google Workspace" accommodation CalendarProvider's own doc
 * comment names) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) ContactsProviderRegistry, mirroring
 * CalendarProviderRegistry's own Checkpoint A split exactly. A later
 * checkpoint adds the first concrete provider — reusing the existing
 * MS_GRAPH_EMAIL IntegrationProvider row's tenantId/clientId/
 * clientSecret/senderUserId, the same Azure AD app registration the
 * email driver and MicrosoftGraphCalendarProvider already authenticate
 * with (no second row needed) — and the checkpoint after that wires it
 * into an actual caller. Nothing calls createContact/updateContact/
 * deleteContact yet.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - No caller has been identified yet for what should sync as a
 *    Microsoft/Outlook contact (candidates? CRM leads? vendor contacts?)
 *    — that decision belongs to whichever checkpoint adds the first
 *    real caller, not this one. This abstraction is deliberately generic
 *    (displayName/emailAddress/phoneNumber/companyName/jobTitle) rather
 *    than shaped around any one of this codebase's existing contact-like
 *    models (Candidate, CrmLead, Vendor, ...) so it doesn't have to be
 *    rewritten once that decision is made.
 *  - providerContactId (not "id") on the result, matching
 *    CalendarProvider's own providerEventId / PaymentProvider's
 *    providerReference — the provider's own opaque id for this contact,
 *    needed by updateContact/deleteContact's own `providerContactId`
 *    param to address the same contact later.
 */

export interface ContactParams {
  displayName: string;
  emailAddress?: string;
  phoneNumber?: string;
  companyName?: string;
  jobTitle?: string;
}

export interface CreateContactResult {
  /** The provider's own opaque id for this contact — pass back into updateContact/deleteContact to address it again. */
  providerContactId: string;
}

export interface UpdateContactParams extends Partial<ContactParams> {
  providerContactId: string;
}

export interface DeleteContactParams {
  providerContactId: string;
}

export interface ContactsProvider {
  createContact(params: ContactParams): Promise<CreateContactResult>;
  updateContact(params: UpdateContactParams): Promise<void>;
  deleteContact(params: DeleteContactParams): Promise<void>;
}

/** DI token for the active contacts provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const CONTACTS_PROVIDER = Symbol('CONTACTS_PROVIDER');
