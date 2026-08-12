/**
 * Vendor-agnostic calendar-event abstraction (Release IG.1 — Microsoft
 * Graph Enhancements, Checkpoint A: abstraction only).
 *
 * Same role PaymentProvider (payments/payment-provider.interface.ts) and
 * BankProvider (bank-integration/bank-provider.interface.ts) play for
 * their own domains: every caller that needs to create/update/cancel a
 * calendar event depends on this interface, never on a concrete
 * MicrosoftGraphCalendarProvider (or a future GoogleCalendarProvider —
 * see the roadmap's separate "IG.2 Google Workspace" line item, which
 * this abstraction is deliberately shaped to accommodate later without
 * a rewrite, the same reason BankProvider named Okra/Stitch as future
 * siblings to Mono in its own doc comment) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) CalendarProviderRegistry, mirroring BankProviderRegistry's
 * own Checkpoint A split exactly. Release IG.1, Checkpoint B
 * (calendar/providers/microsoft-graph-calendar.provider.ts) adds the
 * first concrete provider, reusing the existing MS_GRAPH_EMAIL
 * IntegrationProvider row's tenantId/clientId/clientSecret/senderUserId
 * (the same Azure AD app registration the email driver already
 * authenticates with — see that provider's own doc comment for why a
 * second row isn't needed). Nothing calls createEvent/updateEvent/
 * cancelEvent yet, though — no controller exists (Checkpoint C).
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - startTime/endTime are real Date objects (not ISO strings) — matches
 *    how CalendarEvent-shaped data already flows through this codebase
 *    elsewhere (e.g. Prisma DateTime fields), not Graph API's own wire
 *    format (a concrete provider's job to convert at its own boundary).
 *  - attendeeEmails is a plain string array, not a richer
 *    name+email/role structure — every caller of this interface so far
 *    only needs to invite people by address (system-generated
 *    notifications, not human-composed meeting invites with optional
 *    attendees or free/busy negotiation); a later checkpoint can widen
 *    this if a real caller needs more.
 *  - providerEventId (not "id") on the result, matching
 *    PaymentProvider's own providerReference / BankProvider's absence of
 *    an id (it has none to return) — the provider's own opaque id for
 *    this event, needed by updateEvent/cancelEvent's own `providerEventId`
 *    param to address the same event later.
 */

export interface CreateEventParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  /** Plain email addresses to invite — see design notes above. */
  attendeeEmails?: string[];
  location?: string;
}

export interface CreateEventResult {
  /** The provider's own opaque id for this event — pass back into updateEvent/cancelEvent to address it again. */
  providerEventId: string;
  /** A web link to view the event, if the provider returns one. */
  htmlLink?: string;
}

export interface UpdateEventParams {
  providerEventId: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  attendeeEmails?: string[];
  location?: string;
}

export interface CancelEventParams {
  providerEventId: string;
  /** A short note included in the cancellation notice sent to attendees, if the provider supports one. */
  comment?: string;
}

export interface CalendarProvider {
  createEvent(params: CreateEventParams): Promise<CreateEventResult>;
  updateEvent(params: UpdateEventParams): Promise<void>;
  cancelEvent(params: CancelEventParams): Promise<void>;
}

/** DI token for the active calendar provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const CALENDAR_PROVIDER = Symbol('CALENDAR_PROVIDER');
