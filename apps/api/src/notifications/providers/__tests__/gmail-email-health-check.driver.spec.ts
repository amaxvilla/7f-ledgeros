import { GmailEmailHealthCheckDriver } from '../gmail-email-health-check.driver';

const fetchMock = jest.fn();

describe('GmailEmailHealthCheckDriver', () => {
  let driver: GmailEmailHealthCheckDriver;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    driver = new GmailEmailHealthCheckDriver();
  });

  const validConfig = { clientId: 'client-1' };
  const validCredentials = { clientSecret: 'shh', refreshToken: 'refresh-1' };

  it('reports failure when config.clientId is missing', async () => {
    const result = await driver.healthCheck({ config: {}, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.clientId');
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

  it('reports failure when the token is acquired but the profile lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('403');
  });

  it('reports ok when both the token and profile lookup succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: 'mailbox@example.com' }) });

    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('mailbox@example.com');
    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://oauth2.googleapis.com/token');
    expect(tokenCall[1].body.toString()).toContain('refresh_token=refresh-1');
    const profileCall = fetchMock.mock.calls[1];
    expect(profileCall[0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/profile');
    expect(profileCall[1].headers.Authorization).toBe('Bearer tok-1');
  });
});
