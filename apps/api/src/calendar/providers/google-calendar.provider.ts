import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireGoogleAccessToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { CalendarProviderRegistry } from '../calendar-provider.registry';
import {
  CalendarProvider,
  CancelEventParams,
  CreateEventParams,
  CreateEventResult,
  UpdateEventParams,
} from '../calendar-provider.interface';

export const GOOGLE_CALENDAR_PROVIDER_CODE = 'GOOGLE_CALENDAR';
const CALENDAR_API_BASE_URL = 'https://www.googleapis.com/calendar/v3';

interface ResolvedGoogleConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GoogleEventResponse {
  id: string;
  htmlLink?: string;
  [key: string]: unknown;
}

interface GoogleErrorResponse {
  error?: { message?: string; code?: number };
}

/**
 * Release IH (Google Workspace), Checkpoint A — the first concrete
 * CalendarProvider besides MicrosoftGraphCalendarProvider, registering
 * into the SAME CalendarProviderRegistry that provider already uses
 * (calendar-provider.registry.ts, built in Release IG.1 Checkpoint A) —
 * exactly the extensibility that registry's own doc comment named
 * Google Workspace as the reason for existing. No registry change was
 * needed for this: CalendarProviderRegistry.register(providerCode, this)
 * already accepts any providerCode.
 *
 * WHY REFRESH-TOKEN, NOT SERVICE-ACCOUNT/DOMAIN-WIDE-DELEGATION: Google
 * Calendar API does support acting as an arbitrary Workspace user via a
 * service account + domain-wide delegation, which would be the closer
 * architectural parallel to Microsoft Graph's app-only + senderUserId
 * flow. This provider deliberately does NOT do that, for the same
 * reason GmailMailService (Release IC.3, apps/worker/src/mail/
 * gmail-mail.service.ts) chose the simpler refresh-token flow over
 * domain-wide delegation: this codebase has no existing service-account
 * JWT-signing capability, and introducing one — a new crypto flow, a
 * new credential shape (a full JSON key, not a client id/secret/refresh
 * token triple), a new Workspace-admin-console setup step — for this
 * one checkpoint would be a bigger, riskier addition than reusing the
 * pattern already proven out and already configured for Gmail. Like
 * Gmail, this provider is therefore scoped to exactly ONE calendar (the
 * "primary" calendar of whichever Google account the stored refresh
 * token was granted for), not an arbitrary one per call — see
 * CreateEventParams' own doc comment for why this interface never took
 * a per-call target-mailbox/calendar parameter to begin with (Microsoft's
 * senderUserId is fixed at config-resolution time too, not per-call).
 *
 * WHY THE SAME IntegrationProvider ROW AS THE GMAIL EMAIL DRIVER: same
 * reuse call MicrosoftGraphCalendarProvider made for MS_GRAPH_EMAIL —
 * one OAuth client (clientId/clientSecret) can be granted multiple
 * scopes (gmail.send AND calendar.events both consented to by the same
 * refresh token), so a second IntegrationProvider row would duplicate
 * the exact same credential. Operationally this DOES require the
 * refresh token to have been issued with the Calendar scope granted
 * during the original OAuth consent (not just Gmail's) — a
 * configuration/consent concern, not a code one; a 403 from Google
 * surfaces clearly if that scope is missing rather than failing
 * silently.
 *
 * KNOWN LIMITATION: CancelEventParams.comment has no Google Calendar
 * equivalent — Graph's dedicated /cancel endpoint accepts a note sent to
 * attendees; Google's DELETE .../events/{id} has no comment field at
 * all. cancelEvent here silently does not forward `comment` — documented
 * here rather than papered over with an unrequested workaround (e.g.
 * patching the event description first).
 *
 * Token acquisition reuses @7f/config's acquireGoogleAccessToken — the
 * same helper GmailMailService and GmailEmailHealthCheckDriver already
 * call, not a second copy of the refresh-token POST.
 */
@Injectable()
export class GoogleCalendarProvider implements CalendarProvider, OnModuleInit {
  private resolved: Promise<ResolvedGoogleConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: CalendarProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(GOOGLE_CALENDAR_PROVIDER_CODE, this);
  }

  async createEvent(params: CreateEventParams): Promise<CreateEventResult> {
    const token = await this.getToken();

    const res = await fetch(`${CALENDAR_API_BASE_URL}/calendars/primary/events?sendUpdates=all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toGoogleEventBody(params)),
    });

    const json = (await this.parseJson(res)) as GoogleEventResponse & GoogleErrorResponse;
    if (!res.ok) {
      throw new Error(`Google Calendar create event failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    return { providerEventId: json.id, htmlLink: json.htmlLink };
  }

  async updateEvent(params: UpdateEventParams): Promise<void> {
    const token = await this.getToken();
    const { providerEventId, ...rest } = params;

    const res = await fetch(`${CALENDAR_API_BASE_URL}/calendars/primary/events/${encodeURIComponent(providerEventId)}?sendUpdates=all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toGoogleEventBody(rest)),
    });

    if (!res.ok) {
      const json = (await this.parseJson(res)) as GoogleErrorResponse;
      throw new Error(`Google Calendar update event failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  async cancelEvent(params: CancelEventParams): Promise<void> {
    const token = await this.getToken();

    // DELETE, not Graph's dedicated /cancel — sendUpdates=all is what
    // notifies attendees here; see class doc comment for why `comment`
    // isn't (and can't be) forwarded.
    const res = await fetch(`${CALENDAR_API_BASE_URL}/calendars/primary/events/${encodeURIComponent(params.providerEventId)}?sendUpdates=all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    // Google returns 410 Gone for an already-deleted event — treated as
    // success (the end state the caller wants is already true), same
    // idempotency stance NotificationsService.markRead takes for an
    // already-read notification.
    if (!res.ok && res.status !== 410) {
      const json = (await this.parseJson(res)) as GoogleErrorResponse;
      throw new Error(`Google Calendar cancel event failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  private toGoogleEventBody(params: Partial<CreateEventParams>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (params.title !== undefined) body.summary = params.title;
    if (params.description !== undefined) body.description = params.description;
    if (params.startTime !== undefined) body.start = { dateTime: params.startTime.toISOString(), timeZone: 'UTC' };
    if (params.endTime !== undefined) body.end = { dateTime: params.endTime.toISOString(), timeZone: 'UTC' };
    if (params.location !== undefined) body.location = params.location;
    if (params.attendeeEmails !== undefined) {
      body.attendees = params.attendeeEmails.map((email) => ({ email }));
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
        'EMAIL_SMTP_PROVIDER_ID is not set. GoogleCalendarProvider reuses the same IntegrationProvider row as the GMAIL_EMAIL email driver (category EMAIL, providerCode "GMAIL_EMAIL") — config {clientId}, credentials {clientSecret, refreshToken}. Ensure the OAuth consent this refresh token was issued under also granted the Calendar scope (not just Gmail\'s).',
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
