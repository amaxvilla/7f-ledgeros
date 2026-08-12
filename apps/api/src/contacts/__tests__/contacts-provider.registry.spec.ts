import { ContactsProviderRegistry } from '../contacts-provider.registry';
import { ContactsProvider } from '../contacts-provider.interface';

function fakeProvider(): ContactsProvider {
  return {
    createContact: jest.fn(),
    updateContact: jest.fn(),
    deleteContact: jest.fn(),
  };
}

describe('ContactsProviderRegistry', () => {
  let registry: ContactsProviderRegistry;

  beforeEach(() => {
    registry = new ContactsProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('MS_GRAPH')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('MS_GRAPH', provider);

    expect(registry.isRegistered('MS_GRAPH')).toBe(true);
    expect(registry.get('MS_GRAPH')).toBe(provider);
    expect(registry.list()).toEqual(['MS_GRAPH']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('MS_GRAPH', fakeProvider());

    expect(() => registry.get('GOOGLE_CONTACTS')).toThrow(/No contacts provider registered for providerCode "GOOGLE_CONTACTS"/);
    expect(() => registry.get('GOOGLE_CONTACTS')).toThrow(/MS_GRAPH/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('MS_GRAPH')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('MS_GRAPH', first);
    registry.register('MS_GRAPH', second);

    expect(registry.get('MS_GRAPH')).toBe(second);
    expect(registry.list()).toEqual(['MS_GRAPH']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('MS_GRAPH', fakeProvider());
    registry.register('GOOGLE_CONTACTS', fakeProvider());

    expect(registry.list().sort()).toEqual(['GOOGLE_CONTACTS', 'MS_GRAPH']);
  });
});
