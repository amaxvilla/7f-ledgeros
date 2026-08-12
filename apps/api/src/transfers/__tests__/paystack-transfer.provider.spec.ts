import { PaystackTransferProvider, PAYSTACK_TRANSFER_PROVIDER_CODE, mapPaystackTransferStatus } from '../providers/paystack-transfer.provider';
import { TransferProviderRegistry } from '../transfer-provider.registry';

describe('PaystackTransferProvider', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: TransferProviderRegistry;
  let provider: PaystackTransferProvider;
  const originalFetch = global.fetch;

  const params = {
    amount: 5000,
    currency: 'NGN',
    recipientAccountNumber: '0123456789',
    recipientBankCode: '044',
    recipientName: 'Ada Lovelace',
    reference: 'txn-ref-001',
    narration: 'Vendor payment',
  };

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'sk_test_123' }) };
    registry = new TransferProviderRegistry();
    provider = new PaystackTransferProvider(integrations as any, registry);
    process.env.PAYMENT_PAYSTACK_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into TransferProviderRegistry under "PAYSTACK"', () => {
      expect(registry.isRegistered(PAYSTACK_TRANSFER_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(PAYSTACK_TRANSFER_PROVIDER_CODE)).toBe(true);
      expect(registry.get(PAYSTACK_TRANSFER_PROVIDER_CODE)).toBe(provider);
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

    it('resolves only once per instance (cached)', async () => {
      await provider.getConfig();
      await provider.getConfig();
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });

  describe('initiateTransfer', () => {
    it('creates a recipient, then initiates the transfer, converting major-unit amount to kobo', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: true, message: 'ok', data: { recipient_code: 'RCP_abc' } }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: true, message: 'ok', data: { transfer_code: 'TRF_xyz', reference: 'txn-ref-001', status: 'success', amount: 500000 } }),
        }) as any;

      const result = await provider.initiateTransfer(params);

      expect(result).toEqual({ providerTransferId: 'TRF_xyz', status: 'SUCCESSFUL' });

      const recipientCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(recipientCall[0]).toBe('https://api.paystack.co/transferrecipient');
      expect(JSON.parse(recipientCall[1].body)).toEqual({
        type: 'nuban',
        name: 'Ada Lovelace',
        account_number: '0123456789',
        bank_code: '044',
        currency: 'NGN',
      });

      const transferCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(transferCall[0]).toBe('https://api.paystack.co/transfer');
      expect(JSON.parse(transferCall[1].body)).toEqual({
        source: 'balance',
        amount: 500000, // 5000 major-unit -> 500000 kobo
        recipient: 'RCP_abc',
        reference: 'txn-ref-001',
        reason: 'Vendor payment',
      });
    });

    it('falls back to the account number as recipient name when recipientName is omitted', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: true, message: 'ok', data: { recipient_code: 'RCP_abc' } }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: true, message: 'ok', data: { transfer_code: 'TRF_xyz', reference: 'r', status: 'pending', amount: 100 } }),
        }) as any;

      const { recipientName, ...withoutName } = params;
      await provider.initiateTransfer(withoutName);

      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).name).toBe('0123456789');
    });

    it('throws and does NOT attempt the transfer call when recipient creation fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ status: false, message: 'Invalid account number' }) }) as any;

      await expect(provider.initiateTransfer(params)).rejects.toThrow('Invalid account number');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws when the transfer call itself fails after a successful recipient creation', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: true, message: 'ok', data: { recipient_code: 'RCP_abc' } }) })
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ status: false, message: 'Insufficient balance' }) }) as any;

      await expect(provider.initiateTransfer(params)).rejects.toThrow('Insufficient balance');
    });
  });

  describe('verifyTransfer', () => {
    it('maps a successful transfer, including completedAt', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'ok', data: { transfer_code: 'TRF_xyz', reference: 'txn-ref-001', status: 'success', amount: 500000 } }),
      }) as any;

      const result = await provider.verifyTransfer('txn-ref-001');

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.providerTransferId).toBe('TRF_xyz');
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.failureReason).toBeUndefined();
    });

    it('maps a failed transfer, including failureReason', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: true, message: 'Transfer failed at bank', data: { transfer_code: 'TRF_xyz', reference: 'r', status: 'failed', amount: 100 } }),
      }) as any;

      const result = await provider.verifyTransfer('r');

      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('Transfer failed at bank');
      expect(result.completedAt).toBeUndefined();
    });

    it('throws a clear error when Paystack rejects the verify request', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ status: false, message: 'Transfer not found' }) }) as any;
      await expect(provider.verifyTransfer('unknown-ref')).rejects.toThrow('Transfer not found');
    });
  });

  describe('mapPaystackTransferStatus', () => {
    it('maps every known Paystack transfer status', () => {
      expect(mapPaystackTransferStatus('success')).toBe('SUCCESSFUL');
      expect(mapPaystackTransferStatus('failed')).toBe('FAILED');
      expect(mapPaystackTransferStatus('reversed')).toBe('REVERSED');
      expect(mapPaystackTransferStatus('pending')).toBe('PENDING');
      expect(mapPaystackTransferStatus('otp')).toBe('PENDING');
      expect(mapPaystackTransferStatus('some-future-status')).toBe('PENDING');
    });
  });
});
