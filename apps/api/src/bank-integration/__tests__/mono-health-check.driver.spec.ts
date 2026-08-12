import { MonoHealthCheckDriver } from '../providers/mono-health-check.driver';

describe('MonoHealthCheckDriver (Release IF.1, Checkpoint B)', () => {
  let driver: MonoHealthCheckDriver;
  const originalFetch = global.fetch;

  beforeEach(() => {
    driver = new MonoHealthCheckDriver();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fails when credentials.secretKey is missing', async () => {
    const result = await driver.healthCheck({ config: null, credentials: null });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/secretKey/);
  });

  it('succeeds when Mono accepts the secret key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'inst-1' }, { id: 'inst-2' }] }),
    }) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'live_sk_abc123' } });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('2 institutions');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/institutions'),
      expect.objectContaining({ headers: { 'mono-sec-key': 'live_sk_abc123' } }),
    );
  });

  it('fails when Mono rejects the key with a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid secret key',
    }) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'bad-key' } });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
  });

  it('fails gracefully when the request itself throws (network error)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'live_sk_abc123' } });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('network down');
  });
});
