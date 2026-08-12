import { generateKeyPairSync } from 'crypto';
import { GoogleWorkspaceAdminHealthCheckDriver } from '../providers/google-workspace-admin-health-check.driver';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const fetchMock = jest.fn();

describe('GoogleWorkspaceAdminHealthCheckDriver', () => {
  let driver: GoogleWorkspaceAdminHealthCheckDriver;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    driver = new GoogleWorkspaceAdminHealthCheckDriver();
  });

  const validConfig = { impersonatedAdminEmail: 'admin@example.com' };
  const validCredentials = { clientEmail: 'svc@my-project.iam.gserviceaccount.com', privateKey };

  it('reports failure when config.impersonatedAdminEmail is missing', async () => {
    const result = await driver.healthCheck({ config: {}, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.impersonatedAdminEmail');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure listing every missing credentials key at once', async () => {
    const result = await driver.healthCheck({ config: validConfig, credentials: {} });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('credentials.clientEmail');
    expect(result.message).toContain('credentials.privateKey');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when credentials.privateKey is missing', async () => {
    const result = await driver.healthCheck({ config: validConfig, credentials: { clientEmail: 'svc@x.iam.gserviceaccount.com' } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('credentials.privateKey');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when the token endpoint rejects the assertion', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_grant' });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Token acquisition failed');
    expect(result.message).toContain('401');
  });

  it('reports failure when the token is acquired but the impersonated-admin lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('403');
  });

  it('reports ok when both the token exchange and the admin lookup succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ primaryEmail: 'admin@example.com' }) });

    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('admin@example.com');

    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://oauth2.googleapis.com/token');
    const tokenBody = new URLSearchParams(tokenCall[1].body as string);
    expect(tokenBody.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');

    const lookupCall = fetchMock.mock.calls[1];
    expect(lookupCall[0]).toBe('https://admin.googleapis.com/admin/directory/v1/users/admin%40example.com');
    expect(lookupCall[1].headers.Authorization).toBe('Bearer tok-1');
  });

  it('URL-encodes the impersonated admin email', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ primaryEmail: 'a+b@example.com' }) });

    await driver.healthCheck({ config: { impersonatedAdminEmail: 'a+b@example.com' }, credentials: validCredentials });
    expect(fetchMock.mock.calls[1][0]).toBe('https://admin.googleapis.com/admin/directory/v1/users/a%2Bb%40example.com');
  });
});
