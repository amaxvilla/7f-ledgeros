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

export const ADOBE_SIGN_PROVIDER_CODE = 'ADOBE_SIGN';

interface ResolvedAdobeSignConfig {
  baseUri: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface AdobeTransientDocumentResponse {
  transientDocumentId: string;
}

interface AdobeAgreementCreateResponse {
  id: string;
}

interface AdobeAgreementStatusResponse {
  status?: string;
  [key: string]: unknown;
}

interface AdobeErrorResponse {
  message?: string;
  code?: string;
}

/**
 * Digital Signature Providers, Checkpoint F — the second concrete
 * SignatureProvider (SignatureProvider's own interface doc comment named
 * this as a planned sibling to DocuSignProvider from Checkpoint B).
 * Registers into the same SignatureProviderRegistry DocuSignProvider
 * does; OfferService (Checkpoint C's caller) is still hardcoded to
 * DOCUSIGN_PROVIDER_CODE — making the caller provider-selectable, rather
 * than always DocuSign, is a later checkpoint, the same sequencing
 * DocuSignProvider's own doc comment used ("provider before caller").
 *
 * WHY TWO API CALLS TO SEND (transientDocuments THEN agreements), UNLIKE
 * DocuSignProvider's SINGLE create-envelope CALL: Adobe Sign's REST API
 * doesn't accept inline document bytes in the agreement-creation body
 * the way DocuSign's documentBase64 field does — a document must first
 * be uploaded to POST /transientDocuments (multipart/form-data,
 * returning a short-lived transientDocumentId), which the agreement
 * body then references via fileInfos: [{transientDocumentId}]. This is
 * Adobe Sign's own documented two-step flow, not an added abstraction
 * layer here.
 *
 * WHY OAUTH2 REFRESH-TOKEN, SAME AS DocuSignProvider: Adobe Sign's REST
 * API v6 supports the identical Authorization Code Grant + refresh-token
 * flow DocuSignProvider already uses, so this reuses the exact same
 * config/credential shape (config {baseUri, clientId}, credentials
 * {clientSecret, refreshToken}) rather than introducing a different auth
 * pattern for the one other provider in this registry.
 *
 * WHY ITS OWN IntegrationProvider ROW: Adobe Sign is an entirely
 * separate vendor with its own app registration (Adobe Sign API
 * Application, from adobesign.com's account admin), the same reasoning
 * DocuSignProvider's own doc comment gives for why IT needed a dedicated
 * row rather than sharing one. SIGNATURE_ADOBE_SIGN_PROVIDER_ID (env),
 * category DIGITAL_SIGNATURE (the same enum value DocuSignProvider
 * already uses — one category, multiple provider rows, exactly like
 * BankProvider/PaymentProvider's own multi-row categories), providerCode
 * "ADOBE_SIGN".
 *
 * baseUri IS THE SHARD, NOT A DEMO/PRODUCTION SWITCH: Adobe Sign
 * accounts are provisioned onto one of several regional API shards
 * (api.na1.adobesign.com, api.na2.adobesign.com, api.eu1.adobesign.com,
 * etc.) — both the REST API and its OAuth token endpoint live on that
 * same shard host, discovered once by whoever sets up the
 * IntegrationProvider row (via Adobe's baseUris endpoint during initial
 * app authorization) and stored as config.baseUri, the same one-time-setup
 * posture DocuSignProvider's own baseUri/accountId config fields have.
 * Unlike DocuSign, there is no separate demo-vs-production OAuth host to
 * pick between here — Adobe Sign has no config.environment field for
 * that reason.
 *
 * TOKEN ACQUISITION IS NOT EXTRACTED TO @7f/config OR SHARED WITH
 * DocuSignProvider: same reasoning DocuSignProvider's own doc comment
 * gives for not sharing with acquireMicrosoftGraphToken/
 * acquireGoogleAccessToken — the two providers' token requests differ
 * (DocuSign posts to a fixed environment host with Basic auth; Adobe
 * Sign posts to its own shard-relative /oauth/v2/refresh endpoint with
 * client_id/client_secret as body fields, not a Basic header), so a
 * shared helper would need branching per-vendor logic anyway. Revisit if
 * a third OAuth2-refresh-token signature provider appears.
 */
@Injectable()
export class AdobeSignProvider implements SignatureProvider, OnModuleInit {
  private resolved: Promise<ResolvedAdobeSignConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: SignatureProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(ADOBE_SIGN_PROVIDER_CODE, this);
  }

