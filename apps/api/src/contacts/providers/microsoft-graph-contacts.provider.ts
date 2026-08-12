import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireMicrosoftGraphToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ContactsProviderRegistry } from '../contacts-provider.registry';
import { ContactParams, ContactsProvider, CreateContactResult, DeleteContactParams, UpdateContactParams } from '../contacts-provider.interface';

export const MS_GRAPH_CONTACTS_PROVIDER_CODE = 'MS_GRAPH';
const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface ResolvedGraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderUserId: string;
}

interface GraphContactResponse {
  id: string;
  [key: string]: unknown;
}

interface GraphErrorResponse {
  error?: { message?: string; code?: string };
}

/**
 * Release IG.1, Checkpoint F — the first concrete ContactsProvider,
 * mirroring MicrosoftGraphCalendarProvider's own Checkpoint B exactly,
 * down to the doc comment structure.
 *
 * WHY THE SAME IntegrationProvider ROW AS THE EMAIL/CALENDAR DRIVERS:
 * same reasoning MicrosoftGraphCalendarProvider's own doc comment gives —
 * reuses EMAIL_SMTP_PROVIDER_ID (config {tenantId, clientId,
 * senderUserId}, credentials {clientSecret}) rather than a third
 * IntegrationProvider row for the identical Azure AD app registration.
 * Operationally this DOES require that app registration to also be
 * granted the Contacts.ReadWrite permission (on top of Mail.Send and
 * Calendars.ReadWrite) — a deployment/permissions concern, not a code
 * one; this provider's own error messages surface a Graph 403 clearly
 * if that grant is missing rather than failing silently.
 *
 * senderUserId again doubles as "whose mailbox" (email)/"whose
 * calendar" (calendar)/"whose contacts folder" (here) — Graph's
 * /users/{id}/contacts endpoint addresses a specific user's default
 * contacts folder the same way /users/{id}/events and /users/{id}/sendMail
 * address that same user's other resources.
 *
 * Token acquisition reuses @7f/config's acquireMicrosoftGraphToken — the
 * same helper the mail service, the email health-check driver, and
 * MicrosoftGraphCalendarProvider all already call, not a fourth/fifth
 * copy of the client-credentials POST.
 *
 * phoneNumber maps to Graph's `mobilePhone` (a single string field) —
 * NOT `businessPhones` (a string array) — since ContactParams only
 * models one phone number per contact; a later checkpoint that needs to
 * distinguish phone types would need to widen ContactParams itself
 * first, not just this mapping.
 */
@Injectable()
export class MicrosoftGraphContactsProvider implements ContactsProvider, OnModuleInit {
  private resolved: Promise<ResolvedGraphConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: ContactsProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(MS_GRAPH_CONTACTS_PROVIDER_CODE, this);
  }

  async createContact(params: ContactParams): Promise<CreateContactResult> {
    const { token, senderUserId } = await this.getAuth();

    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toGraphContactBody(params)),
    });

    const json = (await this.parseJson(res)) as GraphContactResponse & GraphErrorResponse;
    if (!res.ok) {
      throw new Error(`Microsoft Graph create contact failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    return { providerContactId: json.id };
  }

  async updateContact(params: UpdateContactParams): Promise<void> {
    const { token, senderUserId } = await this.getAuth();
    const { providerContactId, ...rest } = params;

    const res = await fetch(
      `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/contacts/${encodeURIComponent(providerContactId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.toGraphContactBody(rest)),
      },
    );

    if (!res.ok) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph update contact failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  async deleteContact(params: DeleteContactParams): Promise<void> {
    const { token, senderUserId } = await this.getAuth();

    const res = await fetch(
      `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/contacts/${encodeURIComponent(params.providerContactId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );

    // Graph returns 204 on success; treat 404 as already-deleted rather
    // than an error — same idempotency posture a delete operation should
    // have, so a retried job doesn't fail just because the first attempt
    // actually succeeded before a response was received.
    if (!res.ok && res.status !== 404) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph delete contact failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  /** Shared by createContact/updateContact — Graph's contact resource shape is identical for POST (full) and PATCH (partial), just with different fields present. */
  private toGraphContactBody(params: Partial<ContactParams>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (params.displayName !== undefined) body.displayName = params.displayName;
    if (params.emailAddress !== undefined) body.emailAddresses = [{ address: params.emailAddress }];
    if (params.phoneNumber !== undefined) body.mobilePhone = params.phoneNumber;
    if (params.companyName !== undefined) body.companyName = params.companyName;
    if (params.jobTitle !== undefined) body.jobTitle = params.jobTitle;
    return body;
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
        'EMAIL_SMTP_PROVIDER_ID is not set. MicrosoftGraphContactsProvider reuses the same IntegrationProvider row as the MS_GRAPH_EMAIL email driver (category EMAIL, providerCode "MS_GRAPH_EMAIL") — config {tenantId, clientId, senderUserId}, credentials {clientSecret}. Ensure the underlying Azure AD app registration is also granted the Contacts.ReadWrite permission.',
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
