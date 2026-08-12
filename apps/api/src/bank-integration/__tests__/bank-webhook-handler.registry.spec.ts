import { BankWebhookHandlerRegistry } from '../bank-webhook-handler.registry';
import { BankWebhookHandler } from '../bank-webhook-handler.interface';

function fakeHandler(): BankWebhookHandler {
  return {
    verifySignature: jest.fn(),
    parseEvent: jest.fn(),
  };
}

describe('BankWebhookHandlerRegistry', () => {
  let registry: BankWebhookHandlerRegistry;

  beforeEach(() => {
    registry = new BankWebhookHandlerRegistry();
  });

  it('starts with no handlers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('MONO')).toBe(false);
  });

  it('registers and retrieves a handler by code', () => {
    const handler = fakeHandler();
    registry.register('MONO', handler);

    expect(registry.isRegistered('MONO')).toBe(true);
    expect(registry.get('MONO')).toBe(handler);
    expect(registry.list()).toEqual(['MONO']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('MONO', fakeHandler());

    expect(() => registry.get('OKRA')).toThrow(/No bank webhook handler registered for providerCode "OKRA"/);
    expect(() => registry.get('OKRA')).toThrow(/MONO/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('OKRA')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous handler (last registration wins)', () => {
    const first = fakeHandler();
    const second = fakeHandler();
    registry.register('MONO', first);
    registry.register('MONO', second);

    expect(registry.get('MONO')).toBe(second);
    expect(registry.list()).toEqual(['MONO']);
  });
});
