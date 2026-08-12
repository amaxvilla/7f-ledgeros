import { MonoProvider, MONO_PROVIDER_CODE } from '../providers/mono.provider';
import { BankProviderRegistry } from '../bank-provider.registry';

describe('MonoProvider', () => {
  let integrations: { getDecryptedCredentials: jest.Mock };
  let prisma: { monoLinkedAccount: { findMany: jest.Mock } };
  let registry: BankProviderRegistry;
  let provider: MonoProvider;

  beforeEach(() => {
    integrations = { getDecryptedCredentials: jest.fn().mockResolvedValue({ secretKey: 'live_sk_abc123' }) };
    prisma = { monoLinkedAccount: { findMany: jest.fn() } };
    registry = new BankProviderRegistry();
    provider = new MonoProvider(integrations as any, registry, prisma as any);
    process.env.BANK_MONO_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.BANK_MONO_PROVIDER_ID;
  });

  describe('onModuleInit', () => {
    it('registers itself into BankProviderRegistry under "MONO"', () => {
      expect(registry.isRegistered(MONO_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(MONO_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MONO_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('getConfig', () => {
    it('throws a clear setup error when BANK_MONO_PROVIDER_ID is not set', async () => {
      delete process.env.BANK_MONO_PROVIDER_ID;
      await expect(provider.getConfig()).rejects.toThrow('BANK_MONO_PROVIDER_ID');
    });

    it('throws when the resolved credentials are missing secretKey', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getConfig()).rejects.toThrow('credentials.secretKey');
    });

    it('resolves the secret key from IntegrationsService', async () => {
      const config = await provider.getConfig();
      expect(config).toEqual({ secretKey: 'live_sk_abc123' });
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledWith('provider-1');
    });

    it('resolves only once per instance (cached), not once per call', async () => {
      await provider.getConfig();
      await provider.getConfig();
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });

  // Checkpoint F re-scoped validateAccount to mean "is this accountNumber
  // linked via an ACTIVE MonoLinkedAccount" rather than a NIBSS-style
  // arbitrary lookup — see MonoProvider.validateAccount's own doc
  // comment. Deliberately non-throwing on 0-or-many matches (unlike
  // resolveActiveLinkedAccount below, used by fetchStatement/
  // fetchBalance) — both collapse to { valid: false }.
  describe('validateAccount (Checkpoint F)', () => {
    it('returns valid:true with the linked BankAccount\'s accountName when exactly one active link matches', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { monoAccountId: 'acc_xyz789', bankAccount: { accountNumber: '0123456789', accountName: 'Acme Property Holdings' } },
      ]);

      const result = await provider.validateAccount({ accountNumber: '0123456789', bankCode: '044' });

      expect(result).toEqual({ valid: true, accountName: 'Acme Property Holdings' });
    });

    it('returns valid:false when no active linked account matches (not an error)', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([]);
      const result = await provider.validateAccount({ accountNumber: '0123456789', bankCode: '044' });
      expect(result).toEqual({ valid: false });
    });

    it('returns valid:false (not an ambiguous-match error) when more than one active link matches', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { monoAccountId: 'acc_1', bankAccount: { accountNumber: '0123456789', accountName: 'Entity A' } },
        { monoAccountId: 'acc_2', bankAccount: { accountNumber: '0123456789', accountName: 'Entity B' } },
      ]);
      const result = await provider.validateAccount({ accountNumber: '0123456789', bankCode: '044' });
      expect(result).toEqual({ valid: false });
    });
  });

  describe('resolveActiveLinkedAccount (Checkpoint D, exercised via fetchBalance/fetchStatement)', () => {
    it('fetchBalance throws a clear error when no active linked account matches', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([]);
      await expect(provider.fetchBalance({ accountNumber: '0123456789', bankCode: '044' })).rejects.toThrow('No active Mono-linked account');
    });

    it('fetchBalance throws a clear error when the accountNumber matches more than one active linked account', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { monoAccountId: 'acc_1', currency: 'NGN', bankAccount: { accountNumber: '0123456789' } },
        { monoAccountId: 'acc_2', currency: 'NGN', bankAccount: { accountNumber: '0123456789' } },
      ]);
      await expect(provider.fetchBalance({ accountNumber: '0123456789', bankCode: '044' })).rejects.toThrow('Ambiguous Mono-linked account');
    });
  });

  describe('fetchBalance (Checkpoint D)', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { monoAccountId: 'acc_xyz789', currency: 'NGN', bankAccount: { accountNumber: '0123456789' } },
      ]);
    });

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('fetches the linked account balance and converts kobo to major-unit naira', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ balance: 1500050, currency: 'NGN' }),
      }) as any;

      const result = await provider.fetchBalance({ accountNumber: '0123456789', bankCode: '044' });

      expect(result.balance).toBe(15000.5);
      expect(result.currency).toBe('NGN');
      expect(result.asOf).toBeInstanceOf(Date);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/accounts/acc_xyz789/balance'),
        expect.objectContaining({ headers: { 'mono-sec-key': 'live_sk_abc123' } }),
      );
    });

    it('throws when Mono rejects the balance request', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' }) as any;
      await expect(provider.fetchBalance({ accountNumber: '0123456789', bankCode: '044' })).rejects.toThrow('HTTP 500');
    });
  });

  describe('fetchStatement (Checkpoint D)', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { monoAccountId: 'acc_xyz789', currency: 'NGN', bankAccount: { accountNumber: '0123456789' } },
      ]);
    });

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('maps Mono transactions into signed, major-unit BankStatementLines', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { _id: 'txn_1', narration: 'Salary payment', amount: 50000000, type: 'credit', balance: 60000000, date: '2026-01-05' },
            { _id: 'txn_2', narration: 'POS withdrawal', amount: 500000, type: 'debit', balance: 59500000, date: '2026-01-06' },
          ],
        }),
      }) as any;

      const result = await provider.fetchStatement({ accountNumber: '0123456789', bankCode: '044', fromDate: '2026-01-01', toDate: '2026-01-31' });

      expect(result).toEqual([
        { transactionDate: new Date('2026-01-05'), description: 'Salary payment', reference: 'txn_1', amount: 500000, balanceAfter: 600000 },
        { transactionDate: new Date('2026-01-06'), description: 'POS withdrawal', reference: 'txn_2', amount: -5000, balanceAfter: 595000 },
      ]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/accounts\/acc_xyz789\/transactions\?.*start=2026-01-01.*end=2026-01-31.*paginate=false/),
        expect.objectContaining({ headers: { 'mono-sec-key': 'live_sk_abc123' } }),
      );
    });

    it('returns an empty array when Mono reports no transactions in range', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }) as any;
      const result = await provider.fetchStatement({ accountNumber: '0123456789', bankCode: '044', fromDate: '2026-01-01', toDate: '2026-01-31' });
      expect(result).toEqual([]);
    });

    it('throws when Mono rejects the statement request', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' }) as any;
      await expect(
        provider.fetchStatement({ accountNumber: '0123456789', bankCode: '044', fromDate: '2026-01-01', toDate: '2026-01-31' }),
      ).rejects.toThrow('HTTP 403');
    });
  });

  describe('exchangeConnectCode (Checkpoint C)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('exchanges a Connect code for a Mono account id', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'acc_xyz789' }),
      }) as any;

      const result = await provider.exchangeConnectCode('connect-code-abc');

      expect(result).toEqual({ monoAccountId: 'acc_xyz789' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/account/auth'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'mono-sec-key': 'live_sk_abc123', 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'connect-code-abc' }),
        }),
      );
    });

    it('throws when Mono rejects the code exchange', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid or expired code',
      }) as any;

      await expect(provider.exchangeConnectCode('bad-code')).rejects.toThrow('HTTP 400');
    });

    it('throws when Mono returns no account id', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }) as any;

      await expect(provider.exchangeConnectCode('connect-code-abc')).rejects.toThrow('no account id');
    });
  });

  describe('fetchAccountMeta (Checkpoint C)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it('returns institution name, masked account number, and currency', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          account: { institution: { name: 'GTBank' }, accountNumber: '0123456789', currency: 'NGN' },
        }),
      }) as any;

      const result = await provider.fetchAccountMeta('acc_xyz789');

      expect(result).toEqual({ institutionName: 'GTBank', accountNumberMasked: '****6789', currency: 'NGN' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/accounts/acc_xyz789'),
        expect.objectContaining({ headers: { 'mono-sec-key': 'live_sk_abc123' } }),
      );
    });

    it('throws when Mono rejects the lookup', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as any;
      await expect(provider.fetchAccountMeta('acc_missing')).rejects.toThrow('HTTP 404');
    });
  });
});
