import { WhatsAppCloudHealthCheckDriver } from '../whatsapp-health-check.driver';

describe('WhatsAppCloudHealthCheckDriver', () => {
  let driver: WhatsAppCloudHealthCheckDriver;
  const originalFetch = global.fetch;

  beforeEach(() => {
    driver = new WhatsAppCloudHealthCheckDriver();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fails when credentials.accessToken is missing', async () => {
    const result = await driver.healthCheck({ config: { phoneNumberId: '123' }, credentials: null });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/accessToken/);
  });

  it('fails when config.phoneNumberId is missing', async () => {
    const result = await driver.healthCheck({ config: null, credentials: { accessToken: 'tok' } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/phoneNumberId/);
  });

  it('succeeds when Meta confirms the phone number', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_phone_number: '+1 555 000 1111', verified_name: 'Acme Corp' }),
    }) as any;

    const result = await driver.healthCheck({
      config: { phoneNumberId: '123456' },
      credentials: { accessToken: 'tok' },
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Acme Corp');
  });

  it('fails when Meta rejects the credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth access token' } }),
    }) as any;

    const result = await driver.healthCheck({
      config: { phoneNumberId: '123456' },
      credentials: { accessToken: 'bad-token' },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Invalid OAuth access token');
  });
});
