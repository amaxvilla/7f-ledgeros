import { PowerBiProviderRegistry } from '../power-bi-provider.registry';
import { PowerBiProvider } from '../power-bi-provider.interface';

function fakeProvider(): PowerBiProvider {
  return {
    publishDataset: jest.fn(),
    pushRows: jest.fn(),
    triggerRefresh: jest.fn(),
    getRefreshStatus: jest.fn(),
    getEmbedConfig: jest.fn(),
  };
}

describe('PowerBiProviderRegistry', () => {
  let registry: PowerBiProviderRegistry;

  beforeEach(() => {
    registry = new PowerBiProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('POWER_BI')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('POWER_BI', provider);

    expect(registry.isRegistered('POWER_BI')).toBe(true);
    expect(registry.get('POWER_BI')).toBe(provider);
    expect(registry.list()).toEqual(['POWER_BI']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('POWER_BI', fakeProvider());

    expect(() => registry.get('LOOKER')).toThrow(/No Power BI provider registered for providerCode "LOOKER"/);
    expect(() => registry.get('LOOKER')).toThrow(/POWER_BI/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('POWER_BI')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('POWER_BI', first);
    registry.register('POWER_BI', second);

    expect(registry.get('POWER_BI')).toBe(second);
    expect(registry.list()).toEqual(['POWER_BI']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('POWER_BI', fakeProvider());
    registry.register('LOOKER', fakeProvider());

    expect(registry.list().sort()).toEqual(['LOOKER', 'POWER_BI']);
  });
});
