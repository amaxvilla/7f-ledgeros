import { ContactsController } from '../contacts.controller';

describe('ContactsController', () => {
  let contacts: { createContact: jest.Mock; updateContact: jest.Mock; deleteContact: jest.Mock };
  let controller: ContactsController;

  beforeEach(() => {
    contacts = {
      createContact: jest.fn().mockResolvedValue({ providerContactId: 'c1' }),
      updateContact: jest.fn().mockResolvedValue(undefined),
      deleteContact: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ContactsController(contacts as any);
  });

  it('create() delegates to ContactsService.createContact', async () => {
    const dto = { providerCode: 'MS_GRAPH', displayName: 'Ada Okoye' } as any;
    const result = await controller.create(dto);

    expect(contacts.createContact).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ providerContactId: 'c1' });
  });

  it('update() delegates to ContactsService.updateContact with the path param', async () => {
    const dto = { providerCode: 'MS_GRAPH', jobTitle: 'Sales Lead' } as any;
    await controller.update('c1', dto);

    expect(contacts.updateContact).toHaveBeenCalledWith('c1', dto);
  });

  it('remove() delegates to ContactsService.deleteContact with the path param', async () => {
    const dto = { providerCode: 'GOOGLE' } as any;
    await controller.remove('c1', dto);

    expect(contacts.deleteContact).toHaveBeenCalledWith('c1', dto);
  });
});
