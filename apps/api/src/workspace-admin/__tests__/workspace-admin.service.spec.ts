import { WorkspaceAdminService } from '../workspace-admin.service';

describe('WorkspaceAdminService', () => {
  let registry: { get: jest.Mock };
  let provider: { createUser: jest.Mock; setUserSuspended: jest.Mock; deleteUser: jest.Mock; listUsers: jest.Mock };
  let service: WorkspaceAdminService;

  beforeEach(() => {
    provider = {
      createUser: jest.fn().mockResolvedValue({ providerUserId: 'u1' }),
      setUserSuspended: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      listUsers: jest.fn().mockResolvedValue([{ providerUserId: 'u1', primaryEmail: 'a@example.com', fullName: 'Ada Okoye', suspended: false }]),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new WorkspaceAdminService(registry as any);
  });

  describe('createUser', () => {
    it('resolves the provider by providerCode and forwards the rest of the params', async () => {
      const result = await service.createUser({
        providerCode: 'GOOGLE_WORKSPACE_ADMIN',
        primaryEmail: 'ada@example.com',
        givenName: 'Ada',
        familyName: 'Okoye',
        password: 'TempPass!23',
        orgUnitPath: '/Engineering',
      });

      expect(registry.get).toHaveBeenCalledWith('GOOGLE_WORKSPACE_ADMIN');
      expect(provider.createUser).toHaveBeenCalledWith({
        primaryEmail: 'ada@example.com',
        givenName: 'Ada',
        familyName: 'Okoye',
        password: 'TempPass!23',
        orgUnitPath: '/Engineering',
      });
      expect(result).toEqual({ providerUserId: 'u1' });
    });
  });

  describe('setUserSuspended', () => {
    it('passes providerUserId alongside the suspended flag', async () => {
      await service.setUserSuspended('u1', { providerCode: 'GOOGLE_WORKSPACE_ADMIN', suspended: true });

      expect(registry.get).toHaveBeenCalledWith('GOOGLE_WORKSPACE_ADMIN');
      expect(provider.setUserSuspended).toHaveBeenCalledWith({ providerUserId: 'u1', suspended: true });
    });

    it('supports un-suspending (suspended: false)', async () => {
      await service.setUserSuspended('u1', { providerCode: 'GOOGLE_WORKSPACE_ADMIN', suspended: false });
      expect(provider.setUserSuspended).toHaveBeenCalledWith({ providerUserId: 'u1', suspended: false });
    });
  });

  describe('deleteUser', () => {
    it('resolves the provider and forwards providerUserId', async () => {
      await service.deleteUser('u1', { providerCode: 'GOOGLE_WORKSPACE_ADMIN' });

      expect(registry.get).toHaveBeenCalledWith('GOOGLE_WORKSPACE_ADMIN');
      expect(provider.deleteUser).toHaveBeenCalledWith({ providerUserId: 'u1' });
    });
  });

  describe('listUsers', () => {
    it('forwards orgUnitPath and maxResults', async () => {
      const result = await service.listUsers('GOOGLE_WORKSPACE_ADMIN', '/Engineering', 50);

      expect(registry.get).toHaveBeenCalledWith('GOOGLE_WORKSPACE_ADMIN');
      expect(provider.listUsers).toHaveBeenCalledWith({ orgUnitPath: '/Engineering', maxResults: 50 });
      expect(result).toEqual([{ providerUserId: 'u1', primaryEmail: 'a@example.com', fullName: 'Ada Okoye', suspended: false }]);
    });

    it('works with no optional filters', async () => {
      await service.listUsers('GOOGLE_WORKSPACE_ADMIN');
      expect(provider.listUsers).toHaveBeenCalledWith({ orgUnitPath: undefined, maxResults: undefined });
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No workspace-admin provider registered for providerCode "ENTRA_ID"');
    });

    await expect(
      service.createUser({ providerCode: 'ENTRA_ID', primaryEmail: 'x@example.com', givenName: 'X', familyName: 'Y', password: 'p' }),
    ).rejects.toThrow('No workspace-admin provider registered for providerCode "ENTRA_ID"');
  });
});
