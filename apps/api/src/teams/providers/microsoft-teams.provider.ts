import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireMicrosoftGraphToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { TeamsProviderRegistry } from '../teams-provider.registry';
import { CancelMeetingParams, CreateMeetingParams, CreateMeetingResult, TeamsProvider } from '../teams-provider.interface';

export const MS_GRAPH_TEAMS_PROVIDER_CODE = 'MS_GRAPH';
const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface ResolvedGraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface GraphOnlineMeetingResponse {
  id: string;
  joinWebUrl?: string;
  joinUrl?: string;
  [key: string]: unknown;
}

interface GraphErrorResponse {
  error?: { message?: string; code?: string };
}

/**
 * Release IG.1, Checkpoint R — the first concrete TeamsProvider,
 * mirroring MicrosoftGraphPresenceProvider's own Checkpoint O exactly,
 * down to the doc comment structure and config-resolution/caching
 * shape.
 *
 * WHY THE SAME IntegrationProvider ROW AS THE EMAIL/CALENDAR/CONTACTS/
 * TASKS/PRESENCE DRIVERS: same reasoning MicrosoftGraphPresenceProvider's
 * own doc comment gives — reuses EMAIL_SMTP_PROVIDER_ID (config
 * {tenantId, clientId, senderUserId}, credentials {clientSecret}) rather
 * than a seventh IntegrationProvider row for the identical Azure AD app
 * registration. Operationally this DOES require that app registration
 * to also be granted the OnlineMeetings.ReadWrite.All *application*
 * permission (on top of Mail.Send, Calendars.ReadWrite, Contacts.ReadWrite,
 * Tasks.ReadWrite, and Presence.Read.All) — a deployment/permissions
 * concern, not a code one; Graph returns a 403 clearly if that grant is
 * missing rather than failing silently, surfaced via the same
 * error-message shape every sibling provider already uses.
 *
 * Unlike Calendar/Contacts/Tasks, this provider does NOT read
 * config.senderUserId — teams-provider.interface.ts's own design notes
 * deliberately made `organizerIdentifier` a per-call param (same posture
 * Presence's own `userIdentifier` design note takes), because a Teams
 * meeting's organizer varies per call (whichever employee is running
 * the interview/meeting), unlike Calendar/Contacts/Tasks which always
 * act as one fixed mailbox. Only tenantId/clientId/clientSecret are
 * resolved from the shared row here.
 *
 * Token acquisition reuses @7f/config's acquireMicrosoftGraphToken — the
 * same helper the mail service, the email health-check driver, and the
 * Calendar/Contacts/Tasks/Presence providers all already call, not a
 * seventh copy of the client-credentials POST.
 */
@Injectable()
export class MicrosoftTeamsProvider implements TeamsProvider, OnModuleInit {
  private resolved: Promise<ResolvedGraphConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: TeamsProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(MS_GRAPH_TEAMS_PROVIDER_CODE, this);
  }

  async createMeeting(params: CreateMeetingParams): Promise<CreateMeetingResult> {
    const { token } = await this.getAuth();

    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(params.organizerIdentifier)}/onlineMeetings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: params.subject,
        startDateTime: params.startTime.toISOString(),
        endDateTime: params.endTime.toISOString(),
      }),
    });

    const json = (await this.parseJson(res)) as GraphOnlineMeetingResponse & GraphErrorResponse;
    if (!res.ok) {
      throw new Error(`Microsoft Graph create online meeting failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    // Graph's own field is joinWebUrl; joinUrl is only checked as a
    // fallback in case a future API version renames it — see
    // getPresence's identical "don't assume a field is always present"
    // posture in MicrosoftGraphPresenceProvider.
    const joinUrl = json.joinWebUrl ?? json.joinUrl;
    if (!joinUrl) {
      throw new Error('Microsoft Graph create online meeting succeeded but returned no joinWebUrl');
    }

    return { providerMeetingId: json.id, joinUrl };
  }

  async cancelMeeting(params: CancelMeetingParams): Promise<void> {
    const { token } = await this.getAuth();

    // DELETE, not a "cancel" sub-resource — unlike calendar events,
    // Graph's onlineMeeting resource has no cancel action that notifies
    // attendees; the meeting is simply removed. Any attendee
    // notification for a cancelled meeting is the calendar event's job
    // (CalendarProvider.cancelEvent), not this provider's.
    const res = await fetch(
      `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(params.organizerIdentifier)}/onlineMeetings/${encodeURIComponent(params.providerMeetingId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok && res.status !== 404) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph cancel online meeting failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
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
        'EMAIL_SMTP_PROVIDER_ID is not set. MicrosoftTeamsProvider reuses the same IntegrationProvider row as the MS_GRAPH_EMAIL email driver (category EMAIL, providerCode "MS_GRAPH_EMAIL") — config {tenantId, clientId}, credentials {clientSecret}. Ensure the underlying Azure AD app registration is also granted the OnlineMeetings.ReadWrite.All application permission.',
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
    // senderUserId is part of this shared IntegrationProvider row's
    // config (needed by the Calendar/Tasks/Contacts providers, which
    // act AS that mailbox), but this provider doesn't act as anyone
    // fixed — createMeeting's organizerIdentifier param IS the
    // organizer — so it's intentionally not read or validated here,
    // same posture MicrosoftGraphPresenceProvider's own resolveConfig
    // takes.
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
