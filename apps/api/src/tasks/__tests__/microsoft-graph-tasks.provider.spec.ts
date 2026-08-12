import { Test } from '@nestjs/testing';
import { MicrosoftGraphTasksProvider, MS_GRAPH_TASKS_PROVIDER_CODE } from '../providers/microsoft-graph-tasks.provider';
import { TasksProviderRegistry } from '../tasks-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'graph-token-xyz', expires_in: 3600 }) };
}

function listsResponse(lists: { id: string; wellknownListName?: string }[]) {
  return { ok: true, json: async () => ({ value: lists }) };
}

describe('MicrosoftGraphTasksProvider', () => {
  let provider: MicrosoftGraphTasksProvider;
  let registry: TasksProviderRegistry;
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
    registry = new TasksProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MicrosoftGraphTasksProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: TasksProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(MicrosoftGraphTasksProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into TasksProviderRegistry under "MS_GRAPH"', () => {
      expect(registry.isRegistered(MS_GRAPH_TASKS_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(MS_GRAPH_TASKS_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MS_GRAPH_TASKS_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('createTask', () => {
    const params = { title: 'Follow up with candidate', notes: 'Call back re: offer', dueDateTime: new Date('2026-08-05T12:00:00.000Z') };

    it('resolves the default list, then creates the task, mapping the Graph response', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(listsResponse([{ id: 'list-other' }, { id: 'list-default', wellknownListName: 'defaultList' }]))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'AAMk-task-1' }) });

      const result = await provider.createTask(params);

      expect(result).toEqual({ providerTaskId: 'AAMk-task-1' });

      const createCall = fetchMock.mock.calls[2];
      expect(createCall[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/todo/lists/list-default/tasks');
      expect(createCall[1].method).toBe('POST');
      expect(JSON.parse(createCall[1].body)).toEqual({
        title: 'Follow up with candidate',
        body: { content: 'Call back re: offer', contentType: 'text' },
        dueDateTime: { dateTime: '2026-08-05T12:00:00.000Z', timeZone: 'UTC' },
      });
    });

    it('falls back to the first list when no wellknownListName "defaultList" is present', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(listsResponse([{ id: 'list-only' }]))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'AAMk-task-1' }) });

      await provider.createTask(params);

      expect(fetchMock.mock.calls[2][0]).toContain('/todo/lists/list-only/tasks');
    });

    it('uses an explicitly-provided listId without resolving a default', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'AAMk-task-1' }) });

      await provider.createTask({ title: 'x', listId: 'list-explicit' });

      expect(fetchMock).toHaveBeenCalledTimes(2); // token + create — no list-lookup call
      expect(fetchMock.mock.calls[1][0]).toContain('/todo/lists/list-explicit/tasks');
    });

    it('caches the resolved default listId across multiple calls', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(listsResponse([{ id: 'list-default', wellknownListName: 'defaultList' }]))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-1' }) })
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-2' }) });

      await provider.createTask(params);
      await provider.createTask(params);

      // Only ONE list-lookup call total (3rd call onward has no listsResponse queued, so a second lookup would break the mock sequence and fail the test).
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it('caches the resolved config across multiple calls (resolveConfig runs once)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(listsResponse([{ id: 'list-default', wellknownListName: 'defaultList' }]))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-1' }) })
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'task-2' }) });

      await provider.createTask(params);
      await provider.createTask(params);

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });

    it('throws a clear error when Graph rejects the create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(listsResponse([{ id: 'list-default', wellknownListName: 'defaultList' }]))
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient privileges' } }) });

      await expect(provider.createTask(params)).rejects.toThrow('Insufficient privileges');
    });

    it('throws a clear error when the account has no task lists at all', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(listsResponse([]));

      await expect(provider.createTask(params)).rejects.toThrow('No task lists found');
    });

    it('throws when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.createTask(params)).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID is not set');
    });

    it('throws when the configured provider is not providerCode MS_GRAPH_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'SMTP' });
      await expect(provider.createTask(params)).rejects.toThrow('expected "MS_GRAPH_EMAIL"');
    });

    it('throws when the configured provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.createTask(params)).rejects.toThrow('is not active');
    });

    it('throws listing every missing config key at once', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { tenantId: 'tenant-1' } });
      await expect(provider.createTask(params)).rejects.toThrow(/config\.clientId.*config\.senderUserId/s);
    });

    it('throws when credentials.clientSecret is missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.createTask(params)).rejects.toThrow('clientSecret');
    });
  });

  describe('updateTask', () => {
    it('PATCHes only the fields provided, using an explicit listId when given', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.updateTask({ providerTaskId: 'AAMk-task-1', listId: 'list-explicit', completed: true });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/todo/lists/list-explicit/tasks/AAMk-task-1');
      expect(call[1].method).toBe('PATCH');
      expect(JSON.parse(call[1].body)).toEqual({ status: 'completed' });
    });

    it('maps completed:false to status "notStarted"', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.updateTask({ providerTaskId: 'AAMk-task-1', listId: 'list-explicit', completed: false });

      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ status: 'notStarted' });
    });

    it('resolves the default list when no listId is given', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(listsResponse([{ id: 'list-default', wellknownListName: 'defaultList' }]))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.updateTask({ providerTaskId: 'AAMk-task-1', title: 'Renamed' });

      expect(fetchMock.mock.calls[2][0]).toBe(
        'https://graph.microsoft.com/v1.0/users/sender%40example.com/todo/lists/list-default/tasks/AAMk-task-1',
      );
    });

    it('throws a clear error when Graph rejects the update', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Task not found' } }) });

      await expect(provider.updateTask({ providerTaskId: 'missing', listId: 'list-explicit', title: 'x' })).rejects.toThrow('Task not found');
    });
  });

  describe('deleteTask', () => {
    it('DELETEs the task, using an explicit listId when given', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

      await provider.deleteTask({ providerTaskId: 'AAMk-task-1', listId: 'list-explicit' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/todo/lists/list-explicit/tasks/AAMk-task-1');
      expect(call[1].method).toBe('DELETE');
    });

    it('treats a 404 as already-deleted rather than an error (idempotent delete)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'not found' } }) });

      await expect(provider.deleteTask({ providerTaskId: 'already-gone', listId: 'list-explicit' })).resolves.toBeUndefined();
    });

    it('throws a clear error for any other non-OK status', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient privileges' } }) });

      await expect(provider.deleteTask({ providerTaskId: 'AAMk-task-1', listId: 'list-explicit' })).rejects.toThrow('Insufficient privileges');
    });
  });
});
