import { SignatureProviderRegistry } from '../signature-provider.registry';
import { SignatureProvider } from '../signature-provider.interface';

function fakeProvider(): SignatureProvider {
  return {
    sendForSignature: jest.fn(),
    getStatus: jest.fn(),
    downloadSignedDocument: jest.fn(),
    voidEnvelope: jest.fn(),
  };
}

describe('SignatureProviderRegistry', () => {
  let registry: SignatureProviderRegistry;

  beforeEach(() => {
    registry = new SignatureProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('DOCUSIGN')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('DOCUSIGN', provider);

    expect(registry.isRegistered('DOCUSIGN')).toBe(true);
    expect(registry.get('DOCUSIGN')).toBe(provider);
    expect(registry.list()).toEqual(['DOCUSIGN']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('DOCUSIGN', fakeProvider());

    expect(() => registry.get('ADOBE_SIGN')).toThrow(/No signature provider registered for providerCode "ADOBE_SIGN"/);
    expect(() => registry.get('ADOBE_SIGN')).toThrow(/DOCUSIGN/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('DOCUSIGN')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('DOCUSIGN', first);
    registry.register('DOCUSIGN', second);

    expect(registry.get('DOCUSIGN')).toBe(second);
    expect(registry.list()).toEqual(['DOCUSIGN']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('DOCUSIGN', fakeProvider());
    registry.register('ADOBE_SIGN', fakeProvider());

    expect(registry.list().sort()).toEqual(['ADOBE_SIGN', 'DOCUSIGN']);
  });
});
