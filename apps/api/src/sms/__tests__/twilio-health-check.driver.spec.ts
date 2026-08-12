import { TwilioHealthCheckDriver } from '../twilio-health-check.driver';

describe('TwilioHealthCheckDriver', () => {
  let driver: TwilioHealthCheckDriver;
  const originalFetch = global.fetch;

  beforeEach(() => {
    driver = new TwilioHealthCheckDriver();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fails when accountSid/authToken are missing', async () => {
    const result = await driver.healthCheck({ config: { fromNumber: '+15550001111' }, credentials: null });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/accountSid|authToken/);
  });

  it('fails when config.fromNumber is missing', async () => {
    const result = await driver.healthCheck({ config: null, credentials: { accountSid: 'AC1', authToken: 'tok' } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/fromNumber/);
  });

  it('succeeds when Twilio confirms an active account', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'active', friendly_name: 'My Twilio Account' }),
    }) as any;

    const result = await driver.healthCheck({
      config: { fromNumber: '+15550001111' },
      credentials: { accountSid: 'AC1', authToken: 'tok' },
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('My Twilio Account');
  });

  it('fails when the account status is not active', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'suspended' }),
    }) as any;

    const result = await driver.healthCheck({
      config: { fromNumber: '+15550001111' },
      credentials: { accountSid: 'AC1', authToken: 'tok' },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('suspended');
  });

  it('fails when Twilio rejects the credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Authenticate' }),
    }) as any;

    const result = await driver.healthCheck({
      config: { fromNumber: '+15550001111' },
      credentials: { accountSid: 'AC1', authToken: 'bad-token' },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
  });

  it('fails without throwing on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    const result = await driver.healthCheck({
      config: { fromNumber: '+15550001111' },
      credentials: { accountSid: 'AC1', authToken: 'tok' },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('ECONNREFUSED');
  });
});
