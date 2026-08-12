import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireMicrosoftGraphToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { TasksProviderRegistry } from '../tasks-provider.registry';
import { CreateTaskResult, DeleteTaskParams, TaskParams, TasksProvider, UpdateTaskParams } from '../tasks-provider.interface';

export const MS_GRAPH_TASKS_PROVIDER_CODE = 'MS_GRAPH';
const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface ResolvedGraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderUserId: string;
}

interface GraphTaskResponse {
  id: string;
  [key: string]: unknown;
}

interface GraphTaskListResponse {
  value?: { id: string; wellknownListName?: string }[];
}

interface GraphErrorResponse {
  error?: { message?: string; code?: string };
}

/**
 * Release IG.1, Checkpoint L — the first concrete TasksProvider,
 * mirroring MicrosoftGraphContactsProvider's own Checkpoint F exactly,
 * down to the doc comment structure and config-resolution/caching shape.
 *
 * WHY THE SAME IntegrationProvider ROW AS THE EMAIL/CALENDAR/CONTACTS
 * DRIVERS: same reasoning MicrosoftGraphContactsProvider's own doc
 * comment gives — reuses EMAIL_SMTP_PROVIDER_ID (config {tenantId,
 * clientId, senderUserId}, credentials {clientSecret}) rather than a
 * fifth IntegrationProvider row for the identical Azure AD app
 * registration. Operationally this DOES require that app registration
 * to also be granted the Tasks.ReadWrite permission (on top of
 * Mail.Send, Calendars.ReadWrite, and Contacts.ReadWrite) — a
 * deployment/permissions concern, not a code one; this provider's own
 * error messages surface a Graph 403 clearly if that grant is missing
 * rather than failing silently.
 *
 * DEFAULT LIST RESOLUTION: tasks-provider.interface.ts's own design note
 * says a concrete provider may resolve a sensible default list when a
 * caller doesn't pass one — implemented here as a second, independently
 * cached async resource (`resolvedDefaultListId`, alongside
 * `resolved`/config) via GET /users/{id}/todo/lists, preferring the list
 * whose `wellknownListName` is `"defaultList"` (Graph's own name for the
 * built-in "Tasks" list every mailbox has), falling back to the first
 * list returned if no well-known default is present, and throwing a
 * clear error if the account has no task lists at all. Cached exactly
 * like `resolved`/getConfig — resolved once, reused by every
 * create/update/delete call in this provider's lifetime, not re-fetched
 * per call the way the Graph access token itself is (see
 * acquireMicrosoftGraphToken's own token-per-call behavior, unchanged
 * here).
 *
 * Token acquisition reuses @7f/config's acquireMicrosoftGraphToken — the
 * same helper the mail service, the email health-check driver,
 * MicrosoftGraphCalendarProvider, and MicrosoftGraphContactsProvider all
 * already call, not a fifth copy of the client-credentials POST.
 */
