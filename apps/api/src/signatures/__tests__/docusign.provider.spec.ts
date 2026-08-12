import { DocuSignProvider, DOCUSIGN_PROVIDER_CODE } from '../providers/docusign.provider';
import { SignatureProviderRegistry } from '../signature-provider.registry';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'docusign-token-xyz', expires_in: 3600 }) };
}

describe('DocuSignProvider', () => {
  let provider: DocuSignProvider;
  let registry: SignatureProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'DOCUSIGN',
    isActive: true,
    config: { baseUri: 'https://demo.docusign.net', accountId: 'account-1', clientId: 'client-1' },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, SIGNATURE_DOCUSIGN_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh', refreshToken: 'refresh-1' }),
    };
    registry = new SignatureProviderRegistry();
    provider = new DocuSignProvider(integrations as any, registry);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into SignatureProviderRegistry under "DOCUSIGN"', () => {
      expect(registry.isRegistered(DOCUSIGN_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(DOCUSIGN_PROVIDER_CODE)).toBe(true);
      expect(registry.get(DOCUSIGN_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('config resolution', () => {
    it('throws when SIGNATURE_DOCUSIGN_PROVIDER_ID is not set', async () => {
      delete process.env.SIGNATURE_DOCUSIGN_PROVIDER_ID;
      await expect(provider.getStatus('env-1')).rejects.toThrow('SIGNATURE_DOCUSIGN_PROVIDER_ID is not set');
    });

    it('throws when providerCode is not DOCUSIGN', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'ADOBE_SIGN' });
      await expect(provider.getStatus('env-1')).rejects.toThrow('expected "DOCUSIGN"');
    });

    it('throws when the provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.getStatus('env-1')).rejects.toThrow('is not active');
    });

    it('throws listing missing config keys', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: {} });
      await expect(provider.getStatus('env-1')).rejects.toThrow(/config\.baseUri.*config\.accountId.*config\.clientId/s);
    });

    it('throws listing missing credential keys', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getStatus('env-1')).rejects.toThrow(/credentials\.clientSecret.*credentials\.refreshToken/s);
    });

    it('throws on an invalid config.environment value', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { ...validProviderRow.config, environment: 'sandbox' } });
      await expect(provider.getStatus('env-1')).rejects.toThrow(/invalid config\.environment "sandbox".*demo.*production/s);
    });

    it('acquires a token against the demo OAuth server by default when config.environment is unset', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-1', status: 'sent' }) });
      await provider.getStatus('env-1');
      expect(fetchMock.mock.calls[0][0]).toBe('https://account-d.docusign.com/oauth/token');
    });

    it('acquires a token against the production OAuth server when config.environment is "production"', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { ...validProviderRow.config, environment: 'production' } });
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-1', status: 'sent' }) });

      await provider.getStatus('env-1');

      expect(fetchMock.mock.calls[0][0]).toBe('https://account.docusign.com/oauth/token');
    });
  });

  describe('sendForSignature', () => {
    const params = {
      documentName: 'offer-letter.pdf',
      documentBuffer: Buffer.from('pdf-bytes'),
      documentContentType: 'application/pdf',
      signers: [{ email: 'jane@example.com', name: 'Jane Doe' }],
      subject: 'Please sign your offer letter',
      message: 'Congratulations!',
    };

    it('acquires a token then creates the envelope, mapping the response', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-abc', status: 'sent' }) });

      const result = await provider.sendForSignature(params);

      expect(result).toEqual({ providerEnvelopeId: 'env-abc' });

      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://demo.docusign.net/restapi/v2.1/accounts/account-1/envelopes');
      const body = JSON.parse(createCall[1].body);
      expect(body.emailSubject).toBe('Please sign your offer letter');
      expect(body.documents[0]).toMatchObject({ name: 'offer-letter.pdf', fileExtension: 'pdf' });
      expect(body.documents[0].documentBase64).toBe(Buffer.from('pdf-bytes').toString('base64'));
      expect(body.recipients.signers).toEqual([{ email: 'jane@example.com', name: 'Jane Doe', recipientId: '1', routingOrder: '1' }]);
      expect(body.status).toBe('sent');
    });

    it('defaults emailSubject when no subject is given', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-1' }) });

      await provider.sendForSignature({ ...params, subject: undefined });

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.emailSubject).toBe('Please sign: offer-letter.pdf');
    });

    it('uses the Authorization: Basic header with client credentials for the token request', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-1' }) });

      await provider.sendForSignature(params);

      const tokenCall = fetchMock.mock.calls[0];
      expect(tokenCall[0]).toBe('https://account-d.docusign.com/oauth/token');
      expect(tokenCall[1].headers.Authorization).toBe(`Basic ${Buffer.from('client-1:shh').toString('base64')}`);
    });

    it('throws a clear error when DocuSign rejects the create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'Invalid recipient email' }) });

      await expect(provider.sendForSignature(params)).rejects.toThrow('Invalid recipient email');
    });
  });

  describe('getStatus', () => {
    it.each([
      ['sent', 'SENT'],
      ['created', 'SENT'],
      ['delivered', 'DELIVERED'],
      ['completed', 'COMPLETED'],
      ['declined', 'DECLINED'],
      ['voided', 'VOIDED'],
      ['some-future-status', 'SENT'],
    ])('maps DocuSign status "%s" to SignatureStatus "%s"', async (docuSignStatus, expected) => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-1', status: docuSignStatus }) });

      const result = await provider.getStatus('env-1');
      expect(result.status).toBe(expected);
    });

    it('is case-insensitive when mapping status', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ envelopeId: 'env-1', status: 'COMPLETED' }) });
      const result = await provider.getStatus('env-1');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('downloadSignedDocument', () => {
    it('returns the document bytes as a Buffer', async () => {
      const pdfBytes = Buffer.from('%PDF-1.4 fake content');
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength),
      });

      const result = await provider.downloadSignedDocument('env-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('%PDF-1.4 fake content');
      expect(fetchMock.mock.calls[1][0]).toBe('https://demo.docusign.net/restapi/v2.1/accounts/account-1/envelopes/env-1/documents/combined');
    });

    it('throws a clear error when the download fails', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Envelope not found' }) });
      await expect(provider.downloadSignedDocument('missing')).rejects.toThrow('Envelope not found');
    });
  });

  describe('voidEnvelope', () => {
    it('PUTs status voided with the reason', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.voidEnvelope({ providerEnvelopeId: 'env-1', reason: 'Sent to wrong recipient' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://demo.docusign.net/restapi/v2.1/accounts/account-1/envelopes/env-1');
      expect(call[1].method).toBe('PUT');
      expect(JSON.parse(call[1].body)).toEqual({ status: 'voided', voidedReason: 'Sent to wrong recipient' });
    });

    it('defaults voidedReason to an empty string when omitted', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await provider.voidEnvelope({ providerEnvelopeId: 'env-1' });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).voidedReason).toBe('');
    });

    it('throws a clear error when the void request fails', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Envelope already completed' }) });
      await expect(provider.voidEnvelope({ providerEnvelopeId: 'env-1' })).rejects.toThrow('Envelope already completed');
    });
  });
});
