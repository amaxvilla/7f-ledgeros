import { MonoWebhookHandler } from '../providers/mono-webhook.handler';
import { BankWebhookHandlerRegistry } from '../bank-webhook-handler.registry';
import { MONO_PROVIDER_CODE } from '../providers/mono.provider';

describe('MonoWebhookHandler', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: BankWebhookHandlerRegistry;
  let handler: MonoWebhookHandler;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'live_sk_abc', webhookSecret: 'whs_test_secret' }) };
    registry = new BankWebhookHandlerRegistry();
    handler = new MonoWebhookHandler(integrations as any, registry);
    process.env.BANK_MONO_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.BANK_MONO_PROVIDER_ID;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into BankWebhookHandlerRegistry under "MONO"', () => {
      expect(registry.isRegistered(MONO_PROVIDER_CODE)).toBe(false);
      handler.onModuleInit();
      expect(registry.isRegistered(MONO_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MONO_PROVIDER_CODE)).toBe(handler);
    });
  });

  describe('verifySignature', () => {
    it('accepts a header that matches the configured webhookSecret exactly', async () => {
      const result = await handler.verifySignature('{}', { 'mono-webhook-secret': 'whs_test_secret' });
      expect(result).toBe(true);
    });

    it('rejects when the header is missing', async () => {
      const result = await handler.verifySignature('{}', {});
      expect(result).toBe(false);
      expect(integrations.getDecryptedCredentials).not.toHaveBeenCalled();
    });

    it('rejects a header that does not match the configured secret', async () => {
      const result = await handler.verifySignature('{}', { 'mono-webhook-secret': 'wrong-secret' });
      expect(result).toBe(false);
    });

    it('rejects when credentials.webhookSecret is not configured', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({ secretKey: 'live_sk_abc' });
      await expect(handler.verifySignature('{}', { 'mono-webhook-secret': 'anything' })).rejects.toThrow('credentials.webhookSecret');
    });

    it('resolves the secret only once per instance (cached)', async () => {
      await handler.verifySignature('{}', { 'mono-webhook-secret': 'whs_test_secret' });
      await handler.verifySignature('{}', { 'mono-webhook-secret': 'whs_test_secret' });
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseEvent', () => {
    it('parses mono.events.reauthorisation_required (data as a bare account-id string)', () => {
      const body = JSON.stringify({ event: 'mono.events.reauthorisation_required', data: 'acc_xyz789' });
      const result = handler.parseEvent(body);
      expect(result).toEqual({ kind: 'link_status', event: { providerAccountId: 'acc_xyz789', status: 'REQUIRES_REAUTH', raw: { event: 'mono.events.reauthorisation_required', data: 'acc_xyz789' } } });
    });

    it('parses mono.events.account_reauthorized (data.account as a bare string)', () => {
      const body = JSON.stringify({ event: 'mono.events.account_reauthorized', data: { account: 'acc_xyz789' } });
      const result = handler.parseEvent(body);
      expect(result.kind).toBe('link_status');
      expect((result as any).event).toEqual({ providerAccountId: 'acc_xyz789', status: 'ACTIVE', raw: { event: 'mono.events.account_reauthorized', data: { account: 'acc_xyz789' } } });
    });

    it('parses mono.events.account_reauthorized (data.account.id nested shape)', () => {
      const body = JSON.stringify({ event: 'mono.events.account_reauthorized', data: { account: { id: 'acc_xyz789' } } });
      const result = handler.parseEvent(body);
      expect((result as any).event.providerAccountId).toBe('acc_xyz789');
    });

    it('parses mono.events.account_reauthorized (data.id shape)', () => {
      const body = JSON.stringify({ event: 'mono.events.account_reauthorized', data: { id: 'acc_xyz789' } });
      const result = handler.parseEvent(body);
      expect((result as any).event.providerAccountId).toBe('acc_xyz789');
    });

    it('returns { kind: "ignored" } for mono.events.account_updated', () => {
      const body = JSON.stringify({ event: 'mono.events.account_updated', data: { account: { id: 'acc_xyz789' }, meta: { data_status: 'AVAILABLE' } } });
      const result = handler.parseEvent(body);
      expect(result).toEqual({ kind: 'ignored', eventType: 'mono.events.account_updated' });
    });

    it('returns { kind: "ignored" } for any other recognised mono.events.* type', () => {
      const body = JSON.stringify({ event: 'mono.events.dataset_available', data: {} });
      const result = handler.parseEvent(body);
      expect(result).toEqual({ kind: 'ignored', eventType: 'mono.events.dataset_available' });
    });

    it('throws on a completely unrecognised event namespace', () => {
      const body = JSON.stringify({ event: 'something.else', data: {} });
      expect(() => handler.parseEvent(body)).toThrow('Unrecognised Mono webhook event type "something.else"');
    });

    it('throws a clear error when the account id cannot be extracted from any known shape', () => {
      const body = JSON.stringify({ event: 'mono.events.reauthorisation_required', data: { unexpected: true } });
      expect(() => handler.parseEvent(body)).toThrow(/could not extract an account id/);
    });

    it('accepts a Buffer raw body identically to a string', () => {
      const body = Buffer.from(JSON.stringify({ event: 'mono.events.reauthorisation_required', data: 'acc_xyz789' }), 'utf-8');
      const result = handler.parseEvent(body);
      expect((result as any).event.providerAccountId).toBe('acc_xyz789');
    });
  });
});
