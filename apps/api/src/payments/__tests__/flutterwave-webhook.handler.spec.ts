import { FlutterwaveWebhookHandler } from '../providers/flutterwave-webhook.handler';
import { PaymentWebhookHandlerRegistry } from '../payment-webhook-handler.registry';
import { FLUTTERWAVE_PROVIDER_CODE } from '../providers/flutterwave.provider';

describe('FlutterwaveWebhookHandler', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: PaymentWebhookHandlerRegistry;
  let handler: FlutterwaveWebhookHandler;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'FLWSECK_TEST-abc', webhookSecretHash: 'my-configured-secret-hash' }) };
    registry = new PaymentWebhookHandlerRegistry();
    handler = new FlutterwaveWebhookHandler(integrations as any, registry);
    process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into PaymentWebhookHandlerRegistry under "FLUTTERWAVE"', () => {
      expect(registry.isRegistered(FLUTTERWAVE_PROVIDER_CODE)).toBe(false);
      handler.onModuleInit();
      expect(registry.isRegistered(FLUTTERWAVE_PROVIDER_CODE)).toBe(true);
      expect(registry.get(FLUTTERWAVE_PROVIDER_CODE)).toBe(handler);
    });
  });

  describe('verifySignature', () => {
    const body = JSON.stringify({ event: 'charge.completed', data: { id: 1, tx_ref: 'r1', status: 'successful', amount: 5000, currency: 'NGN', created_at: null } });

    it('accepts when verif-hash matches the configured secret hash exactly', async () => {
      const result = await handler.verifySignature(body, { 'verif-hash': 'my-configured-secret-hash' });
      expect(result).toBe(true);
    });

    it('accepts a Buffer raw body identically to a string (body content is irrelevant to this scheme)', async () => {
      const result = await handler.verifySignature(Buffer.from(body, 'utf-8'), { 'verif-hash': 'my-configured-secret-hash' });
      expect(result).toBe(true);
    });

    it('rejects when the verif-hash header is missing', async () => {
      const result = await handler.verifySignature(body, {});
      expect(result).toBe(false);
      expect(integrations.getDecryptedCredentials).not.toHaveBeenCalled();
    });

    it('rejects a verif-hash that does not match the configured secret hash', async () => {
      const result = await handler.verifySignature(body, { 'verif-hash': 'wrong-hash' });
      expect(result).toBe(false);
    });

    it('rejects a verif-hash of different length than the configured secret hash without throwing', async () => {
      const result = await handler.verifySignature(body, { 'verif-hash': 'short' });
      expect(result).toBe(false);
    });

    it('resolves the secret hash only once across multiple calls (cached)', async () => {
      await handler.verifySignature(body, { 'verif-hash': 'my-configured-secret-hash' });
      await handler.verifySignature(body, { 'verif-hash': 'my-configured-secret-hash' });
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });

    it('throws a clear error when credentials.webhookSecretHash is not configured', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({ secretKey: 'FLWSECK_TEST-abc' });
      await expect(handler.verifySignature(body, { 'verif-hash': 'anything' })).rejects.toThrow(/webhookSecretHash/);
    });
  });

  describe('parseEvent', () => {
    it('parses a charge.completed/successful event into a charge-kind ParsedPaymentWebhookEvent', () => {
      const body = JSON.stringify({
        event: 'charge.completed',
        data: { id: 998877, tx_ref: 'r1', status: 'successful', amount: 5000, currency: 'NGN', created_at: '2026-07-29T10:00:00.000Z' },
      });

      const parsed = handler.parseEvent(body);

      expect(parsed.kind).toBe('charge');
      expect(parsed.event).toEqual({
        reference: 'r1',
        status: 'SUCCESSFUL',
        amount: 500000,
        currency: 'NGN',
        paidAt: new Date('2026-07-29T10:00:00.000Z'),
        providerReference: '998877',
        raw: expect.objectContaining({ id: 998877, status: 'successful' }),
      });
    });

    it('parses a failed charge event and maps status to FAILED, with no paidAt', () => {
      const body = JSON.stringify({
        event: 'charge.completed',
        data: { id: 5, tx_ref: 'r2', status: 'failed', amount: 1000, currency: 'NGN', created_at: '2026-07-29T10:00:00.000Z' },
      });

      const parsed = handler.parseEvent(body);
      expect(parsed.kind).toBe('charge');
      expect(parsed.kind === 'charge' && parsed.event.status).toBe('FAILED');
      expect(parsed.kind === 'charge' && parsed.event.paidAt).toBeUndefined();
    });

    it('converts the amount from Flutterwave major units back to minor units', () => {
      const body = JSON.stringify({
        event: 'charge.completed',
        data: { id: 1, tx_ref: 'r3', status: 'successful', amount: 123.45, currency: 'NGN', created_at: '2026-07-29T10:00:00.000Z' },
      });

      const parsed = handler.parseEvent(body);
      expect(parsed.kind === 'charge' && parsed.event.amount).toBe(12345);
    });

    it('accepts a Buffer raw body identically to a string', () => {
      const body = JSON.stringify({ event: 'charge.completed', data: { id: 1, tx_ref: 'r1', status: 'successful', amount: 1, currency: 'NGN', created_at: null } });
      const parsed = handler.parseEvent(Buffer.from(body, 'utf-8'));
      expect(parsed.kind === 'charge' && parsed.event.reference).toBe('r1');
    });

    it('throws a clear error for a non-charge, non-refund-shaped event (KNOWN LIMITATION)', () => {
      const body = JSON.stringify({ event: 'transfer.completed', data: { id: 1, status: 'successful' } });
      expect(() => handler.parseEvent(body)).toThrow(/transfer\.completed/);
    });

    describe('refund events (Checkpoint H)', () => {
      it('parses a refund.completed event into a refund-kind ParsedPaymentWebhookEvent', () => {
        const body = JSON.stringify({ event: 'refund.completed', data: { id: 4321, status: 'completed' } });

        const parsed = handler.parseEvent(body);

        expect(parsed.kind).toBe('refund');
        expect(parsed.event).toEqual({
          refundReference: '4321',
          status: 'SUCCESSFUL',
          raw: expect.objectContaining({ id: 4321, status: 'completed' }),
        });
      });

      it('parses a refund.failed event and maps status to FAILED', () => {
        const body = JSON.stringify({ event: 'refund.failed', data: { id: 4322, status: 'failed' } });
        const parsed = handler.parseEvent(body);
        expect(parsed.kind === 'refund' && parsed.event.status).toBe('FAILED');
      });

      it('parses a refund.pending event and maps status to PENDING', () => {
        const body = JSON.stringify({ event: 'refund.pending', data: { id: 4323, status: 'pending' } });
        const parsed = handler.parseEvent(body);
        expect(parsed.kind === 'refund' && parsed.event.status).toBe('PENDING');
      });

      it('throws a clear error when a refund event has no data.id', () => {
        const body = JSON.stringify({ event: 'refund.completed', data: { status: 'completed' } });
        expect(() => handler.parseEvent(body)).toThrow(/data\.id/);
      });
    });
  });
});
