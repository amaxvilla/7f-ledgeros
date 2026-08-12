/**
 * Vendor-agnostic task abstraction (Release IG.1 — Microsoft Graph
 * Enhancements, Checkpoint K: abstraction only — the "Tasks" sub-area,
 * following Calendar's and Contacts' own "interface + registry first"
 * progression exactly).
 *
 * Same role CalendarProvider/ContactsProvider play for their own
 * domains: every caller that needs to create/update/delete a task
 * depends on this interface, never on a concrete
 * MicrosoftGraphTasksProvider (or a future GoogleTasksProvider — same
 * "IG.2 Google Workspace" accommodation both of those interfaces' own
 * doc comments name) class directly.
 *
 * Deliberately scoped to ONLY the interface + its supporting types + the
 * (still-empty) TasksProviderRegistry, mirroring
 * CalendarProviderRegistry's and ContactsProviderRegistry's own first
 * checkpoints exactly. A later checkpoint adds the first concrete
 * provider — reusing the existing MS_GRAPH_EMAIL IntegrationProvider
 * row's tenantId/clientId/clientSecret/senderUserId, the same Azure AD
 * app registration the email driver, MicrosoftGraphCalendarProvider, and
 * MicrosoftGraphContactsProvider already authenticate with (no fourth
 * row needed) — and the checkpoint after that wires it into an actual
 * caller. Nothing calls createTask/updateTask/deleteTask yet.
 *
 * Design notes for later checkpoints to stay consistent with:
 *  - No caller has been identified yet for what should sync as a
 *    Microsoft To Do task (recruitment follow-ups? PMO action items?
 *    HSE corrective actions?) — that decision belongs to whichever
 *    checkpoint adds the first real caller, not this one, same posture
 *    ContactsProvider's own design notes took for "who syncs as a
 *    contact".
 *  - providerTaskId (not "id"), matching CalendarProvider's
 *    providerEventId / ContactsProvider's providerContactId — the
 *    provider's own opaque id for this task, needed by
 *    updateTask/deleteTask's own `providerTaskId` param to address the
 *    same task later.
 *  - `listId` is optional on every operation, not required — Graph's To
 *    Do API addresses a task through a specific list
 *    (/users/{id}/todo/lists/{listId}/tasks/{taskId}), but forcing every
 *    caller to know and pass a listId up front would leak a Graph-specific
 *    concept into this vendor-agnostic interface. A concrete provider is
 *    free to resolve a sensible default (e.g. the account's well-known
 *    "Tasks" list) when omitted — see whichever checkpoint adds
 *    MicrosoftGraphTasksProvider for that resolution logic — but a
 *    caller that already knows which list it wants (e.g. a dedicated
 *    "7F LedgerOS" list) can still pass one explicitly.
 *  - `completed` (a plain boolean), not Graph's three-value `status`
 *    enum ('notStarted'/'inProgress'/'completed') — unlike
 *    ContactsProvider's phoneNumber-type distinction (explicitly
 *    deferred until a caller needs it), "mark done / not done" is close
 *    to universal across task callers, so it's modeled now rather than
 *    left for a later interface change. A caller that genuinely needs
 *    Graph's "inProgress" mid-state can still be added later without
 *    breaking this boolean — it would just become a third case a
 *    concrete provider maps `completed` through, not a breaking change
 *    to existing callers using true/false.
 */

export interface TaskParams {
  title: string;
  notes?: string;
  dueDateTime?: Date;
  listId?: string;
}

export interface CreateTaskResult {
  /** The provider's own opaque id for this task — pass back into updateTask/deleteTask to address it again. */
  providerTaskId: string;
}

export interface UpdateTaskParams extends Partial<TaskParams> {
  providerTaskId: string;
  completed?: boolean;
}

export interface DeleteTaskParams {
  providerTaskId: string;
  listId?: string;
}

export interface TasksProvider {
  createTask(params: TaskParams): Promise<CreateTaskResult>;
  updateTask(params: UpdateTaskParams): Promise<void>;
  deleteTask(params: DeleteTaskParams): Promise<void>;
}

/** DI token for the active tasks provider — not yet bound anywhere (see later checkpoints, Concrete Provider). */
export const TASKS_PROVIDER = Symbol('TASKS_PROVIDER');
