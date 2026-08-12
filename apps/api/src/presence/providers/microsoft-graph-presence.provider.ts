import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireMicrosoftGraphToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PresenceProviderRegistry } from '../presence-provider.registry';
import { PresenceProvider, PresenceResult } from '../presence-provider.interface';

export const MS_GRAPH_PRESENCE_PROVIDER_CODE = 'MS_GRAPH';
const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface ResolvedGraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface GraphPresenceResponse {
  availability?: string;
  activity?: string;
  [key: string]: unknown;
}

interface GraphErrorResponse {
  error?: { message?: string; code?: string };
}

/**
 * Release IG.1, Checkpoint O — the first concrete PresenceProvider,
 * mirroring MicrosoftGraphTasksProvider's own Checkpoint L exactly, down
 * to the doc comment structure and config-resolution/caching shape. No
 * default-list-style resolution needed here — presence-provider.interface.ts's
 * `userIdentifier` maps straight onto Graph's own `/users/{id}` path
 * segment, which accepts either an AAD object id or a userPrincipalName
 * (typically an email address) interchangeably, so there is nothing to
 * pre-resolve or cache beyond the config/token every sibling provider
 * already caches.
 *
 * WHY THE SAME IntegrationProvider ROW AS THE EMAIL/CALENDAR/CONTACTS/
 * TASKS DRIVERS: same reasoning MicrosoftGraphTasksProvider's own doc
 * comment gives — reuses EMAIL_SMTP_PROVIDER_ID (config {tenantId,
 * clientId, senderUserId}, credentials {clientSecret}) rather than a
 * sixth IntegrationProvider row for the identical Azure AD app
 * registration. Operationally this DOES require that app registration
 * to also be granted the Presence.Read.All *application* permission (on
 * top of Mail.Send, Calendars.ReadWrite, Contacts.ReadWrite, and
 * Tasks.ReadWrite) — a deployment/permissions concern, not a code one;
 * Graph returns a 403 clearly if that grant is missing rather than
 * failing silently, surfaced via the same error-message shape every
 * sibling provider already uses.
 *
 * Token acquisition reuses @7f/config's acquireMicrosoftGraphToken — the
 * same helper the mail service, the email health-check driver, and the
 * Calendar/Contacts/Tasks providers all already call, not a sixth copy
 * of the client-credentials POST.
 */
@Injectable()
export class MicrosoftGraphPresenceProvider implements PresenceProvider, OnModuleInit {
  private resolved: Promise<ResolvedGraphConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: PresenceProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(MS_GRAPH_PRESENCE_PROVIDER_CODE, this);
  }

  async getPresence(userIdentifier: string): Promise<PresenceResult> {
    const { token } = await this.getAuth();

    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(userIdentifier)}/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = (await this.parseJson(res)) as GraphPresenceResponse & GraphErrorResponse;
    if (!res.ok) {
      throw new Error(`Microsoft Graph get presence failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    // Graph's presence resource always includes both fields for a valid
    // user, but this provider doesn't assume that — a caller getting back
    // "PresenceUnknown" for a missing field is a much better failure mode
    // than getPresence() throwing on an otherwise-successful 200 response.
    return {
      availability: json.availability ?? 'PresenceUnknown',
      activity: json.activity ?? 'PresenceUnknown',
    };
  }

  private async getAuth(): Promise<{ token: string }> {
    const config = await this.getConfig();
    const token = await acquireMicrosoftGraphToken(config.tenantId, config.clientId, config.clientSecret);
    return { token };
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
        'EMAIL_SMTP_PROVIDER_ID is not set. MicrosoftGraphPresenceProvider reuses the same IntegrationProvider row as the MS_GRAPH_EMAIL email driver (category EMAIL, providerCode "MS_GRAPH_EMAIL") — config {tenantId, clientId, senderUserId}, credentials {clientSecret}. Ensure the underlying Azure AD app registration is also granted the Presence.Read.All application permission.',
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
    // senderUserId is part of this shared IntegrationProvider row's config
    // (needed by the Calendar/Tasks/Contacts providers, which act AS that
    // mailbox), but this provider doesn't act as anyone — getPresence's
    // userIdentifier param IS the user being looked up — so it's
    // intentionally not read or validated here.
    const missing = ['tenantId', 'clientId'].filter((k) => !config[k]);
    if (missing.length) {
      throw new Error(`Integration provider ${providerId} is missing config.${missing.join(', config.')}`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    if (!clientSecret) {
      throw new Error(`Integration provider ${providerId} is missing credentials.clientSecret`);
    }

    return { tenantId: tenantId!, clientId: clientId!, clientSecret };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
