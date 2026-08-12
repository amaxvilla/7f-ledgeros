/**
 * Vendor-agnostic Workspace/directory-admin abstraction (Release IH —
 * Google Workspace, Checkpoint E: abstraction only — the "Admin"
 * sub-area, following Calendar's/Contacts' own A/.../E progression).
 *
 * Same role ContactsProvider/CalendarProvider/BankProvider play for
 * their own domains: every caller that needs to provision, suspend, or
 * list directory users depends on this interface, never on a concrete
 * GoogleWorkspaceAdminProvider (or a future Microsoft Entra ID/Azure AD
 * Graph equivalent — Microsoft Graph's Users API covers the same
 * ground, so this abstraction is named "Workspace admin" generically
 * rather than "Google admin", the same accommodation CalendarProvider's
 * own naming made for Google Workspace up front instead of after the
 * fact) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) WorkspaceAdminProviderRegistry, mirroring
 * ContactsProviderRegistry's own Checkpoint E split exactly. Nothing
 * here is wired to a concrete provider yet.
 *
 * ARCHITECTURAL GAP THIS CHECKPOINT SURFACED (documented here rather
 * than discovered mid-implementation of a later checkpoint, the same
 * way MonoProvider's own Checkpoint B surfaced Mono's account-linking
 * requirement): Google's Admin SDK Directory API — the only way to
 * provision/suspend/list OTHER users in a Workspace domain — requires
 * domain-wide delegation: a service-account JSON key impersonating a
 * super-admin, not the refresh-token-for-one-consenting-user flow every
 * other Google provider in this codebase uses (Gmail, Calendar,
 * Contacts). GoogleCalendarProvider's own doc comment already named the
 * reason this codebase avoids that flow: no existing service-account
 * JWT-signing capability, and introducing one — a new crypto flow, a
 * new credential shape (a full JSON key, not a client id/secret/refresh
 * token triple), a new Workspace-admin-console setup step — is a bigger,
 * riskier addition than this or any single checkpoint should absorb
 * incidentally. A concrete GoogleWorkspaceAdminProvider therefore cannot
 * be built as a same-shaped follow-on checkpoint the way
 * GoogleContactsProvider was to GoogleCalendarProvider; it needs the
 * service-account JWT capability as its own prerequisite checkpoint
 * first. Flagged here rather than silently deferred.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - providerUserId (not "id"), matching every other *Provider result
 *    shape in this codebase (providerEventId, providerContactId,
 *    providerReference).
 *  - No caller has been identified yet for what should provision a
 *    Workspace/Entra account (new Employee records? on Recruitment
 *    offer acceptance?) — same "that decision belongs to whichever
 *    checkpoint adds the first real caller" note
 *    contacts-provider.interface.ts's own design notes make.
 */

export interface CreateDirectoryUserParams {
  primaryEmail: string;
  givenName: string;
  familyName: string;
  /** Temporary/initial password — the provider is expected to require a change on first login where the underlying API supports it. */
  password: string;
  /** Organizational unit path, e.g. "/Engineering" — undefined means the provider's default OU. */
  orgUnitPath?: string;
}

export interface CreateDirectoryUserResult {
  /** The provider's own opaque id for this user — pass back into suspendUser/deleteUser to address it again. */
  providerUserId: string;
}

export interface SuspendDirectoryUserParams {
  providerUserId: string;
  suspended: boolean;
}

export interface DeleteDirectoryUserParams {
  providerUserId: string;
}

export interface ListDirectoryUsersParams {
  orgUnitPath?: string;
  maxResults?: number;
}

export interface DirectoryUserSummary {
  providerUserId: string;
  primaryEmail: string;
  fullName: string;
  suspended: boolean;
}

export interface WorkspaceAdminProvider {
  createUser(params: CreateDirectoryUserParams): Promise<CreateDirectoryUserResult>;
  setUserSuspended(params: SuspendDirectoryUserParams): Promise<void>;
  deleteUser(params: DeleteDirectoryUserParams): Promise<void>;
  listUsers(params: ListDirectoryUsersParams): Promise<DirectoryUserSummary[]>;
}

/** DI token for the active workspace-admin provider — not yet bound anywhere (see this file's Architectural Gap note above). */
export const WORKSPACE_ADMIN_PROVIDER = Symbol('WORKSPACE_ADMIN_PROVIDER');
