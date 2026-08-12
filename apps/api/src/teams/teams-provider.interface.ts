/**
 * Vendor-agnostic online-meeting abstraction (Release IG.1 — Microsoft
 * Graph Enhancements, Checkpoint Q: abstraction only — the "Teams"
 * sub-area, following Calendar's, Contacts', Tasks', and Presence's own
 * "interface + registry first" progression exactly — see
 * tasks-provider.interface.ts's doc comment for the fuller rationale,
 * which applies here unchanged).
 *
 * Scoped to online meetings, not general Teams chat/channel messaging.
 * The strongest signal for what "Teams" should mean in this codebase is
 * already sitting in the schema: Interview.location's own comment reads
 * "physical or \"video-call\"" — this codebase already anticipated
 * remote interviews needing a real join link, it just never had a
 * provider to generate one. CalendarProvider's own createEvent doesn't
 * produce a join URL (a plain Graph calendar event has no online-meeting
 * component unless isOnlineMeeting is set, which none of the existing
 * Calendar/Contacts/Tasks/Presence checkpoints touch), so this is a
 * distinct capability, not a duplicate of Calendar's.
 *
 * Every caller that needs a join link for a remote meeting depends on
 * this interface, never on a concrete MicrosoftTeamsProvider (or a
 * future GoogleMeetProvider — same "IH Google Workspace" accommodation
 * the sibling interfaces' doc comments name) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) TeamsProviderRegistry, mirroring
 * PresenceProviderRegistry's own first checkpoint exactly. A later
 * checkpoint adds the first concrete provider — reusing the existing
 * MS_GRAPH_EMAIL IntegrationProvider row's tenantId/clientId/
 * clientSecret/senderUserId, the same Azure AD app registration the
 * email driver and the Calendar/Contacts/Tasks/Presence providers
 * already authenticate with (no sixth row needed, note this DOES
 * additionally require the OnlineMeetings.ReadWrite.All application
 * permission on top of the grants Presence's own checkpoint already
 * called out — a deployment concern for that later checkpoint, not this
 * one) — and the checkpoint after that wires it into an actual caller
 * (most likely InterviewService, given the schema comment above, the
 * same module Presence's own Checkpoint P landed in).
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - `organizerIdentifier` (not `organizerId`) — same posture
 *    Presence's own `userIdentifier` design note takes: not assumed to
 *    be a 7F LedgerOS User.id. Graph's own
 *    POST /users/{id}/onlineMeetings addresses the organizer by AAD
 *    object id OR userPrincipalName interchangeably, left as an opaque
 *    string here rather than committing to one now.
 *  - `providerMeetingId` (not "id"), matching CalendarProvider's
 *    providerEventId / ContactsProvider's providerContactId / Tasks'
 *    own providerTaskId — the provider's own opaque id for this
 *    meeting, needed by cancelMeeting's own `providerMeetingId` param
 *    to address the same meeting later.
 *  - `joinUrl` is the one field every caller actually needs (to put in
 *    an interview invite, a calendar event description, a notification
 *    message, etc.) — everything else Graph's onlineMeeting resource
 *    returns (audioConferencing, chatInfo, lobbyBypassSettings, ...) is
 *    left out of CreateMeetingResult until a caller demonstrably needs
 *    it, same "don't model what nothing calls yet" posture Tasks' own
 *    `completed` boolean note takes toward Graph's three-value status
 *    enum.
 *  - No caller identified yet for "who creates a Teams meeting and
 *    when" — that decision belongs to whichever checkpoint adds the
 *    first real caller, not this one, same posture every sibling
 *    interface's own design notes have taken.
 */

export interface CreateMeetingParams {
  subject: string;
  startTime: Date;
  endTime: Date;
  organizerIdentifier: string;
}

export interface CreateMeetingResult {
  /** The provider's own opaque id for this meeting — pass back into cancelMeeting to address it again. */
  providerMeetingId: string;
  /** The URL a participant follows to join the meeting. */
  joinUrl: string;
}

export interface CancelMeetingParams {
  providerMeetingId: string;
  organizerIdentifier: string;
}

export interface TeamsProvider {
  createMeeting(params: CreateMeetingParams): Promise<CreateMeetingResult>;
  cancelMeeting(params: CancelMeetingParams): Promise<void>;
}

/** DI token for the active Teams provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const TEAMS_PROVIDER = Symbol('TEAMS_PROVIDER');
