import { PaystackProvider, PAYSTACK_PROVIDER_CODE } from '../providers/paystack.provider';
import { PaymentProviderRegistry } from '../payment-provider.registry';

describe('PaystackProvider', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: PaymentProviderRegistry;
  let provider: PaystackProvider;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'sk_test_123' }) };
    registry = new PaymentProviderRegistry();
    provider = new PaystackProvider(integrations as any, registry);
    process.env.PAYMENT_PAYSTACK_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
  });

  describe('onModuleInit', () => {
    it('registers itself into PaymentProviderRegistry under "PAYSTACK"', () => {
      expect(registry.isRegistered(PAYSTACK_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(PAYSTACK_PROVIDER_CODE)).toBe(true);
      expect(registry.get(PAYSTACK_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('getConfig', () => {
    it('throws a clear setup error when PAYMENT_PAYSTACK_PROVIDER_ID is not set', async () => {
      delete process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
      await expect(provider.getConfig()).rejects.toThrow('PAYMENT_PAYSTACK_PROVIDER_ID');
    });

    it('throws when the resolved credentials are missing secretKey', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getConfig()).rejects.toThrow('credentials.secretKey');
    });

    it('resolves the secret key from IntegrationsService', async () => {
      const config = await provider.getConfig();
      expect(config).toEqual({ secretKey: 'sk_test_123' });
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

    it('calls Paystack and maps a successful response to InitializePaymentResult', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Authorization URL created',
          data: { authorization_url: 'https://checkout.paystack.com/abc123', access_code: 'ac_xyz', reference: 'r1' },
        }),
      }) as any;

      const result = await provider.initializePayment({
        reference: 'r1',
        amount: 500000,
        currency: 'NGN',
        customerEmail: '[email protected]',
        callbackUrl: 'https://example.com/callback',
      });

      expect(result).toEqual({
        reference: 'r1',
        authorizationUrl: 'https://checkout.paystack.com/abc123',
        providerReference: 'ac_xyz',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/initialize',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer sk_test_123', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: '[email protected]',
            amount: 500000,
            currency: 'NGN',
            reference: 'r1',
            callback_url: 'https://example.com/callback',
            metadata: undefined,
          }),
        }),
      );
    });

    it('passes amount through unconverted (already minor-unit per framework convention)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { authorization_url: 'u', access_code: 'a', reference: 'r1' } }),
      }) as any;

      await provider.initializePayment({ reference: 'r1', amount: 123456, currency: 'NGN', customerEmail: '[email protected]' });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.amount).toBe(123456);
    });

    it('throws a clear error when Paystack returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ status: false, message: 'Invalid parameters' }),
      }) as any;

      await expect(
        provider.initializePayment({ reference: 'r1', amount: 1000, currency: 'NGN', customerEmail: '[email protected]' }),
      ).rejects.toThrow('Invalid parameters');
    });

    it('throws a clear error when Paystack returns status:false with a 200', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: false, message: 'Duplicate reference' }),
      }) as any;

      await expect(
        provider.initializePayment({ reference: 'r1', amount: 1000, currency: 'NGN', customerEmail: '[email protected]' }),
      ).rejects.toThrow('Duplicate reference');
    });
  });

  describe('verifyPayment (Checkpoint C)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('calls Paystack verify and maps a successful transaction', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Verification successful',
          data: { id: 998877, reference: 'r1', status: 'success', amount: 500000, currency: 'NGN', paid_at: '2026-07-29T10:00:00.000Z' },
        }),
      }) as any;

      const result = await provider.verifyPayment('r1');

      expect(result).toEqual({
        reference: 'r1',
        status: 'SUCCESSFUL',
        amount: 500000,
        currency: 'NGN',
        paidAt: new Date('2026-07-29T10:00:00.000Z'),
        providerReference: '998877',
        raw: expect.objectContaining({ id: 998877, status: 'success' }),
      });
      expect(global.fetch).toHaveBeenCalledWith('https://api.paystack.co/transaction/verify/r1', {
        headers: { Authorization: 'Bearer sk_test_123' },
      });
    });

    it('URL-encodes the reference', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, reference: 'r/1', status: 'pending', amount: 1, currency: 'NGN', paid_at: null } }),
      }) as any;

      await provider.verifyPayment('r/1');

      expect(global.fetch).toHaveBeenCalledWith('https://api.paystack.co/transaction/verify/r%2F1', expect.any(Object));
    });

    it.each([
      ['success', 'SUCCESSFUL'],
      ['abandoned', 'ABANDONED'],
      ['failed', 'FAILED'],
      ['reversed', 'FAILED'],
      ['pending', 'PENDING'],
      ['queued', 'PENDING'],
      ['some-future-status-paystack-invents', 'PENDING'],
    ])('maps Paystack status "%s" to PaymentStatus "%s"', async (paystackStatus, expected) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, reference: 'r1', status: paystackStatus, amount: 1000, currency: 'NGN', paid_at: null } }),
      }) as any;

      const result = await provider.verifyPayment('r1');
      expect(result.status).toBe(expected);
    });

    it('leaves paidAt undefined when Paystack has not set paid_at', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, reference: 'r1', status: 'pending', amount: 1000, currency: 'NGN', paid_at: null } }),
      }) as any;

      const result = await provider.verifyPayment('r1');
      expect(result.paidAt).toBeUndefined();
    });

    it('throws a clear error when Paystack returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status: false, message: 'Transaction reference not found' }),
      }) as any;

      await expect(provider.verifyPayment('missing-ref')).rejects.toThrow('Transaction reference not found');
    });

    it('throws a clear error when Paystack returns status:false with a 200', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: false, message: 'Invalid reference' }),
      }) as any;

      await expect(provider.verifyPayment('r1')).rejects.toThrow('Invalid reference');
    });
  });

  describe('refundPayment (Checkpoint E)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('calls Paystack refund and maps a processed refund', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'Refund has been queued for processing',
          data: { id: 4321, amount: 200000, currency: 'NGN', status: 'processed' },
        }),
      }) as any;

      const result = await provider.refundPayment({ reference: 'r1', amount: 200000, reason: 'Customer requested' });

      expect(result).toEqual({ reference: 'r1', refundReference: '4321', status: 'SUCCESSFUL', amount: 200000 });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.paystack.co/refund',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer sk_test_123', 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: 'r1', amount: 200000, customer_note: 'Customer requested', merchant_note: 'Customer requested' }),
        }),
      );
    });

    it('omits amount for a full refund (Paystack refunds the whole transaction when amount is undefined)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, amount: 500000, currency: 'NGN', status: 'pending' } }),
      }) as any;

      await provider.refundPayment({ reference: 'r1' });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.amount).toBeUndefined();
    });

    it.each([
      ['processed', 'SUCCESSFUL'],
      ['failed', 'FAILED'],
      ['pending', 'PENDING'],
      ['processing', 'PENDING'],
      ['some-future-status', 'PENDING'],
    ])('maps Paystack refund status "%s" to RefundStatus "%s"', async (paystackStatus, expected) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, amount: 1000, currency: 'NGN', status: paystackStatus } }),
      }) as any;

      const result = await provider.refundPayment({ reference: 'r1' });
      expect(result.status).toBe(expected);
    });

    it('throws a clear error when Paystack returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ status: false, message: 'Transaction already refunded' }),
      }) as any;

      await expect(provider.refundPayment({ reference: 'r1' })).rejects.toThrow('Transaction already refunded');
    });

    it('throws a clear error when Paystack returns status:false with a 200', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: false, message: 'Refund amount exceeds transaction amount' }),
      }) as any;

      await expect(provider.refundPayment({ reference: 'r1' })).rejects.toThrow('Refund amount exceeds transaction amount');
    });
  });

  describe('verifyRefund (Checkpoint G)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('calls GET /refund/:id and maps a processed refund, including the nested transaction reference', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: true,
          message: 'ok',
          data: { id: 4321, amount: 200000, currency: 'NGN', status: 'processed', transaction: { reference: 'r1' } },
        }),
      }) as any;

      const result = await provider.verifyRefund('4321');

      expect(result).toEqual({ reference: 'r1', refundReference: '4321', status: 'SUCCESSFUL', amount: 200000 });
      expect(global.fetch).toHaveBeenCalledWith('https://api.paystack.co/refund/4321', expect.objectContaining({ headers: { Authorization: 'Bearer sk_test_123' } }));
    });

    it('falls back to refundReference for `reference` when the response has no nested transaction object', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 4321, amount: 200000, currency: 'NGN', status: 'pending' } }),
      }) as any;

      const result = await provider.verifyRefund('4321');
      expect(result.reference).toBe('4321');
    });

    it('URL-encodes the refund reference', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, amount: 1, currency: 'NGN', status: 'pending' } }),
      }) as any;

      await provider.verifyRefund('rf/1');
      expect(global.fetch).toHaveBeenCalledWith('https://api.paystack.co/refund/rf%2F1', expect.anything());
    });

    it.each([
      ['processed', 'SUCCESSFUL'],
      ['failed', 'FAILED'],
      ['pending', 'PENDING'],
    ])('maps Paystack refund status "%s" to RefundStatus "%s"', async (paystackStatus, expected) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { id: 1, amount: 1, currency: 'NGN', status: paystackStatus } }),
      }) as any;

      const result = await provider.verifyRefund('1');
      expect(result.status).toBe(expected);
    });

    it('throws a clear error when Paystack returns a non-OK HTTP status', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ status: false, message: 'Refund not found' }) }) as any;
      await expect(provider.verifyRefund('missing')).rejects.toThrow('Refund not found');
    });
  });
});
