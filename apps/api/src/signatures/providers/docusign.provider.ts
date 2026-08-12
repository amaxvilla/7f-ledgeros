import { Injectable, OnModuleInit } from '@nestjs/common';
import { IntegrationsService } from '../../integrations/integrations.service';
import { SignatureProviderRegistry } from '../signature-provider.registry';
import {
  SendForSignatureParams,
  SendForSignatureResult,
  SignatureProvider,
  SignatureStatus,
  SignatureStatusResult,
  VoidEnvelopeParams,
} from '../signature-provider.interface';

export const DOCUSIGN_PROVIDER_CODE = 'DOCUSIGN';

type DocuSignEnvironment = 'demo' | 'production';

/**
 * DocuSign uses entirely separate OAuth account servers per environment
 * — account-d.docusign.com for demo/sandbox accounts,
 * account.docusign.com for production ones. Fixed here (was previously
 * a single hardcoded OAUTH_TOKEN_URL constant pointing only at demo —
 * see the "environment is now configurable" note in this class's own
 * doc comment for why that was flagged as a defect rather than left).
 */
const DOCUSIGN_OAUTH_TOKEN_URLS: Record<DocuSignEnvironment, string> = {
  demo: 'https://account-d.docusign.com/oauth/token',
  production: 'https://account.docusign.com/oauth/token',
};

interface ResolvedDocuSignConfig {
  baseUri: string;
  accountId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  environment: DocuSignEnvironment;
}

interface DocuSignEnvelopeResponse {
  envelopeId: string;
  status?: string;
  [key: string]: unknown;
}

interface DocuSignErrorResponse {
  message?: string;
  errorCode?: string;
}

/**
 * Digital Signature Providers, Checkpoint B — the first concrete
 * SignatureProvider, registering into the SignatureProviderRegistry
 * built in Checkpoint A. Nothing calls it yet — see this class's own
 * "no caller" note below and the checkpoint report for why that's a
 * deliberately separate later checkpoint, the same sequencing
 * Calendar/Contacts/Presence/Transfer all used (provider before caller).
 *
 * WHY OAUTH2 AUTHORIZATION-CODE + REFRESH-TOKEN, NOT JWT GRANT: DocuSign's
 * own recommended server-to-server flow is JWT Grant, which requires
 * generating an RSA keypair, registering its public key with DocuSign,
 * and signing a JWT assertion with the private key on every token
 * request. This codebase has no existing RSA-signing capability, and
 * GoogleCalendarProvider (calendar/providers/google-calendar.provider.ts)
 * already made and documented the identical tradeoff for Google Calendar
 * — service-account/domain-wide-delegation vs. the simpler refresh-token
 * flow — for the same reason: a new crypto flow, a new credential shape,
 * and a new admin-console setup step is a bigger, riskier addition than
 * reusing the OAuth2 refresh-token pattern this codebase already has
 * three working examples of (Gmail, Google Calendar, Google Drive).
 * DocuSign's Authorization Code Grant supports the same refresh-token
 * shape those three use.
 *
 * WHY ITS OWN IntegrationProvider ROW: unlike MicrosoftGraphCalendarProvider/
 * GoogleCalendarProvider reusing an existing email row, DocuSign is an
 * entirely separate vendor with its own app registration (DocuSign Admin
 * > Apps and Keys) — there is no existing row whose credentials this
 * could legitimately share, the same reasoning GoogleDriveStorageProvider
 * gave for why IT needed a dedicated row despite also being a Google
 * product (folderId there, baseUri/accountId here, are both concepts no
 * other existing row has any reason to carry). SIGNATURE_DOCUSIGN_PROVIDER_ID
 * (env), category DIGITAL_SIGNATURE (already in the IntegrationCategory
 * enum — added ahead of this checkpoint, no schema change needed here),
 * providerCode "DOCUSIGN", config {baseUri, accountId, clientId},
 * credentials {clientSecret, refreshToken}.
 *
 * baseUri/accountId are DocuSign-account-specific (which data center,
 * which account) and are obtained once by whoever sets up the
 * IntegrationProvider row via DocuSign's own OAuth UserInfo endpoint
 * during initial app authorization — a one-time setup step, not
 * something this provider re-discovers on every call.
 *
 * TOKEN ACQUISITION IS NOT EXTRACTED TO @7f/config: unlike
 * acquireMicrosoftGraphToken/acquireGoogleAccessToken, which are shared
 * because THREE+ providers each in the Microsoft/Google families reuse
 * them, DocuSign has exactly one provider so far — extracting a
 * one-caller function to a shared package ahead of a second consumer
 * existing would be speculative reuse, not actual reuse. Revisit if/when
 * a second DocuSign-consuming provider appears.
 *
 * ENVIRONMENT IS CONFIGURABLE (config.environment: 'demo' | 'production'):
 * DocuSign demo/sandbox accounts authenticate against
 * account-d.docusign.com; production accounts against
 * account.docusign.com — two entirely separate OAuth account servers,
 * not a path/query difference on one host. resolveConfig defaults to
 * 'demo' when config.environment is unset, the safer default (a
 * misconfigured demo integration fails loudly against demo; a
 * misconfigured "assume production" default would instead risk quietly
 * sending real, binding signature requests through a sandbox — or the
 * reverse, sandbox testing accidentally hitting production). Mirrors
 * how AwsS3StorageProvider reads config.region — a plain config field
 * read once at resolveConfig time, not re-derived per call.
 */
