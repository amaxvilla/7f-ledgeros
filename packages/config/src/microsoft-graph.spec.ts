import { acquireMicrosoftGraphToken, acquirePowerBiToken } from './microsoft-graph';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});

describe('acquireMicrosoftGraphToken (regression — unchanged since Power BI Checkpoint B extracted acquireAzureAdToken)', () => {
  it('POSTs a client-credentials grant with the Graph scope and returns the token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'graph-tok' }) });

    const token = await acquireMicrosoftGraphToken('tenant-1', 'client-1', 'secret-1');

    expect(token).toBe('graph-tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('client_id')).toBe('client-1');
    expect(body.get('client_secret')).toBe('secret-1');
    expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(body.get('grant_type')).toBe('client_credentials');
  });

  it('URL-encodes the tenant id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 't' }) });
    await acquireMicrosoftGraphToken('tenant with space', 'c', 's');
    expect(fetchMock.mock.calls[0][0]).toBe('https://login.microsoftonline.com/tenant%20with%20space/oauth2/v2.0/token');
  });

  it('throws with status and body on HTTP failure', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_client' });
    await expect(acquireMicrosoftGraphToken('t', 'c', 's')).rejects.toThrow(/401.*invalid_client/);
  });

  it('throws when the response has no access_token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(acquireMicrosoftGraphToken('t', 'c', 's')).rejects.toThrow('Token response had no access_token');
  });
});

describe('acquirePowerBiToken', () => {
  it('POSTs a client-credentials grant with the Power BI scope and returns the token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'pbi-tok' }) });

    const token = await acquirePowerBiToken('tenant-1', 'client-1', 'secret-1');

    expect(token).toBe('pbi-tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('client_id')).toBe('client-1');
    expect(body.get('client_secret')).toBe('secret-1');
    expect(body.get('scope')).toBe('https://analysis.windows.net/powerbi/api/.default');
    expect(body.get('grant_type')).toBe('client_credentials');
  });

  it('uses a different scope than acquireMicrosoftGraphToken against the same tenant/client/secret', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok' }) });

    await acquireMicrosoftGraphToken('tenant-1', 'client-1', 'secret-1');
    await acquirePowerBiToken('tenant-1', 'client-1', 'secret-1');

    const graphScope = new URLSearchParams(fetchMock.mock.calls[0][1].body as string).get('scope');
    const powerBiScope = new URLSearchParams(fetchMock.mock.calls[1][1].body as string).get('scope');
    expect(graphScope).not.toBe(powerBiScope);
    expect(powerBiScope).toBe('https://analysis.windows.net/powerbi/api/.default');
  });

  it('throws with status and body on HTTP failure', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'unauthorized_client' });
    await expect(acquirePowerBiToken('t', 'c', 's')).rejects.toThrow(/403.*unauthorized_client/);
  });

  it('throws when the response has no access_token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(acquirePowerBiToken('t', 'c', 's')).rejects.toThrow('Token response had no access_token');
  });
});
