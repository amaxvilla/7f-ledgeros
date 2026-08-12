import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireGoogleAccessToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { ContactsProviderRegistry } from '../contacts-provider.registry';
import {
  ContactsProvider,
  ContactParams,
  CreateContactResult,
  UpdateContactParams,
  DeleteContactParams,
} from '../contacts-provider.interface';

export const GOOGLE_CONTACTS_PROVIDER_CODE = 'GOOGLE_CONTACTS';
const PEOPLE_API_BASE_URL = 'https://people.googleapis.com/v1';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,organizations';

interface ResolvedGoogleConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Release IH (Google Workspace), Checkpoint D — the second concrete
 * ContactsProvider besides MicrosoftGraphContactsProvider, registering
 * into the SAME ContactsProviderRegistry that provider already uses
 * (contacts-provider.registry.ts, Release IG.1 Checkpoint E) — the exact
 * extensibility that registry's own doc comment named Google Workspace
 * as the reason for existing, mirroring GoogleCalendarProvider's own
 * relationship to CalendarProviderRegistry (Checkpoint A) precisely.
 *
 * CREDENTIAL REUSE: same IntegrationProvider row as GoogleCalendarProvider
 * and GmailMailService — EMAIL_SMTP_PROVIDER_ID / providerCode
 * "GMAIL_EMAIL" — not a second row. Same OAuth client, same refresh
 * token; the consent just needs to also have granted the People API's
 * contacts scope (https://www.googleapis.com/auth/contacts), the same
 * caveat GoogleCalendarProvider's own resolveConfig() error message
 * already carries for its own required scope.
 *
 * GOOGLE PEOPLE API QUIRK THIS PROVIDER HAS TO ACCOMMODATE (the reason
 * updateContact isn't a single PATCH the way MicrosoftGraphContactsProvider's
 * update is): the People API's update endpoint requires the person
 * resource's current `etag` in the request body for optimistic
 * concurrency — there is no way to PATCH blind. updateContact therefore
 * does a GET immediately before the PATCH to fetch that etag. This is a
 * genuine extra round-trip inherent to the API, not an inefficiency
 * introduced here.
 *
 * NAME MAPPING: ContactParams.displayName is a single string (the
 * interface is deliberately provider-agnostic — see
 * contacts-provider.interface.ts's own design notes), but People API
 * writes take structured givenName/familyName, not a displayName it
 * accepts as input. This provider splits on the first space
 * (documented, pragmatic — matches how many contact-sync integrations
 * handle this exact mismatch) rather than attempting real name parsing.
 */
@Injectable()
export class GoogleContactsProvider implements ContactsProvider, OnModuleInit {
  private resolved: Promise<ResolvedGoogleConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: ContactsProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(GOOGLE_CONTACTS_PROVIDER_CODE, this);
  }

  async createContact(params: ContactParams): Promise<CreateContactResult> {
    const token = await this.getToken();
    const res = await fetch(`${PEOPLE_API_BASE_URL}/people:createContact`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toPersonBody(params)),
    });
    const body = await this.parseJson(res);
    if (!res.ok) {
      throw new Error(`Google People createContact failed: HTTP ${res.status} — ${(body as { error?: { message?: string } }).error?.message ?? 'unknown error'}`);
    }
    const resourceName = (body as { resourceName?: string }).resourceName;
    if (!resourceName) throw new Error('Google People createContact succeeded but returned no resourceName');
    return { providerContactId: resourceName };
  }

  /** GET for the current etag, then PATCH — see this class's own doc
   *  comment for why the People API leaves no way around the extra
   *  round-trip. */
  async updateContact(params: UpdateContactParams): Promise<void> {
    const token = await this.getToken();
    const resourceName = params.providerContactId;

    const getRes = await fetch(`${PEOPLE_API_BASE_URL}/${resourceName}?personFields=${PERSON_FIELDS}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const current = await this.parseJson(getRes);
    if (!getRes.ok) {
      throw new Error(`Google People lookup before update failed: HTTP ${getRes.status} — ${(current as { error?: { message?: string } }).error?.message ?? 'unknown error'}`);
    }
    const etag = (current as { etag?: string }).etag;
    if (!etag) throw new Error(`Google People lookup for ${resourceName} returned no etag — cannot update without it`);

    const patchRes = await fetch(`${PEOPLE_API_BASE_URL}/${resourceName}:updateContact?updatePersonFields=${PERSON_FIELDS}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.toPersonBody(params), etag }),
    });
    if (!patchRes.ok) {
      const errBody = await this.parseJson(patchRes);
      throw new Error(`Google People updateContact failed: HTTP ${patchRes.status} — ${(errBody as { error?: { message?: string } }).error?.message ?? 'unknown error'}`);
    }
  }

  async deleteContact(params: DeleteContactParams): Promise<void> {
    const token = await this.getToken();
    const res = await fetch(`${PEOPLE_API_BASE_URL}/${params.providerContactId}:deleteContact`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await this.parseJson(res);
      throw new Error(`Google People deleteContact failed: HTTP ${res.status} — ${(body as { error?: { message?: string } }).error?.message ?? 'unknown error'}`);
    }
  }

  private toPersonBody(params: Partial<ContactParams>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (params.displayName !== undefined) {
      const [givenName, ...rest] = params.displayName.split(' ');
      body.names = [{ givenName, familyName: rest.join(' ') || undefined }];
    }
    if (params.emailAddress !== undefined) {
      body.emailAddresses = [{ value: params.emailAddress }];
    }
    if (params.phoneNumber !== undefined) {
      body.phoneNumbers = [{ value: params.phoneNumber }];
    }
    if (params.companyName !== undefined || params.jobTitle !== undefined) {
      body.organizations = [{ name: params.companyName, title: params.jobTitle }];
    }
    return body;
  }

  private async getToken(): Promise<string> {
    const config = await this.getConfig();
    return acquireGoogleAccessToken(config.clientId, config.clientSecret, config.refreshToken);
  }

  private async getConfig(): Promise<ResolvedGoogleConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedGoogleConfig> {
    const providerId = process.env.EMAIL_SMTP_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'EMAIL_SMTP_PROVIDER_ID is not set. GoogleContactsProvider reuses the same IntegrationProvider row as the GMAIL_EMAIL email driver / GoogleCalendarProvider (category EMAIL, providerCode "GMAIL_EMAIL") — config {clientId}, credentials {clientSecret, refreshToken}. Ensure the OAuth consent also granted the People API contacts scope.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== 'GMAIL_EMAIL') {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "GMAIL_EMAIL"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (GMAIL_EMAIL) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const clientId = config.clientId as string | undefined;
    if (!clientId) {
      throw new Error(`Integration provider ${providerId} is missing config.clientId`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    const refreshToken = credentials?.refreshToken as string | undefined;
    if (!clientSecret || !refreshToken) {
      const missing = [!clientSecret && 'clientSecret', !refreshToken && 'refreshToken'].filter(Boolean);
      throw new Error(`Integration provider ${providerId} is missing credentials.${missing.join(', credentials.')}`);
    }

    return { clientId, clientSecret, refreshToken };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