@Injectable()
export class MicrosoftGraphTasksProvider implements TasksProvider, OnModuleInit {
  private resolved: Promise<ResolvedGraphConfig> | null = null;
  private resolvedDefaultListId: Promise<string> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: TasksProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(MS_GRAPH_TASKS_PROVIDER_CODE, this);
  }

  async createTask(params: TaskParams): Promise<CreateTaskResult> {
    const { token, senderUserId } = await this.getAuth();
    const listId = params.listId ?? (await this.getDefaultListId(token, senderUserId));

    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/todo/lists/${encodeURIComponent(listId)}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toGraphTaskBody(params)),
    });

    const json = (await this.parseJson(res)) as GraphTaskResponse & GraphErrorResponse;
    if (!res.ok) {
      throw new Error(`Microsoft Graph create task failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    return { providerTaskId: json.id };
  }

  async updateTask(params: UpdateTaskParams): Promise<void> {
    const { token, senderUserId } = await this.getAuth();
    const { providerTaskId, listId: paramsListId, ...rest } = params;
    const listId = paramsListId ?? (await this.getDefaultListId(token, senderUserId));

    const res = await fetch(
      `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(providerTaskId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toGraphTaskBody(rest)),
      },
    );

    if (!res.ok) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph update task failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  async deleteTask(params: DeleteTaskParams): Promise<void> {
    const { token, senderUserId } = await this.getAuth();
    const listId = params.listId ?? (await this.getDefaultListId(token, senderUserId));

    const res = await fetch(
      `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(params.providerTaskId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );

    // Graph returns 204 on success; treat 404 as already-deleted rather
    // than an error — same idempotency posture ContactsProvider's own
    // deleteContact takes, so a retried job doesn't fail just because
    // the first attempt actually succeeded before a response was received.
    if (!res.ok && res.status !== 404) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph delete task failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  /** Shared by createTask/updateTask — Graph's task resource shape is identical for POST (full) and PATCH (partial), just with different fields present. `completed` maps to Graph's 3-value `status`, collapsing to just 'completed'/'notStarted' per this interface's own design note (no 'inProgress' caller exists yet). */
  private toGraphTaskBody(params: Partial<TaskParams> & { completed?: boolean }): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (params.title !== undefined) body.title = params.title;
    if (params.notes !== undefined) body.body = { content: params.notes, contentType: 'text' };
    if (params.dueDateTime !== undefined) body.dueDateTime = { dateTime: params.dueDateTime.toISOString(), timeZone: 'UTC' };
    if (params.completed !== undefined) body.status = params.completed ? 'completed' : 'notStarted';
    return body;
  }

  private async getDefaultListId(token: string, senderUserId: string): Promise<string> {
    if (!this.resolvedDefaultListId) {
      this.resolvedDefaultListId = this.resolveDefaultListId(token, senderUserId);
    }
    return this.resolvedDefaultListId;
  }

  private async resolveDefaultListId(token: string, senderUserId: string): Promise<string> {
    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/todo/lists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await this.parseJson(res)) as GraphTaskListResponse & GraphErrorResponse;
    if (!res.ok) {
      throw new Error(`Microsoft Graph list task lists failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    const lists = json.value ?? [];
    const defaultList = lists.find((l) => l.wellknownListName === 'defaultList') ?? lists[0];
    if (!defaultList) {
      throw new Error(`No task lists found for user ${senderUserId} — cannot resolve a default listId. Pass listId explicitly instead.`);
    }
    return defaultList.id;
  }

  private async getAuth(): Promise<{ token: string; senderUserId: string }> {
    const config = await this.getConfig();
    const token = await acquireMicrosoftGraphToken(config.tenantId, config.clientId, config.clientSecret);
    return { token, senderUserId: config.senderUserId };
  }

  private async getConfig(): Promise<ResolvedGraphConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedGraphConfig> {
    const providerId = process.env.EMAIL_SMTP_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'EMAIL_SMTP_PROVIDER_ID is not set. MicrosoftGraphTasksProvider reuses the same IntegrationProvider row as the MS_GRAPH_EMAIL email driver (category EMAIL, providerCode "MS_GRAPH_EMAIL") — config {tenantId, clientId, senderUserId}, credentials {clientSecret}. Ensure the underlying Azure AD app registration is also granted the Tasks.ReadWrite permission.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== 'MS_GRAPH_EMAIL') {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "MS_GRAPH_EMAIL"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (MS_GRAPH_EMAIL) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const tenantId = config.tenantId as string | undefined;
    const clientId = config.clientId as string | undefined;
    const senderUserId = config.senderUserId as string | undefined;
    const missing = ['tenantId', 'clientId', 'senderUserId'].filter((k) => !config[k]);
    if (missing.length) {
      throw new Error(`Integration provider ${providerId} is missing config.${missing.join(', config.')}`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    if (!clientSecret) {
      throw new Error(`Integration provider ${providerId} is missing credentials.clientSecret`);
    }

    return { tenantId: tenantId!, clientId: clientId!, clientSecret, senderUserId: senderUserId! };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
