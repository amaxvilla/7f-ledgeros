import { PaystackBankProvider, PAYSTACK_BANK_PROVIDER_CODE } from '../providers/paystack-bank.provider';
import { IntegrationsService } from '../../integrations/integrations.service';
import { BankProviderRegistry } from '../bank-provider.registry';

describe('PaystackBankProvider', () => {
  let provider: PaystackBankProvider;
  let integrations: { getDecryptedCredentials: jest.Mock };
  let registry: BankProviderRegistry;
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn() };
    registry = new BankProviderRegistry();
    provider = new PaystackBankProvider(integrations as unknown as IntegrationsService, registry);
    process.env = { ...originalEnv, PAYMENT_PAYSTACK_PROVIDER_ID: 'prov-1' };
    integrations.getDecryptedCredentials.mockResolvedValue({ secretKey: 'sk_test_xxx' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('registers itself into BankProviderRegistry under "PAYSTACK" on module init', () => {
    expect(registry.isRegistered(PAYSTACK_BANK_PROVIDER_CODE)).toBe(false);
    provider.onModuleInit();
    expect(registry.isRegistered(PAYSTACK_BANK_PROVIDER_CODE)).toBe(true);
    expect(registry.get(PAYSTACK_BANK_PROVIDER_CODE)).toBe(provider);
  });

  it('throws immediately when PAYMENT_PAYSTACK_PROVIDER_ID is not set', async () => {
    delete process.env.PAYMENT_PAYSTACK_PROVIDER_ID;
    provider = new PaystackBankProvider(integrations as unknown as IntegrationsService, registry);

    await expect(provider.validateAccount({ accountNumber: '0123456789', bankCode: '058' })).rejects.toThrow(
      'PAYMENT_PAYSTACK_PROVIDER_ID is not set',
    );
  });

  it('validateAccount returns valid:true with the resolved account name on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { account_name: 'JOHN A DOE' } }),
    });

    const result = await provider.validateAccount({ accountNumber: '0123456789', bankCode: '058' });

    expect(result).toEqual({ valid: true, accountName: 'JOHN A DOE' });
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.paystack.co/bank/resolve?account_number=0123456789&bank_code=058');
    expect(options.headers.Authorization).toBe('Bearer sk_test_xxx');
  });

  it('validateAccount returns valid:false (not an exception) for an unresolvable account/bank pair', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ status: false, message: 'Could not resolve account name' }),
    });

    const result = await provider.validateAccount({ accountNumber: '0000000000', bankCode: '058' });

    expect(result).toEqual({ valid: false });
  });

  it('fetchStatement throws a clear not-supported error naming Mono as the alternative', async () => {
    await expect(async () => provider.fetchStatement({ accountNumber: '0123456789', bankCode: '058', fromDate: '2026-01-01', toDate: '2026-01-31' })).rejects.toThrow(
      /does not support fetchStatement.*MonoProvider/s,
    );
  });

  it('fetchBalance throws a clear not-supported error naming Mono as the alternative', async () => {
    await expect(provider.fetchBalance({ accountNumber: '0123456789', bankCode: '058' })).rejects.toThrow(
      /does not support fetchBalance.*MonoProvider/s,
    );
  });

  it('resolves the secret key only once across multiple calls (cached)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: { account_name: 'A' } }) });

    await provider.validateAccount({ accountNumber: '111', bankCode: '058' });
    await provider.validateAccount({ accountNumber: '222', bankCode: '058' });

    expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
  });
});
