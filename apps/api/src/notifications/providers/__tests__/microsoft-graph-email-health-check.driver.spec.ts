import { MicrosoftGraphEmailHealthCheckDriver } from '../microsoft-graph-email-health-check.driver';

const fetchMock = jest.fn();

describe('MicrosoftGraphEmailHealthCheckDriver', () => {
  let driver: MicrosoftGraphEmailHealthCheckDriver;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    driver = new MicrosoftGraphEmailHealthCheckDriver();
  });

  const validConfig = { tenantId: 'tenant-1', clientId: 'client-1', senderUserId: 'sender@example.com' };
  const validCredentials = { clientSecret: 'shh' };

  it('reports failure listing every missing config key at once', async () => {
    const result = await driver.healthCheck({ config: { tenantId: 'tenant-1' }, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.clientId');
    expect(result.message).toContain('config.senderUserId');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when credentials.clientSecret is missing', async () => {
    const result = await driver.healthCheck({ config: validConfig, credentials: null });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('clientSecret');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure when the token endpoint rejects the credentials', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_client' });
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Token acquisition failed');
    expect(result.message).toContain('401');
  });

  it('reports failure when the token is acquired but the sender mailbox lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) }) // token endpoint
      .mockResolvedValueOnce({ ok: false, status: 404 }); // /users/{senderUserId}
    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('404');
  });

  it('reports ok when both the token and the sender mailbox lookup succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'sender@example.com' }) });

    const result = await driver.healthCheck({ config: validConfig, credentials: validCredentials });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('sender@example.com');
    // First call is the token endpoint, with the client credentials in the body.
    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toContain('login.microsoftonline.com/tenant-1');
    expect(tokenCall[1].body.toString()).toContain('client_secret=shh');
    // Second call is the Graph mailbox lookup, bearing the acquired token.
    const graphCall = fetchMock.mock.calls[1];
    expect(graphCall[0]).toContain('graph.microsoft.com/v1.0/users/sender%40example.com');
    expect(graphCall[1].headers.Authorization).toBe('Bearer tok-1');
  });
});
