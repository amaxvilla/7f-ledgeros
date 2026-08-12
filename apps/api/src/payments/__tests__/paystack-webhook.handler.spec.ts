import * as crypto from 'crypto';
import { PaystackWebhookHandler } from '../providers/paystack-webhook.handler';
import { PaymentWebhookHandlerRegistry } from '../payment-webhook-handler.registry';
import { PAYSTACK_PROVIDER_CODE } from '../providers/paystack.provider';

function signBody(secretKey: string, body: string): string {
  return crypto.createHmac('sha512', secretKey).update(Buffer.from(body, 'utf-8')).digest('hex');
}

describe('PaystackWebhookHandler', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: PaymentWebhookHandlerRegistry;
  let handler: PaystackWebhookHandler;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'sk_test_123' }) };
    registry = new PaymentWebhookHandlerRegistry();
    handler = new PaystackWebhookHandler(integrations as any, registry);
    process.env.PAYMENT_PAYSTACK_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into PaymentWebhookHandlerRegistry under "PAYSTACK"', () => {
      expect(registry.isRegistered(PAYSTACK_PROVIDER_CODE)).toBe(false);
      handler.onModuleInit();
      expect(registry.isRegistered(PAYSTACK_PROVIDER_CODE)).toBe(true);
      expect(registry.get(PAYSTACK_PROVIDER_CODE)).toBe(handler);
    });
  });

  describe('verifySignature', () => {
    const body = JSON.stringify({ event: 'charge.success', data: { id: 1, reference: 'r1', status: 'success', amount: 1000, currency: 'NGN', paid_at: null } });

    it('accepts a correctly computed HMAC-SHA512 signature', async () => {
      const signature = signBody('sk_test_123', body);
      const result = await handler.verifySignature(body, { 'x-paystack-signature': signature });
      expect(result).toBe(true);
    });

    it('accepts a Buffer raw body identically to a string', async () => {
      const signature = signBody('sk_test_123', body);
      const result = await handler.verifySignature(Buffer.from(body, 'utf-8'), { 'x-paystack-signature': signature });
      expect(result).toBe(true);
    });

    it('rejects when the signature header is missing', async () => {
      const result = await handler.verifySignature(body, {});
      expect(result).toBe(false);
      expect(integrations.getDecryptedCredentials).not.toHaveBeenCalled();
    });

    it('rejects a signature computed with the wrong secret key', async () => {
      const signature = signBody('wrong-secret', body);
      const result = await handler.verifySignature(body, { 'x-paystack-signature': signature });
      expect(result).toBe(false);
    });

    it('rejects a signature computed over a tampered body', async () => {
      const signature = signBody('sk_test_123', body);
      const tampered = body.replace('success', 'failed');
      const result = await handler.verifySignature(tampered, { 'x-paystack-signature': signature });
      expect(result).toBe(false);
    });

    it('rejects a malformed signature header without throwing', async () => {
      const result = await handler.verifySignature(body, { 'x-paystack-signature': 'not-hex-!!!' });
      expect(result).toBe(false);
    });

    it('resolves the secret key only once across multiple calls (cached)', async () => {
      const signature = signBody('sk_test_123', body);
      await handler.verifySignature(body, { 'x-paystack-signature': signature });
      await handler.verifySignature(body, { 'x-paystack-signature': signature });
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseEvent', () => {
    it('parses a charge.success event into a charge-kind ParsedPaymentWebhookEvent', () => {
      const body = JSON.stringify({
        event: 'charge.success',
        data: { id: 998877, reference: 'r1', status: 'success', amount: 500000, currency: 'NGN', paid_at: '2026-07-29T10:00:00.000Z' },
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
        raw: expect.objectContaining({ id: 998877, status: 'success' }),
      });
    });

    it('parses a charge.failed event and maps status to FAILED', () => {
      const body = JSON.stringify({
        event: 'charge.failed',
        data: { id: 5, reference: 'r2', status: 'failed', amount: 1000, currency: 'NGN', paid_at: null },
      });

      const parsed = handler.parseEvent(body);
      expect(parsed.kind).toBe('charge');
      expect(parsed.kind === 'charge' && parsed.event.status).toBe('FAILED');
      expect(parsed.kind === 'charge' && parsed.event.paidAt).toBeUndefined();
    });

    it('accepts a Buffer raw body identically to a string', () => {
      const body = JSON.stringify({ event: 'charge.success', data: { id: 1, reference: 'r1', status: 'success', amount: 1, currency: 'NGN', paid_at: null } });
      const parsed = handler.parseEvent(Buffer.from(body, 'utf-8'));
      expect(parsed.kind === 'charge' && parsed.event.reference).toBe('r1');
    });

    it('throws a clear error for a non-charge, non-refund-shaped event (KNOWN LIMITATION)', () => {
      const body = JSON.stringify({ event: 'transfer.success', data: { transfer_code: 'TRF_abc', status: 'success' } });
      expect(() => handler.parseEvent(body)).toThrow(/transfer\.success/);
    });

    describe('refund events (Checkpoint E)', () => {
      it('parses a refund.processed event into a refund-kind ParsedPaymentWebhookEvent', () => {
        const body = JSON.stringify({ event: 'refund.processed', data: { id: 4321, status: 'processed', amount: 500000 } });

        const parsed = handler.parseEvent(body);

        expect(parsed.kind).toBe('refund');
        expect(parsed.event).toEqual({
          refundReference: '4321',
          status: 'SUCCESSFUL',
          raw: expect.objectContaining({ id: 4321, status: 'processed' }),
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
        const body = JSON.stringify({ event: 'refund.processed', data: { status: 'processed' } });
        expect(() => handler.parseEvent(body)).toThrow(/data\.id/);
      });
    });
  });
});
