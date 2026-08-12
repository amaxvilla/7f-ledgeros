import { AdobeSignProvider, ADOBE_SIGN_PROVIDER_CODE } from '../providers/adobe-sign.provider';
import { SignatureProviderRegistry } from '../signature-provider.registry';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'adobe-token-xyz', expires_in: 3600 }) };
}

function transientDocResponse(id = 'transient-1') {
  return { ok: true, json: async () => ({ transientDocumentId: id }) };
}

describe('AdobeSignProvider', () => {
  let provider: AdobeSignProvider;
  let registry: SignatureProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-2',
    providerCode: 'ADOBE_SIGN',
    isActive: true,
    config: { baseUri: 'https://api.na1.adobesign.com', clientId: 'client-2' },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, SIGNATURE_ADOBE_SIGN_PROVIDER_ID: 'provider-2' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh', refreshToken: 'refresh-2' }),
    };
    registry = new SignatureProviderRegistry();
    provider = new AdobeSignProvider(integrations as any, registry);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into SignatureProviderRegistry under "ADOBE_SIGN"', () => {
      expect(registry.isRegistered(ADOBE_SIGN_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(ADOBE_SIGN_PROVIDER_CODE)).toBe(true);
      expect(registry.get(ADOBE_SIGN_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('config resolution', () => {
    it('throws when SIGNATURE_ADOBE_SIGN_PROVIDER_ID is not set', async () => {
      delete process.env.SIGNATURE_ADOBE_SIGN_PROVIDER_ID;
      await expect(provider.getStatus('agr-1')).rejects.toThrow('SIGNATURE_ADOBE_SIGN_PROVIDER_ID is not set');
    });

    it('throws when providerCode is not ADOBE_SIGN', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'DOCUSIGN' });
      await expect(provider.getStatus('agr-1')).rejects.toThrow('expected "ADOBE_SIGN"');
    });

    it('throws when the provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.getStatus('agr-1')).rejects.toThrow('is not active');
    });

    it('throws listing missing config keys', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: {} });
      await expect(provider.getStatus('agr-1')).rejects.toThrow(/config\.baseUri.*config\.clientId/s);
    });

    it('throws listing missing credential keys', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getStatus('agr-1')).rejects.toThrow(/credentials\.clientSecret.*credentials\.refreshToken/s);
    });

    it('acquires a token against the shard-relative OAuth endpoint', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OUT_FOR_SIGNATURE' }) });
      await provider.getStatus('agr-1');
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.na1.adobesign.com/oauth/v2/refresh');
    });

    it('posts client_id/client_secret as body fields, not a Basic header', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OUT_FOR_SIGNATURE' }) });
      await provider.getStatus('agr-1');
      const tokenCall = fetchMock.mock.calls[0];
      expect(tokenCall[1].headers.Authorization).toBeUndefined();
      const params = new URLSearchParams(tokenCall[1].body);
      expect(params.get('client_id')).toBe('client-2');
      expect(params.get('client_secret')).toBe('shh');
      expect(params.get('refresh_token')).toBe('refresh-2');
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

    it('uploads a transient document, then creates the agreement referencing it', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(transientDocResponse('transient-abc'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'agr-abc' }) });

      const result = await provider.sendForSignature(params);

      expect(result).toEqual({ providerEnvelopeId: 'agr-abc' });

      const uploadCall = fetchMock.mock.calls[1];
      expect(uploadCall[0]).toBe('https://api.na1.adobesign.com/api/rest/v6/transientDocuments');
      expect(uploadCall[1].body).toBeInstanceOf(FormData);

      const agreementCall = fetchMock.mock.calls[2];
      expect(agreementCall[0]).toBe('https://api.na1.adobesign.com/api/rest/v6/agreements');
      const body = JSON.parse(agreementCall[1].body);
      expect(body.fileInfos).toEqual([{ transientDocumentId: 'transient-abc' }]);
      expect(body.name).toBe('Please sign your offer letter');
      expect(body.participantSetsInfo).toEqual([
        { order: 1, role: 'SIGNER', memberInfos: [{ email: 'jane@example.com', name: 'Jane Doe' }] },
      ]);
      expect(body.state).toBe('IN_PROCESS');
    });

    it('defaults the agreement name when no subject is given', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(transientDocResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'agr-1' }) });

      await provider.sendForSignature({ ...params, subject: undefined });

      const body = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(body.name).toBe('Please sign: offer-letter.pdf');
    });

    it('orders multiple signers by array position', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(transientDocResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'agr-1' }) });

      await provider.sendForSignature({
        ...params,
        signers: [
          { email: 'first@example.com', name: 'First Signer' },
          { email: 'second@example.com', name: 'Second Signer' },
        ],
      });

      const body = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(body.participantSetsInfo).toEqual([
        { order: 1, role: 'SIGNER', memberInfos: [{ email: 'first@example.com', name: 'First Signer' }] },
        { order: 2, role: 'SIGNER', memberInfos: [{ email: 'second@example.com', name: 'Second Signer' }] },
      ]);
    });

    it('throws a clear error when the transient document upload fails', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'Unsupported file type' }) });

      await expect(provider.sendForSignature(params)).rejects.toThrow('Unsupported file type');
    });

    it('throws a clear error when Adobe Sign rejects the agreement-create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(transientDocResponse())
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'Invalid participant email' }) });

      await expect(provider.sendForSignature(params)).rejects.toThrow('Invalid participant email');
    });
  });

  describe('getStatus', () => {
    it.each([
      ['OUT_FOR_SIGNATURE', 'SENT'],
      ['WAITING_FOR_MY_SIGNATURE', 'SENT'],
      ['WAITING_FOR_OTHERS', 'SENT'],
      ['AUTHORING', 'SENT'],
      ['SIGNED', 'COMPLETED'],
      ['APPROVED', 'COMPLETED'],
      ['CANCELLED', 'VOIDED'],
      ['ABORTED', 'VOIDED'],
      ['EXPIRED', 'DECLINED'],
      ['REJECTED', 'DECLINED'],
      ['SOME_FUTURE_STATUS', 'SENT'],
    ])('maps Adobe Sign status "%s" to SignatureStatus "%s"', async (adobeStatus, expected) => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ status: adobeStatus }) });
      const result = await provider.getStatus('agr-1');
      expect(result.status).toBe(expected);
    });

    it('is case-insensitive when mapping status', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'signed' }) });
      const result = await provider.getStatus('agr-1');
      expect(result.status).toBe('COMPLETED');
    });

    it('throws a clear error when the get-agreement request fails', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Agreement not found' }) });
      await expect(provider.getStatus('missing')).rejects.toThrow('Agreement not found');
    });
  });

  describe('downloadSignedDocument', () => {
    it('returns the document bytes as a Buffer', async () => {
      const pdfBytes = Buffer.from('%PDF-1.4 fake content');
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength),
      });

      const result = await provider.downloadSignedDocument('agr-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('%PDF-1.4 fake content');
      expect(fetchMock.mock.calls[1][0]).toBe('https://api.na1.adobesign.com/api/rest/v6/agreements/agr-1/combinedDocument');
    });

    it('throws a clear error when the download fails', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Agreement not found' }) });
      await expect(provider.downloadSignedDocument('missing')).rejects.toThrow('Agreement not found');
    });
  });

  describe('voidEnvelope', () => {
    it('PUTs state CANCELLED with the reason as a comment', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.voidEnvelope({ providerEnvelopeId: 'agr-1', reason: 'Sent to wrong recipient' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://api.na1.adobesign.com/api/rest/v6/agreements/agr-1/state');
      expect(call[1].method).toBe('PUT');
      expect(JSON.parse(call[1].body)).toEqual({
        state: 'CANCELLED',
        agreementCancellationInfo: { comment: 'Sent to wrong recipient', notifyOthers: false },
      });
    });

    it('defaults the comment to an empty string when reason is omitted', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await provider.voidEnvelope({ providerEnvelopeId: 'agr-1' });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).agreementCancellationInfo.comment).toBe('');
    });

    it('throws a clear error when the cancel request fails', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Agreement already signed' }) });
      await expect(provider.voidEnvelope({ providerEnvelopeId: 'agr-1' })).rejects.toThrow('Agreement already signed');
    });
  });
});
