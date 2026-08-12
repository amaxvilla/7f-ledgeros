import { Test } from '@nestjs/testing';
import { GoogleContactsProvider, GOOGLE_CONTACTS_PROVIDER_CODE } from '../providers/google-contacts.provider';
import { ContactsProviderRegistry } from '../contacts-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'google-token-xyz', expires_in: 3600 }) };
}

describe('GoogleContactsProvider', () => {
  let provider: GoogleContactsProvider;
  let registry: ContactsProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'GMAIL_EMAIL',
    isActive: true,
    config: { clientId: 'client-1' },
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, EMAIL_SMTP_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh', refreshToken: 'refresh-1' }),
    };
    registry = new ContactsProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleContactsProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: ContactsProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(GoogleContactsProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into ContactsProviderRegistry under "GOOGLE_CONTACTS"', () => {
      expect(registry.isRegistered(GOOGLE_CONTACTS_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(GOOGLE_CONTACTS_PROVIDER_CODE)).toBe(true);
      expect(registry.get(GOOGLE_CONTACTS_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('createContact', () => {
    const params = { displayName: 'Jane Doe', emailAddress: 'jane@example.com', phoneNumber: '+2348000000000', companyName: 'Acme', jobTitle: 'CFO' };

    it('splits displayName into givenName/familyName and posts to people:createContact', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ resourceName: 'people/c123' }) });

      const result = await provider.createContact(params);

      expect(result).toEqual({ providerContactId: 'people/c123' });
      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://people.googleapis.com/v1/people:createContact');
      const body = JSON.parse(createCall[1].body);
      expect(body.names).toEqual([{ givenName: 'Jane', familyName: 'Doe' }]);
      expect(body.emailAddresses).toEqual([{ value: 'jane@example.com' }]);
      expect(body.organizations).toEqual([{ name: 'Acme', title: 'CFO' }]);
    });

    it('throws a descriptive error when Google rejects the request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient scope' } }) });

      await expect(provider.createContact(params)).rejects.toThrow('Insufficient scope');
    });
  });

  describe('updateContact', () => {
    it('fetches the current etag before PATCHing, and includes it in the body', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ etag: 'etag-abc' }) }) // GET for etag
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // PATCH

      await provider.updateContact({ providerContactId: 'people/c123', displayName: 'Jane Smith' });

      const getCall = fetchMock.mock.calls[1];
      expect(getCall[0]).toBe('https://people.googleapis.com/v1/people/c123?personFields=names,emailAddresses,phoneNumbers,organizations');

      const patchCall = fetchMock.mock.calls[2];
      expect(patchCall[0]).toContain('people/c123:updateContact?updatePersonFields=');
      expect(patchCall[1].method).toBe('PATCH');
      const body = JSON.parse(patchCall[1].body);
      expect(body.etag).toBe('etag-abc');
      expect(body.names).toEqual([{ givenName: 'Jane', familyName: 'Smith' }]);
    });

    it('throws when the etag lookup fails', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Not found' } }) });

      await expect(provider.updateContact({ providerContactId: 'people/gone', displayName: 'X' })).rejects.toThrow('Not found');
    });

    it('throws when the person resource has no etag at all', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await expect(provider.updateContact({ providerContactId: 'people/c123', displayName: 'X' })).rejects.toThrow('no etag');
    });
  });

  describe('deleteContact', () => {
    it('DELETEs the contact by resourceName', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.deleteContact({ providerContactId: 'people/c123' });

      const deleteCall = fetchMock.mock.calls[1];
      expect(deleteCall[0]).toBe('https://people.googleapis.com/v1/people/c123:deleteContact');
      expect(deleteCall[1].method).toBe('DELETE');
    });

    it('throws a descriptive error on failure', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { message: 'Server error' } }) });

      await expect(provider.deleteContact({ providerContactId: 'people/c123' })).rejects.toThrow('Server error');
    });
  });

  describe('resolveConfig', () => {
    it('throws a clear setup error when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.createContact({ displayName: 'X' })).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID');
    });

    it('throws when the resolved provider is not GMAIL_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'MS_GRAPH_EMAIL' });
      await expect(provider.createContact({ displayName: 'X' })).rejects.toThrow('expected "GMAIL_EMAIL"');
    });
  });
});
