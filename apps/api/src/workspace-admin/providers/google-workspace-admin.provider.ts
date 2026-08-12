import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireGoogleServiceAccountAccessToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { WorkspaceAdminProviderRegistry } from '../workspace-admin-provider.registry';
import {
  WorkspaceAdminProvider,
  CreateDirectoryUserParams,
  CreateDirectoryUserResult,
  SuspendDirectoryUserParams,
  DeleteDirectoryUserParams,
  ListDirectoryUsersParams,
  DirectoryUserSummary,
} from '../workspace-admin-provider.interface';

export const GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE = 'GOOGLE_WORKSPACE_ADMIN';
const DIRECTORY_API_BASE_URL = 'https://admin.googleapis.com/admin/directory/v1';
// Full read-write scope — this provider creates/suspends/deletes users,
// unlike GoogleWorkspaceAdminHealthCheckDriver's own deliberately narrower
// admin.directory.user.readonly scope for its connectivity-only check
// (see that driver's doc comment on why reachable != writable).
const DIRECTORY_USER_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user';

interface ResolvedWorkspaceAdminConfig {
  impersonatedAdminEmail: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Release IH (Google Workspace), Checkpoint H — the concrete
 * WorkspaceAdminProvider Checkpoint E's own doc comment said couldn't
 * follow immediately (needed the service-account JWT primitive from
 * Checkpoint F and the credential shape from Checkpoint G first). Both
 * prerequisites are in place; this is the provider built on top of them.
 *
 * OWN DEDICATED IntegrationProvider ROW (WORKSPACE_ADMIN_PROVIDER_ID env
 * var, category GOOGLE_WORKSPACE, providerCode "GOOGLE_WORKSPACE_ADMIN")
 * — NOT the same row GoogleCalendarProvider/GoogleContactsProvider reuse
 * from GMAIL_EMAIL. Checkpoint G's own doc comment already gave the
 * reason: a service-account key (clientEmail + PEM private key) is a
 * fundamentally different credential shape than the client id/secret/
 * refresh-token triple every reused-row provider needs, so mixing them
 * under one row would make config/credentials mean two different things
 * for the same key. Same reasoning GoogleDriveStorageProvider's own
 * dedicated STORAGE_DRIVE_PROVIDER_ID row gives for the identical
 * "different credential shape -> different row" call.
 *
 * Every Directory API call impersonates config.impersonatedAdminEmail
 * (the JWT `sub` claim) via domain-wide delegation — see
 * google-service-account.ts's own doc comment for why this codebase's
 * other Google providers (refresh-token, one-consenting-user flow) can't
 * do this, and workspace-admin-provider.interface.ts's Architectural Gap
 * note for the domain-wide-delegation requirement itself.
 *
 * providerUserId is the Directory API's own opaque `id` field (returned
 * by users.insert), not primaryEmail — matching every other *Provider's
 * own choice to hand back an opaque provider id rather than a
 * caller-supplied identifier (providerEventId, providerContactId).
 * Directory API's userKey path parameter accepts either, but an id
 * survives a user's primary-email change (e.g. after a legal name
 * change); an email captured at creation time would not.
 *
 * NO CALLER YET. Checkpoint E's own open question — what should trigger
 * provisioning a directory user (new Employee records? Recruitment offer
 * acceptance?) — is still unanswered; this checkpoint makes the
 * provider real and registered, not wired to anything that calls it.
 * CandidateService.hire() (recruitment/candidate.service.ts) is the
 * clearest existing candidate for that hook — it is both a Recruitment
 * offer-acceptance event and the exact moment a real Employee record is
 * created — but wiring it is deliberately left for its own checkpoint,
 * the same way retryCalendarSync/retryContactSync followed their own
 * create-sync checkpoints as separate steps rather than landing in the
 * same one.
 */
