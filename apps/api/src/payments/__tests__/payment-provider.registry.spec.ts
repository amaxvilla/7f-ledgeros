import { PaymentProviderRegistry } from '../payment-provider.registry';
import { PaymentProvider } from '../payment-provider.interface';

function fakeProvider(): PaymentProvider {
  return {
    initializePayment: jest.fn(),
    verifyPayment: jest.fn(),
    refundPayment: jest.fn(),
    verifyRefund: jest.fn(),
  };
}

describe('PaymentProviderRegistry', () => {
  let registry: PaymentProviderRegistry;

  beforeEach(() => {
    registry = new PaymentProviderRegistry();
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

    expect(() => registry.get('STRIPE')).toThrow(/No payment provider registered for providerCode "STRIPE"/);
    expect(() => registry.get('STRIPE')).toThrow(/PAYSTACK/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('STRIPE')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('PAYSTACK', first);
    registry.register('PAYSTACK', second);

    expect(registry.get('PAYSTACK')).toBe(second);
    expect(registry.list()).toEqual(['PAYSTACK']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('PAYSTACK', fakeProvider());
    registry.register('FLUTTERWAVE', fakeProvider());

    expect(registry.list().sort()).toEqual(['FLUTTERWAVE', 'PAYSTACK']);
  });
});
