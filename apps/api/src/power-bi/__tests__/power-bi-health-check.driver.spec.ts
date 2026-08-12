import { PowerBiHealthCheckDriver } from '../providers/power-bi-health-check.driver';

const fetchMock = jest.fn();

describe('PowerBiHealthCheckDriver', () => {
  let driver: PowerBiHealthCheckDriver;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    driver = new PowerBiHealthCheckDriver();
  });

  const validConfig = { tenantId: 'tenant-1', clientId: 'client-1', workspaceId: 'workspace-1' };
  const validCredentials = { clientSecret: 'super-secret' };

  it('reports every missing config key at once', async () => {
    const result = await driver.healthCheck({ config: {}, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.tenantId');
    expect(result.message).toContain('config.clientId');
    expect(result.message).toContain('config.workspaceId');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a single missing config key', async () => {
    const result = await driver.healthCheck({ config: { tenantId: 't', clientId: 'c' }, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Missing config.workspaceId');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when credentials.clientSecret is missing', async () => {
    const result = await driver.healthCheck({ config: validConfig, credentials: {} });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Missing credentials.clientSecret');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when the token endpoint rejects the client credentials', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_client' });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Token acquisition failed');
    expect(result.message).toContain('401');
  });

  it('reports failure when the token is acquired but the workspace lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('403');
  });

  it('reports ok when both the token exchange and the workspace lookup succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Finance Reporting' }) });

    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Finance Reporting');

    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    const tokenBody = new URLSearchParams(tokenCall[1].body as string);
    expect(tokenBody.get('scope')).toBe('https://analysis.windows.net/powerbi/api/.default');
    expect(tokenBody.get('grant_type')).toBe('client_credentials');

    const lookupCall = fetchMock.mock.calls[1];
    expect(lookupCall[0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/workspace-1');
    expect(lookupCall[1].headers.Authorization).toBe('Bearer tok-1');
  });

  it('URL-encodes the workspace id', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'W' }) });

    await driver.healthCheck({ config: { ...validConfig, workspaceId: 'ws with space' }, credentials: validCredentials });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/ws%20with%20space');
  });
});