@Injectable()
export class GoogleWorkspaceAdminProvider implements WorkspaceAdminProvider, OnModuleInit {
  private resolved: Promise<ResolvedWorkspaceAdminConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: WorkspaceAdminProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE, this);
  }

  async createUser(params: CreateDirectoryUserParams): Promise<CreateDirectoryUserResult> {
    const token = await this.getToken();
    const res = await fetch(`${DIRECTORY_API_BASE_URL}/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryEmail: params.primaryEmail,
        name: { givenName: params.givenName, familyName: params.familyName },
        password: params.password,
        changePasswordAtNextLogin: true,
        orgUnitPath: params.orgUnitPath ?? '/',
      }),
    });
    const body = await this.parseJson(res);
    if (!res.ok) {
      throw new Error(`Directory API users.insert failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
    const id = (body as { id?: string }).id;
    if (!id) throw new Error('Directory API users.insert succeeded but returned no id');
    return { providerUserId: id };
  }

  async setUserSuspended(params: SuspendDirectoryUserParams): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(`${DIRECTORY_API_BASE_URL}/users/${encodeURIComponent(params.providerUserId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: params.suspended }),
    });
    if (!res.ok) {
      const body = await this.parseJson(res);
      throw new Error(`Directory API users.patch (suspend) failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
  }

  async deleteUser(params: DeleteDirectoryUserParams): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(`${DIRECTORY_API_BASE_URL}/users/${encodeURIComponent(params.providerUserId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await this.parseJson(res);
      throw new Error(`Directory API users.delete failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
  }

  async listUsers(params: ListDirectoryUsersParams): Promise<DirectoryUserSummary[]> {
    const token = await this.getToken();
    const query = new URLSearchParams({ customer: 'my_customer' });
    if (params.orgUnitPath) query.set('query', `orgUnitPath='${params.orgUnitPath}'`);
    if (params.maxResults) query.set('maxResults', String(params.maxResults));

    const res = await fetch(`${DIRECTORY_API_BASE_URL}/users?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await this.parseJson(res);
    if (!res.ok) {
      throw new Error(`Directory API users.list failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
    const users = (body as { users?: Array<{ id: string; primaryEmail: string; name?: { fullName?: string }; suspended?: boolean }> }).users ?? [];
    return users.map((u) => ({
      providerUserId: u.id,
      primaryEmail: u.primaryEmail,
      fullName: u.name?.fullName ?? u.primaryEmail,
      suspended: Boolean(u.suspended),
    }));
  }

  private async getToken(): Promise<string> {
    const config = await this.getConfig();
    return acquireGoogleServiceAccountAccessToken(
      { clientEmail: config.clientEmail, privateKey: config.privateKey },
      { scopes: [DIRECTORY_USER_SCOPE], impersonatedUserEmail: config.impersonatedAdminEmail },
    );
  }

  private async getConfig(): Promise<ResolvedWorkspaceAdminConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedWorkspaceAdminConfig> {
    const providerId = process.env.WORKSPACE_ADMIN_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'WORKSPACE_ADMIN_PROVIDER_ID is not set. Create an IntegrationProvider (category GOOGLE_WORKSPACE, providerCode "GOOGLE_WORKSPACE_ADMIN") with config {impersonatedAdminEmail} and credentials {clientEmail, privateKey} (a service-account JSON key with domain-wide delegation authorizing the admin.directory.user scope), then set WORKSPACE_ADMIN_PROVIDER_ID to its id.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE) {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "${GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE}"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (${GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE}) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const impersonatedAdminEmail = config.impersonatedAdminEmail as string | undefined;
    if (!impersonatedAdminEmail) {
      throw new Error(`Integration provider ${providerId} is missing config.impersonatedAdminEmail`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientEmail = credentials?.clientEmail as string | undefined;
    const privateKey = credentials?.privateKey as string | undefined;
    if (!clientEmail || !privateKey) {
      const missing = [!clientEmail && 'clientEmail', !privateKey && 'privateKey'].filter(Boolean);
      throw new Error(`Integration provider ${providerId} is missing credentials.${missing.join(', credentials.')}`);
    }

    return { impersonatedAdminEmail, clientEmail, privateKey };
  }

  private errorMessage(body: unknown): string {
    return (body as { error?: { message?: string } })?.error?.message ?? 'unknown error';
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
