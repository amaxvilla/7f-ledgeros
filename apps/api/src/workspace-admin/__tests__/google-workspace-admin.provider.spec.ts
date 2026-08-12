import { generateKeyPairSync } from 'crypto';
import { Test } from '@nestjs/testing';
import { GoogleWorkspaceAdminProvider, GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE } from '../providers/google-workspace-admin.provider';
import { WorkspaceAdminProviderRegistry } from '../workspace-admin-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'workspace-token-xyz', expires_in: 3600 }) };
}

describe('GoogleWorkspaceAdminProvider', () => {
  let provider: GoogleWorkspaceAdminProvider;
  let registry: WorkspaceAdminProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'GOOGLE_WORKSPACE_ADMIN',
    isActive: true,
    config: { impersonatedAdminEmail: 'admin@example.com' },
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, WORKSPACE_ADMIN_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientEmail: 'svc@my-project.iam.gserviceaccount.com', privateKey }),
    };
    registry = new WorkspaceAdminProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleWorkspaceAdminProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: WorkspaceAdminProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(GoogleWorkspaceAdminProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into WorkspaceAdminProviderRegistry under "GOOGLE_WORKSPACE_ADMIN"', () => {
      expect(registry.isRegistered(GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE)).toBe(true);
      expect(registry.get(GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('createUser', () => {
    const params = { primaryEmail: 'new.hire@example.com', givenName: 'New', familyName: 'Hire', password: 'temp-pw-123', orgUnitPath: '/Engineering' };

    it('POSTs to users.insert with the expected body and returns the Directory API id', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'directory-id-1' }) });

      const result = await provider.createUser(params);

      expect(result).toEqual({ providerUserId: 'directory-id-1' });
      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://admin.googleapis.com/admin/directory/v1/users');
      expect(createCall[1].method).toBe('POST');
      const body = JSON.parse(createCall[1].body);
      expect(body.primaryEmail).toBe('new.hire@example.com');
      expect(body.name).toEqual({ givenName: 'New', familyName: 'Hire' });
      expect(body.password).toBe('temp-pw-123');
      expect(body.changePasswordAtNextLogin).toBe(true);
      expect(body.orgUnitPath).toBe('/Engineering');
    });

    it('defaults orgUnitPath to "/" when not given', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'directory-id-1' }) });
      await provider.createUser({ ...params, orgUnitPath: undefined });
      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.orgUnitPath).toBe('/');
    });

    it('throws a descriptive error when Google rejects the request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { message: 'Entity already exists' } }) });

      await expect(provider.createUser(params)).rejects.toThrow('Entity already exists');
    });

    it('throws when the response has no id', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await expect(provider.createUser(params)).rejects.toThrow('returned no id');
    });
  });

  describe('setUserSuspended', () => {
    it('PATCHes the suspended flag for the given providerUserId', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.setUserSuspended({ providerUserId: 'directory-id-1', suspended: true });

      const patchCall = fetchMock.mock.calls[1];
      expect(patchCall[0]).toBe('https://admin.googleapis.com/admin/directory/v1/users/directory-id-1');
      expect(patchCall[1].method).toBe('PATCH');
      expect(JSON.parse(patchCall[1].body)).toEqual({ suspended: true });
    });

    it('throws a descriptive error on failure', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Not found' } }) });
      await expect(provider.setUserSuspended({ providerUserId: 'x', suspended: false })).rejects.toThrow('Not found');
    });
  });

  describe('deleteUser', () => {
    it('DELETEs the given providerUserId', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.deleteUser({ providerUserId: 'directory-id-1' });

      const deleteCall = fetchMock.mock.calls[1];
      expect(deleteCall[0]).toBe('https://admin.googleapis.com/admin/directory/v1/users/directory-id-1');
      expect(deleteCall[1].method).toBe('DELETE');
    });
  });

  describe('listUsers', () => {
    it('lists users for the customer, mapping fields into DirectoryUserSummary', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [
            { id: 'u1', primaryEmail: 'a@example.com', name: { fullName: 'A One' }, suspended: false },
            { id: 'u2', primaryEmail: 'b@example.com', suspended: true },
          ],
        }),
      });

      const result = await provider.listUsers({});

      expect(result).toEqual([
        { providerUserId: 'u1', primaryEmail: 'a@example.com', fullName: 'A One', suspended: false },
        { providerUserId: 'u2', primaryEmail: 'b@example.com', fullName: 'b@example.com', suspended: true },
      ]);
      const listCall = fetchMock.mock.calls[1];
      expect(listCall[0]).toContain('customer=my_customer');
    });

    it('includes orgUnitPath and maxResults in the query when given', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) });

      await provider.listUsers({ orgUnitPath: '/Engineering', maxResults: 25 });

      const listCall = fetchMock.mock.calls[1][0] as string;
      expect(decodeURIComponent(listCall)).toContain("query=orgUnitPath='/Engineering'");
      expect(listCall).toContain('maxResults=25');
    });
  });

  describe('resolveConfig', () => {
    it('throws when WORKSPACE_ADMIN_PROVIDER_ID is not set', async () => {
      delete process.env.WORKSPACE_ADMIN_PROVIDER_ID;
      await expect(provider.listUsers({})).rejects.toThrow('WORKSPACE_ADMIN_PROVIDER_ID is not set');
    });

    it('throws when the resolved provider has an unexpected providerCode', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'GOOGLE_DRIVE' });
      await expect(provider.listUsers({})).rejects.toThrow('expected "GOOGLE_WORKSPACE_ADMIN"');
    });

    it('throws when the resolved provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.listUsers({})).rejects.toThrow('is not active');
    });

    it('throws when config.impersonatedAdminEmail is missing', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: {} });
      await expect(provider.listUsers({})).rejects.toThrow('config.impersonatedAdminEmail');
    });

    it('throws when credentials are missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.listUsers({})).rejects.toThrow('credentials.clientEmail, credentials.privateKey');
    });

    it('caches the resolved config across multiple calls', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) })
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) });

      await provider.listUsers({});
      await provider.listUsers({});

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });
});
