import { FlutterwaveProvider, FLUTTERWAVE_PROVIDER_CODE, fromFlutterwaveMajorUnits } from '../providers/flutterwave.provider';
import { PaymentProviderRegistry } from '../payment-provider.registry';

describe('FlutterwaveProvider', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: PaymentProviderRegistry;
  let provider: FlutterwaveProvider;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'FLWSECK_TEST-abc123' }) };
    registry = new PaymentProviderRegistry();
    provider = new FlutterwaveProvider(integrations as any, registry);
    process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID;
  });

  describe('onModuleInit', () => {
    it('registers itself into PaymentProviderRegistry under "FLUTTERWAVE"', () => {
      expect(registry.isRegistered(FLUTTERWAVE_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(FLUTTERWAVE_PROVIDER_CODE)).toBe(true);
      expect(registry.get(FLUTTERWAVE_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('getConfig', () => {
    it('throws a clear setup error when PAYMENT_FLUTTERWAVE_PROVIDER_ID is not set', async () => {
      delete process.env.PAYMENT_FLUTTERWAVE_PROVIDER_ID;
      await expect(provider.getConfig()).rejects.toThrow('PAYMENT_FLUTTERWAVE_PROVIDER_ID');
    });

    it('throws when the resolved credentials are missing secretKey', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getConfig()).rejects.toThrow('credentials.secretKey');
    });

    it('resolves the secret key from IntegrationsService', async () => {
      const config = await provider.getConfig();
      expect(config).toEqual({ secretKey: 'FLWSECK_TEST-abc123' });
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledWith('provider-1');
    });

    it('resolves only once per instance (cached), not once per call', async () => {
      await provider.getConfig();
      await provider.getConfig();
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializePayment (Checkpoint B)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('calls Flutterwave and maps a successful response to InitializePaymentResult', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'Hosted Link', data: { link: 'https://checkout.flutterwave.com/pay/abc123' } }),
      }) as any;

      const result = await provider.initializePayment({
        reference: 'r1',
        amount: 500000,
        currency: 'NGN',
        customerEmail: 'a@b.com',
        callbackUrl: 'https://example.com/callback',
      });

      expect(result).toEqual({ reference: 'r1', authorizationUrl: 'https://checkout.flutterwave.com/pay/abc123' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.flutterwave.com/v3/payments',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer FLWSECK_TEST-abc123', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tx_ref: 'r1',
            amount: 5000,
            currency: 'NGN',
            redirect_url: 'https://example.com/callback',
            customer: { email: 'a@b.com' },
            meta: undefined,
          }),
        }),
      );
    });

    it('converts amount from minor units (framework convention) to major units (Flutterwave convention)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { link: 'u' } }),
      }) as any;

      await provider.initializePayment({ reference: 'r1', amount: 123456, currency: 'NGN', customerEmail: 'a@b.com' });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.amount).toBe(1234.56);
      // Round-trip sanity check on the conversion pair itself.
      expect(fromFlutterwaveMajorUnits(body.amount)).toBe(123456);
    });

    it('throws a clear error when Flutterwave returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ status: 'error', message: 'Invalid parameters' }),
      }) as any;

      await expect(
        provider.initializePayment({ reference: 'r1', amount: 1000, currency: 'NGN', customerEmail: 'a@b.com' }),
      ).rejects.toThrow('Invalid parameters');
    });

    it('throws a clear error when Flutterwave returns status:"error" with a 200', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'error', message: 'Duplicate tx_ref' }),
      }) as any;

      await expect(
        provider.initializePayment({ reference: 'r1', amount: 1000, currency: 'NGN', customerEmail: 'a@b.com' }),
      ).rejects.toThrow('Duplicate tx_ref');
    });
  });

  /**
   * Checkpoint A deliberately leaves these three unimplemented — these
   * tests exist to confirm the skeleton fails loudly and identifiably
   * (naming which future checkpoint fills each in) rather than silently
   * returning something that looks like a real result.
   */
  describe('verifyPayment (Checkpoint C)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('calls Flutterwave verify_by_reference and maps a successful transaction', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          message: 'Transaction fetched successfully',
          data: { id: 285959875, tx_ref: 'r1', amount: 5000, currency: 'NGN', status: 'successful', created_at: '2026-07-29T10:00:00.000Z' },
        }),
      }) as any;

      const result = await provider.verifyPayment('r1');

      expect(result).toEqual({
        reference: 'r1',
        status: 'SUCCESSFUL',
        amount: 500000,
        currency: 'NGN',
        paidAt: new Date('2026-07-29T10:00:00.000Z'),
        providerReference: '285959875',
        raw: expect.objectContaining({ id: 285959875, status: 'successful' }),
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=r1',
        { headers: { Authorization: 'Bearer FLWSECK_TEST-abc123' } },
      );
    });

    it('converts the verified amount from Flutterwave major units back to framework minor units', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, tx_ref: 'r1', amount: 1234.56, currency: 'NGN', status: 'successful', created_at: '2026-01-01T00:00:00.000Z' } }),
      }) as any;

      const result = await provider.verifyPayment('r1');
      expect(result.amount).toBe(123456);
    });

    it('URL-encodes the reference', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, tx_ref: 'r/1', amount: 1, currency: 'NGN', status: 'pending', created_at: '2026-01-01T00:00:00.000Z' } }),
      }) as any;

      await provider.verifyPayment('r/1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=r%2F1',
        expect.any(Object),
      );
    });

    it('omits paidAt for a non-SUCCESSFUL status even when created_at is present', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, tx_ref: 'r1', amount: 1000, currency: 'NGN', status: 'pending', created_at: '2026-01-01T00:00:00.000Z' } }),
      }) as any;

      const result = await provider.verifyPayment('r1');
      expect(result.paidAt).toBeUndefined();
    });

    it('throws a clear error when Flutterwave returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status: 'error', message: 'No transaction was found for this reference' }),
      }) as any;

      await expect(provider.verifyPayment('missing-ref')).rejects.toThrow('No transaction was found for this reference');
    });

    it.each([
      ['successful', 'SUCCESSFUL'],
      ['failed', 'FAILED'],
      ['pending', 'PENDING'],
      ['some-future-status-flutterwave-invents', 'PENDING'],
    ])('maps Flutterwave status "%s" to PaymentStatus "%s"', async (flutterwaveStatus, expected) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, tx_ref: 'r1', amount: 1000, currency: 'NGN', status: flutterwaveStatus, created_at: '2026-01-01T00:00:00.000Z' } }),
      }) as any;

      const result = await provider.verifyPayment('r1');
      expect(result.status).toBe(expected);
    });
  });

  /**
   * Release IE.3, Checkpoint F. Unlike Paystack's refundPayment (which
   * calls its refund endpoint directly with the caller's own
   * reference), Flutterwave's refund endpoint needs Flutterwave's own
   * numeric transaction id — so every test here must mock TWO
   * sequential fetch calls: first the verify_by_reference lookup
   * (resolveTransactionId), then the actual POST /transactions/:id/refund.
   */
  describe('refundPayment (Checkpoint F)', () => {
    const originalFetch = global.fetch;

    function mockVerifyThenRefund(refundResponse: unknown, verifyOk = true) {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: verifyOk,
          status: verifyOk ? 200 : 400,
          json: async () => (verifyOk ? { status: 'success', message: 'ok', data: { id: 998877, tx_ref: 'r1' } } : { status: 'error', message: 'No transaction found' }),
        })
        .mockResolvedValueOnce(refundResponse) as any;
    }

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('resolves the transaction id via verify_by_reference, then calls the refund endpoint with it', async () => {
      mockVerifyThenRefund({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 4321, amount_refunded: 2000, status: 'completed' } }),
      });

      const result = await provider.refundPayment({ reference: 'r1', amount: 200000, reason: 'Customer requested' });

      expect(result).toEqual({ reference: 'r1', refundReference: '4321', status: 'SUCCESSFUL', amount: 200000 });
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=r1',
        expect.objectContaining({ headers: { Authorization: 'Bearer FLWSECK_TEST-abc123' } }),
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.flutterwave.com/v3/transactions/998877/refund',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer FLWSECK_TEST-abc123', 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 2000 }), // 200000 minor units -> 2000 major units
        }),
      );
    });

    it('omits amount entirely for a full refund', async () => {
      mockVerifyThenRefund({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, amount_refunded: 5000, status: 'completed' } }),
      });

      await provider.refundPayment({ reference: 'r1' });

      const call = (global.fetch as jest.Mock).mock.calls[1];
      const body = JSON.parse(call[1].body);
      expect(body.amount).toBeUndefined();
    });

    it.each([
      ['completed', 'SUCCESSFUL'],
      ['pending', 'PENDING'],
      ['failed', 'FAILED'],
      ['some-future-status', 'PENDING'],
    ])('maps Flutterwave refund status "%s" to RefundStatus "%s"', async (flutterwaveStatus, expected) => {
      mockVerifyThenRefund({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, amount_refunded: 1000, status: flutterwaveStatus } }),
      });

      const result = await provider.refundPayment({ reference: 'r1' });
      expect(result.status).toBe(expected);
    });

    it('throws a clear error when the transaction id cannot be resolved', async () => {
      mockVerifyThenRefund(undefined, false);
      await expect(provider.refundPayment({ reference: 'r1' })).rejects.toThrow(/could not resolve transaction id/);
    });

    it('throws a clear error when Flutterwave rejects the refund itself', async () => {
      mockVerifyThenRefund({
        ok: false,
        status: 400,
        json: async () => ({ status: 'error', message: 'Transaction already refunded' }),
      });

      await expect(provider.refundPayment({ reference: 'r1' })).rejects.toThrow('Transaction already refunded');
    });
  });

  describe('verifyRefund (Checkpoint G)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('calls GET /refunds/:id and maps a completed refund', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 999, amount_refunded: 5000, status: 'completed' } }),
      }) as any;

      const result = await provider.verifyRefund('999');

      expect(result).toEqual({ reference: '999', refundReference: '999', status: 'SUCCESSFUL', amount: 500000 });
      expect(global.fetch).toHaveBeenCalledWith('https://api.flutterwave.com/v3/refunds/999', expect.objectContaining({ headers: { Authorization: 'Bearer FLWSECK_TEST-abc123' } }));
    });

    it('URL-encodes the refund reference', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, amount_refunded: 1, status: 'pending' } }),
      }) as any;

      await provider.verifyRefund('rf/1');
      expect(global.fetch).toHaveBeenCalledWith('https://api.flutterwave.com/v3/refunds/rf%2F1', expect.anything());
    });

    it.each([
      ['completed', 'SUCCESSFUL'],
      ['failed', 'FAILED'],
      ['pending', 'PENDING'],
      ['some-future-status', 'PENDING'],
    ])('maps Flutterwave refund status "%s" to RefundStatus "%s"', async (flutterwaveStatus, expected) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok', data: { id: 1, amount_refunded: 1, status: flutterwaveStatus } }),
      }) as any;

      const result = await provider.verifyRefund('1');
      expect(result.status).toBe(expected);
    });

    it('throws a clear error when Flutterwave returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ status: 'error', message: 'Refund not found' }) }) as any;
      await expect(provider.verifyRefund('missing')).rejects.toThrow('Refund not found');
    });
  });
});
