import { TransferProviderRegistry } from '../transfer-provider.registry';
import { TransferProvider } from '../transfer-provider.interface';

function fakeProvider(): TransferProvider {
  return {
    initiateTransfer: jest.fn(),
    verifyTransfer: jest.fn(),
  };
}

describe('TransferProviderRegistry', () => {
  let registry: TransferProviderRegistry;

  beforeEach(() => {
    registry = new TransferProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('PAYSTACK')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('PAYSTACK', provider);

    expect(registry.isRegistered('PAYSTACK')).toBe(true);
    expect(registry.get('PAYSTACK')).toBe(provider);
    expect(registry.list()).toEqual(['PAYSTACK']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('PAYSTACK', fakeProvider());

    expect(() => registry.get('FLUTTERWAVE')).toThrow(/No transfer provider registered for providerCode "FLUTTERWAVE"/);
    expect(() => registry.get('FLUTTERWAVE')).toThrow(/PAYSTACK/);
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('FLUTTERWAVE')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('PAYSTACK', first);
    registry.register('PAYSTACK', second);

    expect(registry.get('PAYSTACK')).toBe(second);
    expect(registry.list()).toEqual(['PAYSTACK']);
  });

  it('supports multiple providers registered independently, by design (see PROVIDER CHOICE note)', () => {
    registry.register('PAYSTACK', fakeProvider());
    registry.register('FLUTTERWAVE', fakeProvider());

    expect(registry.list().sort()).toEqual(['FLUTTERWAVE', 'PAYSTACK']);
  });
});
