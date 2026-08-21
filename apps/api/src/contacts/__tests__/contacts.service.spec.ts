import { ContactsService } from '../contacts.service';

describe('ContactsService', () => {
  let registry: { get: jest.Mock };
  let provider: { createContact: jest.Mock; updateContact: jest.Mock; deleteContact: jest.Mock };
  let service: ContactsService;

  beforeEach(() => {
    provider = {
      createContact: jest.fn().mockResolvedValue({ providerContactId: 'c1' }),
      updateContact: jest.fn().mockResolvedValue(undefined),
      deleteContact: jest.fn().mockResolvedValue(undefined),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new ContactsService(registry as any);
  });

  describe('createContact', () => {
    it('resolves the provider by providerCode and forwards the rest of the params', async () => {
      const result = await service.createContact({
        providerCode: 'MS_GRAPH',
        displayName: 'Ada Okoye',
        emailAddress: 'ada@example.com',
        companyName: '7F Estates',
      });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.createContact).toHaveBeenCalledWith({
        displayName: 'Ada Okoye',
        emailAddress: 'ada@example.com',
        companyName: '7F Estates',
      });
      expect(result).toEqual({ providerContactId: 'c1' });
    });
  });

  describe('updateContact', () => {
    it('passes providerContactId alongside the rest of the params', async () => {
      await service.updateContact('c1', { providerCode: 'MS_GRAPH', jobTitle: 'Sales Lead' });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.updateContact).toHaveBeenCalledWith({ jobTitle: 'Sales Lead', providerContactId: 'c1' });
    });
  });

  describe('deleteContact', () => {
    it('resolves the provider and forwards providerContactId', async () => {
      await service.deleteContact('c1', { providerCode: 'GOOGLE' });

      expect(registry.get).toHaveBeenCalledWith('GOOGLE');
      expect(provider.deleteContact).toHaveBeenCalledWith({ providerContactId: 'c1' });
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No contacts provider registered for providerCode "SALESFORCE"');
    });

    await expect(async () => service.createContact({ providerCode: 'SALESFORCE', displayName: 'x' })).rejects.toThrow(
      'No contacts provider registered for providerCode "SALESFORCE"',
    );
  });
});
