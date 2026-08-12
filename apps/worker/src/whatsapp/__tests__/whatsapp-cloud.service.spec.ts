import { WhatsAppCloudService } from '../whatsapp-cloud.service';
import { encryptIntegrationCredentials } from '@7f/config';

describe('WhatsAppCloudService (Release ID.2 Part 1)', () => {
  let prisma: { integrationProvider: { findUnique: jest.Mock } };
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    prisma = { integrationProvider: { findUnique: jest.fn() } };
    process.env = { ...originalEnv };
    delete process.env.WHATSAPP_CLOUD_PROVIDER_ID;
    delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('logs a no-op and reports undelivered when nothing is configured', async () => {
    const service = new WhatsAppCloudService(prisma as any);
    const result = await service.send({ to: '+15551234567', body: 'hi' });
    expect(result).toEqual({ delivered: false });
  });

  it('falls back to raw WHATSAPP_CLOUD_* env vars when no provider row is configured', async () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'env-token';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'env-phone-id';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.123' }] }) }) as any;

    const service = new WhatsAppCloudService(prisma as any);
    const result = await service.send({ to: '+15551234567', body: 'hi' });

    expect(result).toEqual({ delivered: true, providerMessageId: 'wamid.123' });
    expect(prisma.integrationProvider.findUnique).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/env-phone-id/messages',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer env-token' }) }),
    );
  });

  it('resolves config/credentials from the IntegrationProvider row when WHATSAPP_CLOUD_PROVIDER_ID is set', async () => {
    process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'prov-1';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      isActive: true,
      config: { phoneNumberId: 'graph-phone-id' },
      encryptedCredentials: encryptIntegrationCredentials({ accessToken: 'graph-token' }),
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.456' }] }) }) as any;

    const service = new WhatsAppCloudService(prisma as any);
    const result = await service.send({ to: '+15551234567', body: 'hi' });

    expect(result.delivered).toBe(true);
    expect(prisma.integrationProvider.findUnique).toHaveBeenCalledWith({ where: { id: 'prov-1' } });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/graph-phone-id/messages',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer graph-token' }) }),
    );
  });

  it('strips the leading + from the destination number (Graph API expects none)', async () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-id';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) }) as any;

    const service = new WhatsAppCloudService(prisma as any);
    await service.send({ to: '+15551234567', body: 'hi' });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.to).toBe('15551234567');
  });

  it('throws with the Graph API error message when the send fails', async () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'tok';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-id';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Recipient phone number not in allowed list' } }),
    }) as any;

    const service = new WhatsAppCloudService(prisma as any);
    await expect(service.send({ to: '+15551234567', body: 'hi' })).rejects.toThrow('Recipient phone number not in allowed list');
  });

  it('falls back to env vars when the configured provider row is inactive', async () => {
    process.env.WHATSAPP_CLOUD_PROVIDER_ID = 'prov-1';
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'fallback-token';
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'fallback-phone-id';
    prisma.integrationProvider.findUnique.mockResolvedValue({ id: 'prov-1', isActive: false, config: {}, encryptedCredentials: null });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.789' }] }) }) as any;

    const service = new WhatsAppCloudService(prisma as any);
    const result = await service.send({ to: '+15551234567', body: 'hi' });

    expect(result.delivered).toBe(true);
  });
});
