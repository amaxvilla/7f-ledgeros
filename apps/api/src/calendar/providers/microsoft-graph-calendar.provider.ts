import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquireMicrosoftGraphToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { CalendarProviderRegistry } from '../calendar-provider.registry';
import {
  CalendarProvider,
  CancelEventParams,
  CreateEventParams,
  CreateEventResult,
  UpdateEventParams,
} from '../calendar-provider.interface';

export const MS_GRAPH_CALENDAR_PROVIDER_CODE = 'MS_GRAPH';
const GRAPH_API_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface ResolvedGraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderUserId: string;
}

interface GraphEventResponse {
  id: string;
  webLink?: string;
  [key: string]: unknown;
}

interface GraphErrorResponse {
  error?: { message?: string; code?: string };
}

/**
 * Release IG.1, Checkpoint B — the first concrete CalendarProvider.
 *
 * WHY THE SAME IntegrationProvider ROW AS THE EMAIL DRIVER: this reuses
 * EMAIL_SMTP_PROVIDER_ID (notifications/providers/microsoft-graph-email-health-check.driver.ts's
 * own env var — historically named for the email queue's primary
 * provider slot, not the vendor) rather than requiring a second row,
 * the same deliberate reuse call PaystackBankProvider
 * (bank-integration/providers/paystack-bank.provider.ts) made for its
 * own Azure/Paystack credentials: an Azure AD app registration is one
 * set of client-credentials that can be granted MULTIPLE Graph API
 * permissions (Mail.Send AND Calendars.ReadWrite both scoped to the
 * same app) — tenantId/clientId/clientSecret/senderUserId is exactly
 * the config/credential shape this needs too, and creating a second
 * IntegrationProvider row for the same underlying app registration
 * would be exactly the kind of duplication these instructions warn
 * against. Operationally this DOES require whoever administers the
 * Azure AD app to have granted it Calendars.ReadWrite (not just
 * Mail.Send) — a deployment/permissions concern, not a code one, and
 * this provider's own error messages surface a Graph 403 clearly if
 * that grant is missing rather than failing silently.
 *
 * senderUserId doubles as both "which mailbox sends the mail" (email
 * driver) and "which calendar the event is created on" here — Graph's
 * /users/{id}/events endpoint addresses a specific user's calendar the
 * same way /users/{id}/sendMail addresses a specific user's mailbox.
 *
 * Token acquisition reuses @7f/config's acquireMicrosoftGraphToken —
 * same helper apps/worker's MicrosoftGraphMailService and this driver's
 * own health-check sibling both already call, not a fourth copy of the
 * client-credentials POST.
 */
@Injectable()
export class MicrosoftGraphCalendarProvider implements CalendarProvider, OnModuleInit {
  private resolved: Promise<ResolvedGraphConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: CalendarProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(MS_GRAPH_CALENDAR_PROVIDER_CODE, this);
  }

  async createEvent(params: CreateEventParams): Promise<CreateEventResult> {
    const { token, senderUserId } = await this.getAuth();

    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toGraphEventBody(params)),
    });

    const json = (await this.parseJson(res)) as GraphEventResponse & GraphErrorResponse;
    if (!res.ok) {
      throw new Error(`Microsoft Graph create event failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }

    return { providerEventId: json.id, htmlLink: json.webLink };
  }

  async updateEvent(params: UpdateEventParams): Promise<void> {
    const { token, senderUserId } = await this.getAuth();
    const { providerEventId, ...rest } = params;

    const res = await fetch(`${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/events/${encodeURIComponent(providerEventId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toGraphEventBody(rest)),
    });

    if (!res.ok) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph update event failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  async cancelEvent(params: CancelEventParams): Promise<void> {
    const { token, senderUserId } = await this.getAuth();

    // POST .../cancel (not DELETE) — Graph sends a cancellation notice to
    // every attendee this way, which DELETE does not do. That's the
    // whole point of "cancelling" a scheduled appointment rather than
    // just deleting our own record of it.
    const res = await fetch(
      `${GRAPH_API_BASE_URL}/users/${encodeURIComponent(senderUserId)}/events/${encodeURIComponent(params.providerEventId)}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: params.comment ?? '' }),
      },
    );

    if (!res.ok) {
      const json = (await this.parseJson(res)) as GraphErrorResponse;
      throw new Error(`Microsoft Graph cancel event failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  /** Shared by createEvent/updateEvent — Graph's event resource shape is
   *  identical for POST (full) and PATCH (partial), just with different
   *  fields present, so `Partial<CreateEventParams>` covers both. */
  private toGraphEventBody(params: Partial<CreateEventParams>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (params.title !== undefined) body.subject = params.title;
    if (params.description !== undefined) body.body = { contentType: 'text', content: params.description };
    if (params.startTime !== undefined) body.start = { dateTime: params.startTime.toISOString(), timeZone: 'UTC' };
    if (params.endTime !== undefined) body.end = { dateTime: params.endTime.toISOString(), timeZone: 'UTC' };
    if (params.location !== undefined) body.location = { displayName: params.location };
    if (params.attendeeEmails !== undefined) {
      body.attendees = params.attendeeEmails.map((address) => ({ emailAddress: { address }, type: 'required' }));
    }
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
        'EMAIL_SMTP_PROVIDER_ID is not set. MicrosoftGraphCalendarProvider reuses the same IntegrationProvider row as the MS_GRAPH_EMAIL email driver (category EMAIL, providerCode "MS_GRAPH_EMAIL") — config {tenantId, clientId, senderUserId}, credentials {clientSecret}. Ensure the underlying Azure AD app registration is also granted the Calendars.ReadWrite permission.',
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
