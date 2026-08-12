import { PaymentWebhookHandlerRegistry } from '../payment-webhook-handler.registry';
import { PaymentWebhookHandler } from '../payment-webhook-handler.interface';

function fakeHandler(): PaymentWebhookHandler {
  return {
    verifySignature: jest.fn(),
    parseEvent: jest.fn(),
  };
}

describe('PaymentWebhookHandlerRegistry', () => {
  let registry: PaymentWebhookHandlerRegistry;

  beforeEach(() => {
    registry = new PaymentWebhookHandlerRegistry();
  });

  it('starts with no handlers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('PAYSTACK')).toBe(false);
  });

  it('registers and retrieves a handler by code', () => {
    const handler = fakeHandler();
    registry.register('PAYSTACK', handler);

    expect(registry.isRegistered('PAYSTACK')).toBe(true);
    expect(registry.get('PAYSTACK')).toBe(handler);
    expect(registry.list()).toEqual(['PAYSTACK']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('PAYSTACK', fakeHandler());

    expect(() => registry.get('STRIPE')).toThrow(/No payment webhook handler registered for providerCode "STRIPE"/);
    expect(() => registry.get('STRIPE')).toThrow(/PAYSTACK/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('STRIPE')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous handler (last registration wins)', () => {
    const first = fakeHandler();
    const second = fakeHandler();
    registry.register('PAYSTACK', first);
    registry.register('PAYSTACK', second);

    expect(registry.get('PAYSTACK')).toBe(second);
    expect(registry.list()).toEqual(['PAYSTACK']);
  });

  it('supports multiple handlers registered independently, and independently of PaymentProviderRegistry', () => {
    registry.register('PAYSTACK', fakeHandler());
    registry.register('FLUTTERWAVE', fakeHandler());

    expect(registry.list().sort()).toEqual(['FLUTTERWAVE', 'PAYSTACK']);
  });
});
