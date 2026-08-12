import { BankProviderRegistry } from '../bank-provider.registry';
import { BankProvider } from '../bank-provider.interface';

function fakeProvider(): BankProvider {
  return {
    validateAccount: jest.fn(),
    fetchStatement: jest.fn(),
    fetchBalance: jest.fn(),
  };
}

describe('BankProviderRegistry', () => {
  let registry: BankProviderRegistry;

  beforeEach(() => {
    registry = new BankProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('MONO')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('MONO', provider);

    expect(registry.isRegistered('MONO')).toBe(true);
    expect(registry.get('MONO')).toBe(provider);
    expect(registry.list()).toEqual(['MONO']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('MONO', fakeProvider());

    expect(() => registry.get('OKRA')).toThrow(/No bank provider registered for providerCode "OKRA"/);
    expect(() => registry.get('OKRA')).toThrow(/MONO/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('OKRA')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('MONO', first);
    registry.register('MONO', second);

    expect(registry.get('MONO')).toBe(second);
    expect(registry.list()).toEqual(['MONO']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('MONO', fakeProvider());
    registry.register('OKRA', fakeProvider());

    expect(registry.list().sort()).toEqual(['MONO', 'OKRA']);
  });
});
