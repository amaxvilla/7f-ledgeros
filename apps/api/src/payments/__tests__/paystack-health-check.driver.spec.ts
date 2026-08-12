import { PaystackHealthCheckDriver } from '../providers/paystack-health-check.driver';

describe('PaystackHealthCheckDriver', () => {
  let driver: PaystackHealthCheckDriver;
  const originalFetch = global.fetch;

  beforeEach(() => {
    driver = new PaystackHealthCheckDriver();
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

  it('succeeds when Paystack accepts the secret key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Banks retrieved' }),
    }) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'sk_test_123' } });

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Banks retrieved');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/bank'),
      expect.objectContaining({ headers: { Authorization: 'Bearer sk_test_123' } }),
    );
  });

  it('fails when Paystack rejects the key with a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid key',
    }) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'sk_bad' } });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
  });

  it('fails gracefully when the request itself throws (network error)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await driver.healthCheck({ config: null, credentials: { secretKey: 'sk_test_123' } });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('network down');
  });
});
