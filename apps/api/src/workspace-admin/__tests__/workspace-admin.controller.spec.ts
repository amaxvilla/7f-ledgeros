import { WorkspaceAdminController } from '../workspace-admin.controller';

describe('WorkspaceAdminController', () => {
  let workspaceAdmin: { createUser: jest.Mock; setUserSuspended: jest.Mock; deleteUser: jest.Mock; listUsers: jest.Mock };
  let controller: WorkspaceAdminController;

  beforeEach(() => {
    workspaceAdmin = {
      createUser: jest.fn().mockResolvedValue({ providerUserId: 'u1' }),
      setUserSuspended: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      listUsers: jest.fn().mockResolvedValue([]),
    };
    controller = new WorkspaceAdminController(workspaceAdmin as any);
  });

  it('create() delegates to WorkspaceAdminService.createUser', async () => {
    const dto = { providerCode: 'GOOGLE_WORKSPACE_ADMIN', primaryEmail: 'ada@example.com', givenName: 'Ada', familyName: 'Okoye', password: 'p' } as any;
    const result = await controller.create(dto);

    expect(workspaceAdmin.createUser).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ providerUserId: 'u1' });
  });

  it('suspend() delegates to WorkspaceAdminService.setUserSuspended with the path param', async () => {
    const dto = { providerCode: 'GOOGLE_WORKSPACE_ADMIN', suspended: true } as any;
    await controller.suspend('u1', dto);

    expect(workspaceAdmin.setUserSuspended).toHaveBeenCalledWith('u1', dto);
  });

  it('remove() delegates to WorkspaceAdminService.deleteUser with the path param', async () => {
    const dto = { providerCode: 'GOOGLE_WORKSPACE_ADMIN' } as any;
    await controller.remove('u1', dto);

    expect(workspaceAdmin.deleteUser).toHaveBeenCalledWith('u1', dto);
  });

  it('list() delegates to WorkspaceAdminService.listUsers, converting maxResults from string to number', async () => {
    await controller.list('GOOGLE_WORKSPACE_ADMIN', '/Engineering', '25');
    expect(workspaceAdmin.listUsers).toHaveBeenCalledWith('GOOGLE_WORKSPACE_ADMIN', '/Engineering', 25);
  });

  it('list() passes undefined maxResults through when not given', async () => {
    await controller.list('GOOGLE_WORKSPACE_ADMIN');
    expect(workspaceAdmin.listUsers).toHaveBeenCalledWith('GOOGLE_WORKSPACE_ADMIN', undefined, undefined);
  });
});
