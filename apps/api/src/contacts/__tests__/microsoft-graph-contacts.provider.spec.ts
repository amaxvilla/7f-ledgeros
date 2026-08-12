import { Test } from '@nestjs/testing';
import { MicrosoftGraphContactsProvider, MS_GRAPH_CONTACTS_PROVIDER_CODE } from '../providers/microsoft-graph-contacts.provider';
import { ContactsProviderRegistry } from '../contacts-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'graph-token-xyz', expires_in: 3600 }) };
}

describe('MicrosoftGraphContactsProvider', () => {
  let provider: MicrosoftGraphContactsProvider;
  let registry: ContactsProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'MS_GRAPH_EMAIL',
    isActive: true,
    config: { tenantId: 'tenant-1', clientId: 'client-1', senderUserId: 'sender@example.com' },
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, EMAIL_SMTP_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh' }),
    };
    registry = new ContactsProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MicrosoftGraphContactsProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: ContactsProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(MicrosoftGraphContactsProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into ContactsProviderRegistry under "MS_GRAPH"', () => {
      expect(registry.isRegistered(MS_GRAPH_CONTACTS_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(MS_GRAPH_CONTACTS_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MS_GRAPH_CONTACTS_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('createContact', () => {
    const params = {
      displayName: 'Jane Doe',
      emailAddress: 'jane.doe@example.com',
      phoneNumber: '+2348012345678',
      companyName: 'Acme Corp',
      jobTitle: 'Recruiter',
    };

    it('acquires a token then creates the contact, mapping the Graph response', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'AAMk-contact-1' }) });

      const result = await provider.createContact(params);

      expect(result).toEqual({ providerContactId: 'AAMk-contact-1' });

      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/contacts');
      expect(createCall[1].method).toBe('POST');
      const body = JSON.parse(createCall[1].body);
      expect(body).toEqual({
        displayName: 'Jane Doe',
        emailAddresses: [{ address: 'jane.doe@example.com' }],
        mobilePhone: '+2348012345678',
        companyName: 'Acme Corp',
        jobTitle: 'Recruiter',
      });
    });

    it('caches the resolved config across multiple calls (resolveConfig runs once)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'c1' }) })
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'c2' }) });

      await provider.createContact(params);
      await provider.createContact(params);

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });

    it('throws a clear error when Graph rejects the create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient privileges' } }) });

      await expect(provider.createContact(params)).rejects.toThrow('Insufficient privileges');
    });

    it('throws when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.createContact(params)).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID is not set');
    });

    it('throws when the configured provider is not providerCode MS_GRAPH_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'SMTP' });
      await expect(provider.createContact(params)).rejects.toThrow('expected "MS_GRAPH_EMAIL"');
    });

    it('throws when the configured provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.createContact(params)).rejects.toThrow('is not active');
    });

    it('throws listing every missing config key at once', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { tenantId: 'tenant-1' } });
      await expect(provider.createContact(params)).rejects.toThrow(/config\.clientId.*config\.senderUserId/s);
    });

    it('throws when credentials.clientSecret is missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.createContact(params)).rejects.toThrow('clientSecret');
    });
  });

  describe('updateContact', () => {
    it('PATCHes only the fields provided', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.updateContact({ providerContactId: 'AAMk-contact-1', jobTitle: 'Senior Recruiter' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/contacts/AAMk-contact-1');
      expect(call[1].method).toBe('PATCH');
      expect(JSON.parse(call[1].body)).toEqual({ jobTitle: 'Senior Recruiter' });
    });

    it('throws a clear error when Graph rejects the update', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Contact not found' } }) });

      await expect(provider.updateContact({ providerContactId: 'missing', displayName: 'x' })).rejects.toThrow('Contact not found');
    });
  });

  describe('deleteContact', () => {
    it('DELETEs the contact', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

      await provider.deleteContact({ providerContactId: 'AAMk-contact-1' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/contacts/AAMk-contact-1');
      expect(call[1].method).toBe('DELETE');
    });

    it('treats a 404 as already-deleted rather than an error (idempotent delete)', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'not found' } }) });

      await expect(provider.deleteContact({ providerContactId: 'already-gone' })).resolves.toBeUndefined();
    });

    it('throws a clear error for any other non-OK status', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient privileges' } }) });

      await expect(provider.deleteContact({ providerContactId: 'AAMk-contact-1' })).rejects.toThrow('Insufficient privileges');
    });
  });
});