  async sendForSignature(params: SendForSignatureParams): Promise<SendForSignatureResult> {
    const { token, baseUri } = await this.getAuth();

    const transientDocumentId = await this.uploadTransientDocument(token, baseUri, params);

    const body = {
      fileInfos: [{ transientDocumentId }],
      name: params.subject ?? `Please sign: ${params.documentName}`,
      participantSetsInfo: params.signers.map((signer, index) => ({
        order: index + 1,
        role: 'SIGNER',
        memberInfos: [{ email: signer.email, name: signer.name }],
      })),
      signatureType: 'ESIGN',
      state: 'IN_PROCESS',
      message: params.message,
    };

    const res = await fetch(`${baseUri}/api/rest/v6/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await this.parseJson(res)) as AdobeAgreementCreateResponse & AdobeErrorResponse;
    if (!res.ok) {
      throw new Error(`Adobe Sign create agreement failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    return { providerEnvelopeId: json.id };
  }

  async getStatus(providerEnvelopeId: string): Promise<SignatureStatusResult> {
    const { token, baseUri } = await this.getAuth();

    const res = await fetch(`${baseUri}/api/rest/v6/agreements/${encodeURIComponent(providerEnvelopeId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = (await this.parseJson(res)) as AdobeAgreementStatusResponse & AdobeErrorResponse;
    if (!res.ok) {
      throw new Error(`Adobe Sign get agreement failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    return { status: this.mapAdobeSignStatus(json.status ?? '') };
  }

  async downloadSignedDocument(providerEnvelopeId: string): Promise<Buffer> {
    const { token, baseUri } = await this.getAuth();

    const res = await fetch(
      `${baseUri}/api/rest/v6/agreements/${encodeURIComponent(providerEnvelopeId)}/combinedDocument`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      const json = (await this.parseJson(res)) as AdobeErrorResponse;
      throw new Error(`Adobe Sign download document failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  async voidEnvelope(params: VoidEnvelopeParams): Promise<void> {
    const { token, baseUri } = await this.getAuth();

    const res = await fetch(`${baseUri}/api/rest/v6/agreements/${encodeURIComponent(params.providerEnvelopeId)}/state`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'CANCELLED',
        agreementCancellationInfo: { comment: params.reason ?? '', notifyOthers: false },
      }),
    });

    if (!res.ok) {
      const json = (await this.parseJson(res)) as AdobeErrorResponse;
      throw new Error(`Adobe Sign void agreement failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }
  }

  /**
   * Step 1 of Adobe Sign's two-step send flow — see this class's own
   * doc comment for why this exists at all (DocuSignProvider needs no
   * equivalent). multipart/form-data with the raw bytes as a Blob-like
   * part named "File", matching Adobe's own transientDocuments contract;
   * File-Name and Mime-Type are separate form fields, not headers on the
   * part itself.
   */
  private async uploadTransientDocument(token: string, baseUri: string, params: SendForSignatureParams): Promise<string> {
    const form = new FormData();
    form.append('File-Name', params.documentName);
    form.append('Mime-Type', params.documentContentType);
    form.append('File', new Blob([params.documentBuffer], { type: params.documentContentType }), params.documentName);

    const res = await fetch(`${baseUri}/api/rest/v6/transientDocuments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const json = (await this.parseJson(res)) as AdobeTransientDocumentResponse & AdobeErrorResponse;
    if (!res.ok) {
      throw new Error(`Adobe Sign upload document failed: HTTP ${res.status} — ${json.message ?? 'unknown error'}`);
    }
    return json.transientDocumentId;
  }

  /**
   * Adobe Sign's own agreement-status vocabulary (uppercase-with-underscores:
   * OUT_FOR_SIGNATURE, WAITING_FOR_MY_SIGNATURE, WAITING_FOR_OTHERS,
   * SIGNED, APPROVED, CANCELLED, EXPIRED, ARCHIVED, and several others)
   * mapped down to SignatureStatus, the same deliberate-narrowing
   * DocuSignProvider.mapDocuSignStatus uses for DocuSign's own wider
   * vocabulary. Adobe Sign has no distinct "delivered" event the way
   * DocuSign's email-open tracking does, so every in-flight
   * (not-yet-fully-signed) state maps to SENT rather than DELIVERED —
   * there is nothing in Adobe's own status field this provider could use
   * to tell the two apart. EXPIRED has no exact match in SignatureStatus
   * either; mapped to DECLINED (not VOIDED) because an expired agreement
   * was never actively cancelled by anyone the way a voided one was — it
   * simply timed out unsigned, closer in spirit to a signer declining
   * than to someone withdrawing it.
   */
  private mapAdobeSignStatus(adobeSignStatus: string): SignatureStatus {
    switch (adobeSignStatus.toUpperCase()) {
      case 'SIGNED':
      case 'APPROVED':
      case 'COMPLETED':
        return 'COMPLETED';
      case 'CANCELLED':
      case 'ABORTED':
        return 'VOIDED';
      case 'EXPIRED':
      case 'REJECTED':
        return 'DECLINED';
      case 'OUT_FOR_SIGNATURE':
      case 'WAITING_FOR_MY_SIGNATURE':
      case 'WAITING_FOR_OTHERS':
      case 'AUTHORING':
      default:
        return 'SENT';
    }
  }

  private async getAuth(): Promise<{ token: string; baseUri: string }> {
    const config = await this.getConfig();
    const token = await this.acquireAccessToken(config.baseUri, config.clientId, config.clientSecret, config.refreshToken);
    return { token, baseUri: config.baseUri };
  }

  /** Not cached — same per-call-refresh posture DocuSignProvider.acquireAccessToken takes; see that method's own doc comment for the identical tradeoff. */
  private async acquireAccessToken(baseUri: string, clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const res = await fetch(`${baseUri}/oauth/v2/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Adobe Sign token acquisition failed: HTTP ${res.status}${body ? ` — ${body}` : ''}`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new Error('Adobe Sign token response had no access_token');
    }
    return json.access_token;
  }

  private async getConfig(): Promise<ResolvedAdobeSignConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedAdobeSignConfig> {
    const providerId = process.env.SIGNATURE_ADOBE_SIGN_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'SIGNATURE_ADOBE_SIGN_PROVIDER_ID is not set. Create an IntegrationProvider (category DIGITAL_SIGNATURE, providerCode "ADOBE_SIGN") with config {baseUri, clientId} and credentials {clientSecret, refreshToken}, then set SIGNATURE_ADOBE_SIGN_PROVIDER_ID to its id.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== 'ADOBE_SIGN') {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "ADOBE_SIGN"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (ADOBE_SIGN) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const baseUri = config.baseUri as string | undefined;
    const clientId = config.clientId as string | undefined;
    const missingConfig = [!baseUri && 'baseUri', !clientId && 'clientId'].filter(Boolean);
    if (missingConfig.length) {
      throw new Error(`Integration provider ${providerId} is missing config.${missingConfig.join(', config.')}`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    const refreshToken = credentials?.refreshToken as string | undefined;
    const missingCredentials = [!clientSecret && 'clientSecret', !refreshToken && 'refreshToken'].filter(Boolean);
    if (missingCredentials.length) {
      throw new Error(`Integration provider ${providerId} is missing credentials.${missingCredentials.join(', credentials.')}`);
    }

    return { baseUri: baseUri!, clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