@Injectable()
export class DocuSignProvider implements SignatureProvider, OnModuleInit {
  private resolved: Promise<ResolvedDocuSignConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: SignatureProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(DOCUSIGN_PROVIDER_CODE, this);
  }

  async sendForSignature(params: SendForSignatureParams): Promise<SendForSignatureResult> {
    const { token, baseUri, accountId } = await this.getAuth();

    const body = {
      emailSubject: params.subject ?? `Please sign: ${params.documentName}`,
      emailBlurb: params.message,
      documents: [
        {
          documentId: '1',
          name: params.documentName,
          fileExtension: this.inferExtension(params.documentName, params.documentContentType),
          documentBase64: params.documentBuffer.toString('base64'),
        },
      ],
      recipients: {
        signers: params.signers.map((signer, index) => ({
          email: signer.email,
          name: signer.name,
          recipientId: String(index + 1),
          routingOrder: String(index + 1),
        })),
      },
      status: 'sent',
    };

    const res = await fetch(`${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await this.parseJson(res)) as DocuSignEnvelopeResponse & DocuSignErrorResponse;
    if (!res.ok) {
      throw new Error(`DocuSign create envelope failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    return { providerEnvelopeId: json.envelopeId };
  }

  async getStatus(providerEnvelopeId: string): Promise<SignatureStatusResult> {
    const { token, baseUri, accountId } = await this.getAuth();

    const res = await fetch(`${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(providerEnvelopeId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = (await this.parseJson(res)) as DocuSignEnvelopeResponse & DocuSignErrorResponse;
    if (!res.ok) {
      throw new Error(`DocuSign get envelope failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    return { status: this.mapDocuSignStatus(json.status ?? '') };
  }

  async downloadSignedDocument(providerEnvelopeId: string): Promise<Buffer> {
    const { token, baseUri, accountId } = await this.getAuth();

    const res = await fetch(
      `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(providerEnvelopeId)}/documents/combined`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      const json = (await this.parseJson(res)) as DocuSignErrorResponse;
      throw new Error(`DocuSign download document failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async voidEnvelope(params: VoidEnvelopeParams): Promise<void> {
    const { token, baseUri, accountId } = await this.getAuth();

    const res = await fetch(
      `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${encodeURIComponent(params.providerEnvelopeId)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'voided', voidedReason: params.reason ?? '' }),
      },
    );

    if (!res.ok) {
      const json = (await this.parseJson(res)) as DocuSignErrorResponse;
      throw new Error(`DocuSign void envelope failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }
  }

  /** DocuSign needs a fileExtension separate from the document name/content
   *  type — derived from the name when it has one, falling back to a
   *  contentType lookup for the common cases this codebase actually sends
   *  (PDF being overwhelmingly the expected case for signable documents). */
  private inferExtension(documentName: string, contentType: string): string {
    const fromName = documentName.split('.').pop();
    if (fromName && fromName !== documentName) return fromName;
    if (contentType === 'application/pdf') return 'pdf';
    return 'pdf'; // safe default — DocuSign envelopes are overwhelmingly PDF
  }

  /**
   * DocuSign's own status vocabulary (lowercase: created, sent, delivered,
   * completed, declined, voided, and several others for more advanced
   * workflows this codebase doesn't use) mapped down to SignatureStatus,
   * the same deliberate-narrowing PaystackProvider.mapPaystackStatus uses
   * for Paystack's own wider vocabulary. "created" (an envelope saved as
   * a draft, not yet sent) has no real analog in SignatureStatus — every
   * envelope this provider creates is sent immediately (status: 'sent'
   * in the create-envelope body above), so a caller should never actually
   * observe "created" in practice; still mapped to SENT rather than
   * throwing, the same safe-default posture as the other statuses this
   * union doesn't have an exact match for.
   */
  private mapDocuSignStatus(docuSignStatus: string): SignatureStatus {
    switch (docuSignStatus.toLowerCase()) {
      case 'delivered':
        return 'DELIVERED';
      case 'completed':
        return 'COMPLETED';
      case 'declined':
        return 'DECLINED';
      case 'voided':
        return 'VOIDED';
      case 'sent':
      case 'created':
      default:
        return 'SENT';
    }
  }

  private async getAuth(): Promise<{ token: string; baseUri: string; accountId: string }> {
    const config = await this.getConfig();
    const token = await this.acquireAccessToken(config.clientId, config.clientSecret, config.refreshToken, config.environment);
    return { token, baseUri: config.baseUri, accountId: config.accountId };
  }

  /** Not cached (a fresh token is acquired per call) — same posture
   *  GoogleCalendarProvider/MicrosoftGraphCalendarProvider both take;
   *  see their own getToken()/getAuth() for the identical tradeoff. */
  private async acquireAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    environment: DocuSignEnvironment,
  ): Promise<string> {
    const res = await fetch(DOCUSIGN_OAUTH_TOKEN_URLS[environment], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DocuSign token acquisition failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new Error('DocuSign token response had no access_token');
    }
    return json.access_token;
  }

  private async getConfig(): Promise<ResolvedDocuSignConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedDocuSignConfig> {
    const providerId = process.env.SIGNATURE_DOCUSIGN_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'SIGNATURE_DOCUSIGN_PROVIDER_ID is not set. Create an IntegrationProvider (category DIGITAL_SIGNATURE, providerCode "DOCUSIGN") with config {baseUri, accountId, clientId, environment?: "demo" | "production"} and credentials {clientSecret, refreshToken}, then set SIGNATURE_DOCUSIGN_PROVIDER_ID to its id.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== 'DOCUSIGN') {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "DOCUSIGN"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (DOCUSIGN) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const baseUri = config.baseUri as string | undefined;
    const accountId = config.accountId as string | undefined;
    const clientId = config.clientId as string | undefined;
    const missingConfig = [!baseUri && 'baseUri', !accountId && 'accountId', !clientId && 'clientId'].filter(Boolean);
    if (missingConfig.length) {
      throw new Error(`Integration provider ${providerId} is missing config.${missingConfig.join(', config.')}`);
    }

    // Defaults to 'demo' (the safer default) when unset — see this
    // class's own doc comment for why "assume production" would be the
    // riskier default here.
    const environmentRaw = (config.environment as string | undefined) ?? 'demo';
    if (environmentRaw !== 'demo' && environmentRaw !== 'production') {
      throw new Error(`Integration provider ${providerId} has invalid config.environment "${environmentRaw}" — must be "demo" or "production"`);
    }
    const environment = environmentRaw as DocuSignEnvironment;

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    const refreshToken = credentials?.refreshToken as string | undefined;
    const missingCredentials = [!clientSecret && 'clientSecret', !refreshToken && 'refreshToken'].filter(Boolean);
    if (missingCredentials.length) {
      throw new Error(`Integration provider ${providerId} is missing credentials.${missingCredentials.join(', credentials.')}`);
    }

    return { baseUri: baseUri!, accountId: accountId!, clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken!, environment };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
