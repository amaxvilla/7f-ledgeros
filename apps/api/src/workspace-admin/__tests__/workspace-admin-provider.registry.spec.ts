import { WorkspaceAdminProviderRegistry } from '../workspace-admin-provider.registry';
import { WorkspaceAdminProvider } from '../workspace-admin-provider.interface';

function fakeProvider(): WorkspaceAdminProvider {
  return {
    createUser: jest.fn(),
    setUserSuspended: jest.fn(),
    deleteUser: jest.fn(),
    listUsers: jest.fn(),
  };
}

describe('WorkspaceAdminProviderRegistry', () => {
  let registry: WorkspaceAdminProviderRegistry;

  beforeEach(() => {
    registry = new WorkspaceAdminProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('GOOGLE_WORKSPACE')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('GOOGLE_WORKSPACE', provider);

    expect(registry.isRegistered('GOOGLE_WORKSPACE')).toBe(true);
    expect(registry.get('GOOGLE_WORKSPACE')).toBe(provider);
    expect(registry.list()).toEqual(['GOOGLE_WORKSPACE']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('GOOGLE_WORKSPACE', fakeProvider());

    expect(() => registry.get('ENTRA_ID')).toThrow(/No workspace admin provider registered for providerCode "ENTRA_ID"/);
    expect(() => registry.get('ENTRA_ID')).toThrow(/GOOGLE_WORKSPACE/);
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('ENTRA_ID')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('GOOGLE_WORKSPACE', first);
    registry.register('GOOGLE_WORKSPACE', second);

    expect(registry.get('GOOGLE_WORKSPACE')).toBe(second);
    expect(registry.list()).toEqual(['GOOGLE_WORKSPACE']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('GOOGLE_WORKSPACE', fakeProvider());
    registry.register('ENTRA_ID', fakeProvider());

    expect(registry.list().sort()).toEqual(['ENTRA_ID', 'GOOGLE_WORKSPACE']);
  });
});
