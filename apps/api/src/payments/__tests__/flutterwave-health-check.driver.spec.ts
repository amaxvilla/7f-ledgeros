import { FlutterwaveHealthCheckDriver } from '../providers/flutterwave-health-check.driver';

describe('FlutterwaveHealthCheckDriver (Release IE.3, Checkpoint A)', () => {
  let driver: FlutterwaveHealthCheckDriver;
  const originalFetch = global.fetch;

  beforeEach(() => {
    driver = new FlutterwaveHealthCheckDriver();
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

  it('succeeds when Flutterwave accepts the secret key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Banks fetched successfully' }),
    }) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'FLWSECK_TEST-abc123' } });

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Banks fetched successfully');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/banks/NG'),
      expect.objectContaining({ headers: { Authorization: 'Bearer FLWSECK_TEST-abc123' } }),
    );
  });

  it('fails when Flutterwave rejects the key with a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid authorization key',
    }) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'bad-key' } });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
  });

  it('fails gracefully when the request itself throws (network error)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'FLWSECK_TEST-abc123' } });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('network down');
  });
});
