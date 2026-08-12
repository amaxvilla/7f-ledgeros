/**
 * Vendor-agnostic presence abstraction (Release IG.1 — Microsoft Graph
 * Enhancements, Checkpoint N: "Presence" sub-area, following Calendar's,
 * Contacts', and Tasks' own "interface + registry first" progression
 * exactly — see tasks-provider.interface.ts's doc comment for the fuller
 * rationale, which applies here unchanged).
 *
 * Every caller that needs to know whether a user is currently online
 * depends on this interface, never on a concrete
 * MicrosoftGraphPresenceProvider (or a future GoogleWorkspacePresenceProvider
 * — same "IG.2 Google Workspace" accommodation the sibling interfaces'
 * doc comments name) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) PresenceProviderRegistry, mirroring
 * TasksProviderRegistry's own first checkpoint exactly. A later
 * checkpoint adds the first concrete provider — reusing the existing
 * MS_GRAPH_EMAIL IntegrationProvider row's tenantId/clientId/
 * clientSecret/senderUserId (no new IntegrationProvider row needed,
 * same reuse call the other three Graph providers already made) — and
 * the checkpoint after that wires it into an actual caller. Nothing
 * calls getPresence yet.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - `userIdentifier` (not `userId`) — deliberately not assumed to be a
 *    7F LedgerOS User.id. Graph addresses presence by an Azure AD
 *    object id OR a userPrincipalName (typically the user's email) —
 *    whichever the first concrete provider's checkpoint finds easiest to
 *    resolve from whatever a caller already has on hand (most likely a
 *    User.email, given that's the join key ContactsProvider/CalendarProvider
 *    already use for their own Graph correlation). Left as an opaque
 *    string here rather than committing to one now, same posture
 *    TasksProvider's own `listId` design note takes toward not baking a
 *    Graph-specific concept into a vendor-agnostic interface prematurely.
 *  - `availability`/`activity` (not a single collapsed "status" field) —
 *    mirrors Graph's own presence response shape
 *    (GET /users/{id}/presence returns exactly these two fields) closely
 *    enough that a concrete provider's mapping is closer to a pass-through
 *    than a translation, while still being provider-agnostic in *name*
 *    (a future GoogleWorkspacePresenceProvider would map Chat API's own
 *    status vocabulary onto the same two fields, not invent a third).
 *  - No caller identified yet for "who needs to show a presence
 *    indicator" — that decision belongs to whichever checkpoint adds the
 *    first real caller, not this one, same posture ContactsProvider's
 *    and TasksProvider's own design notes took.
 */

export interface PresenceResult {
  /** e.g. "Available" | "Busy" | "DoNotDisturb" | "Away" | "Offline" | "PresenceUnknown" — see the concrete provider for the exact vendor vocabulary it returns. */
  availability: string;
  /** e.g. "InAMeeting" | "OnCall" | "Presenting" | "Available" — finer-grained than availability; a concrete provider may return the same value in both fields when its vendor API doesn't distinguish them. */
  activity: string;
}

export interface PresenceProvider {
  getPresence(userIdentifier: string): Promise<PresenceResult>;
}

/** DI token for the active presence provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const PRESENCE_PROVIDER = Symbol('PRESENCE_PROVIDER');
