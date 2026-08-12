import { GoogleDriveStorageProvider } from '../providers/google-drive-storage.provider';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'google-token-xyz', expires_in: 3600 }) };
}

function emptySearchResponse() {
  return { ok: true, json: async () => ({ files: [] }) };
}

function foundSearchResponse(fileId: string) {
  return { ok: true, json: async () => ({ files: [{ id: fileId }] }) };
}

describe('GoogleDriveStorageProvider', () => {
  let provider: GoogleDriveStorageProvider;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'GOOGLE_DRIVE',
    isActive: true,
    config: { folderId: 'folder-1', clientId: 'client-1' },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, STORAGE_DRIVE_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh', refreshToken: 'refresh-1' }),
    };
    provider = new GoogleDriveStorageProvider(integrations as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('config resolution', () => {
    it('throws when STORAGE_DRIVE_PROVIDER_ID is not set', async () => {
      delete process.env.STORAGE_DRIVE_PROVIDER_ID;
      await expect(provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' })).rejects.toThrow(
        'STORAGE_DRIVE_PROVIDER_ID is not set',
      );
    });

    it('throws when providerCode is not GOOGLE_DRIVE', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'AWS_S3' });
      await expect(provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' })).rejects.toThrow(
        'expected "GOOGLE_DRIVE"',
      );
    });

    it('throws when the provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' })).rejects.toThrow('is not active');
    });

    it('throws listing missing config keys', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: {} });
      await expect(provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' })).rejects.toThrow(
        /config\.folderId.*config\.clientId/s,
      );
    });

    it('throws listing missing credential keys', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' })).rejects.toThrow(
        /credentials\.clientSecret.*credentials\.refreshToken/s,
      );
    });
  });

  describe('upload', () => {
    it('creates a new file (multipart) when no existing file matches the key, then shares it and returns the link', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse()) // token
        .mockResolvedValueOnce(emptySearchResponse()) // findFileId — no existing match
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file-1' }) }) // createFile
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // ensureSharedReadable
        .mockResolvedValueOnce({ ok: true, json: async () => ({ webContentLink: 'https://drive.google.com/uc?id=file-1' }) }); // getWebContentLink

      const result = await provider.upload({ key: 'branding/logo.png', buffer: Buffer.from('img-bytes'), contentType: 'image/png' });

      expect(result).toEqual({ key: 'branding/logo.png', url: 'https://drive.google.com/uc?id=file-1' });
      expect(fetchMock).toHaveBeenCalledTimes(5); // one token fetch total — no redundant re-auth

      const createCall = fetchMock.mock.calls[2];
      expect(createCall[0]).toContain('/upload/drive/v3/files?uploadType=multipart');
      expect(createCall[1].headers['Content-Type']).toMatch(/^multipart\/related; boundary=/);
      const bodyText = createCall[1].body.toString('utf-8');
      expect(bodyText).toContain('"name":"branding/logo.png"');
      expect(bodyText).toContain('"parents":["folder-1"]');
      expect(bodyText).toContain('img-bytes');

      const permissionCall = fetchMock.mock.calls[3];
      expect(permissionCall[0]).toBe('https://www.googleapis.com/drive/v3/files/file-1/permissions');
      expect(JSON.parse(permissionCall[1].body)).toEqual({ role: 'reader', type: 'anyone' });
    });

    it('updates in place (media PATCH) when a file with the same key already exists', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(foundSearchResponse('existing-file-1'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // updateFileContent PATCH
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // ensureSharedReadable
        .mockResolvedValueOnce({ ok: true, json: async () => ({ webContentLink: 'https://drive.google.com/uc?id=existing-file-1' }) });

      const result = await provider.upload({ key: 'branding/logo.png', buffer: Buffer.from('new-bytes'), contentType: 'image/png' });

      expect(result.url).toBe('https://drive.google.com/uc?id=existing-file-1');
      expect(fetchMock).toHaveBeenCalledTimes(5);
      const patchCall = fetchMock.mock.calls[2];
      expect(patchCall[0]).toBe('https://www.googleapis.com/upload/drive/v3/files/existing-file-1?uploadType=media');
      expect(patchCall[1].method).toBe('PATCH');
    });

    it('throws a clear error when Drive rejects the create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(emptySearchResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient permissions' } }) });

      await expect(provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' })).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('getUrl', () => {
    it('throws when no file matches the key', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(emptySearchResponse());
      await expect(provider.getUrl('missing-key')).rejects.toThrow('No Drive file found for key "missing-key"');
    });
  });

  describe('delete', () => {
    it('is a no-op when no file matches the key (idempotent)', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(emptySearchResponse());
      await provider.delete('missing-key');
      expect(fetchMock).toHaveBeenCalledTimes(2); // token + search only, no DELETE call
    });

    it('deletes the matching file', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(foundSearchResponse('file-1'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.delete('branding/logo.png');

      const deleteCall = fetchMock.mock.calls[2];
      expect(deleteCall[0]).toBe('https://www.googleapis.com/drive/v3/files/file-1');
      expect(deleteCall[1].method).toBe('DELETE');
    });

    it('treats a 404 on delete as success (already gone)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(foundSearchResponse('file-1'))
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

      await expect(provider.delete('branding/logo.png')).resolves.toBeUndefined();
    });
  });
});
