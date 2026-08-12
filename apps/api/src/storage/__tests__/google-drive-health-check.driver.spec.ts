import { GoogleDriveHealthCheckDriver } from '../providers/google-drive-health-check.driver';

const fetchMock = jest.fn();

describe('GoogleDriveHealthCheckDriver', () => {
  let driver: GoogleDriveHealthCheckDriver;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    driver = new GoogleDriveHealthCheckDriver();
  });

  const validConfig = { clientId: 'client-1', folderId: 'folder-1' };
  const validCredentials = { clientSecret: 'shh', refreshToken: 'refresh-1' };

  it('reports failure listing every missing config key at once', async () => {
    const result = await driver.healthCheck({ config: {}, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.clientId');
    expect(result.message).toContain('config.folderId');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when credentials.clientSecret is missing', async () => {
    const result = await driver.healthCheck({ config: validConfig, credentials: { refreshToken: 'r1' } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('clientSecret');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when credentials.refreshToken is missing', async () => {
    const result = await driver.healthCheck({ config: validConfig, credentials: { clientSecret: 'shh' } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('refreshToken');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when the token endpoint rejects the credentials', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'invalid_grant' });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Token acquisition failed');
    expect(result.message).toContain('400');
  });

  it('reports failure when the token is acquired but the folder lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('404');
  });

  it('reports ok when both the token and folder lookup succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'folder-1', name: 'Branding Assets' }) });

    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Branding Assets');
    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://oauth2.googleapis.com/token');
    expect(tokenCall[1].body.toString()).toContain('refresh_token=refresh-1');
    const folderCall = fetchMock.mock.calls[1];
    expect(folderCall[0]).toBe('https://www.googleapis.com/drive/v3/files/folder-1?fields=id,name');
    expect(folderCall[1].headers.Authorization).toBe('Bearer tok-1');
  });

  it('URL-encodes the folder id', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'a/b', name: 'x' }) });

    await driver.healthCheck({ config: { clientId: 'c1', folderId: 'a/b' }, credentials: validCredentials });
    expect(fetchMock.mock.calls[1][0]).toBe('https://www.googleapis.com/drive/v3/files/a%2Fb?fields=id,name');
  });
});
