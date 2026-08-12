import { BankAccountValidationController } from '../bank-account-validation.controller';

describe('BankAccountValidationController', () => {
  let controller: BankAccountValidationController;
  let bankProviders: { get: jest.Mock };
  let paystackProvider: { validateAccount: jest.Mock };

  beforeEach(() => {
    paystackProvider = { validateAccount: jest.fn() };
    bankProviders = { get: jest.fn().mockReturnValue(paystackProvider) };
    controller = new BankAccountValidationController(bankProviders as any);
  });

  it('defaults to the PAYSTACK provider when providerCode is omitted', async () => {
    paystackProvider.validateAccount.mockResolvedValue({ valid: true, accountName: 'Jane Doe' });

    const result = await controller.validateAccount({ accountNumber: '0123456789', bankCode: '058' });

    expect(bankProviders.get).toHaveBeenCalledWith('PAYSTACK');
    expect(paystackProvider.validateAccount).toHaveBeenCalledWith({ accountNumber: '0123456789', bankCode: '058' });
    expect(result).toEqual({ valid: true, accountName: 'Jane Doe' });
  });

  it('uses an explicitly requested providerCode instead of the default', async () => {
    const monoProvider = { validateAccount: jest.fn().mockResolvedValue({ valid: false }) };
    bankProviders.get.mockReturnValue(monoProvider);

    const result = await controller.validateAccount({ accountNumber: '0123456789', bankCode: '058', providerCode: 'MONO' });

    expect(bankProviders.get).toHaveBeenCalledWith('MONO');
    expect(result).toEqual({ valid: false });
  });

  it('propagates an unresolvable-account result (valid:false) rather than throwing', async () => {
    paystackProvider.validateAccount.mockResolvedValue({ valid: false });
    const result = await controller.validateAccount({ accountNumber: '0000000000', bankCode: '058' });
    expect(result).toEqual({ valid: false });
  });

  it('propagates a registry error for an unregistered providerCode', async () => {
    bankProviders.get.mockImplementation(() => {
      throw new Error('No bank provider registered for providerCode "UNKNOWN". Registered: MONO, PAYSTACK');
    });

    await expect(
      controller.validateAccount({ accountNumber: '0123456789', bankCode: '058', providerCode: 'UNKNOWN' }),
    ).rejects.toThrow('No bank provider registered');
  });
});
