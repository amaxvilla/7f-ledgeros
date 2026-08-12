import { TasksService } from '../tasks.service';

describe('TasksService', () => {
  let registry: { get: jest.Mock };
  let provider: { createTask: jest.Mock; updateTask: jest.Mock; deleteTask: jest.Mock };
  let service: TasksService;

  beforeEach(() => {
    provider = {
      createTask: jest.fn().mockResolvedValue({ providerTaskId: 't1' }),
      updateTask: jest.fn().mockResolvedValue(undefined),
      deleteTask: jest.fn().mockResolvedValue(undefined),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new TasksService(registry as any);
  });

  describe('createTask', () => {
    it('resolves the provider by providerCode and forwards the rest of the params', async () => {
      const result = await service.createTask({
        providerCode: 'MS_GRAPH',
        title: 'Follow up with candidate',
        notes: 'Check references',
      });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.createTask).toHaveBeenCalledWith({
        title: 'Follow up with candidate',
        notes: 'Check references',
        dueDateTime: undefined,
      });
      expect(result).toEqual({ providerTaskId: 't1' });
    });

    it('converts dueDateTime from an ISO string to a real Date before calling the provider', async () => {
      await service.createTask({ providerCode: 'MS_GRAPH', title: 'x', dueDateTime: '2026-08-15T09:00:00.000Z' });

      const params = provider.createTask.mock.calls[0][0];
      expect(params.dueDateTime).toBeInstanceOf(Date);
      expect(params.dueDateTime.toISOString()).toBe('2026-08-15T09:00:00.000Z');
    });
  });

  describe('updateTask', () => {
    it('passes providerTaskId alongside the rest of the params', async () => {
      await service.updateTask('t1', { providerCode: 'MS_GRAPH', completed: true });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.updateTask).toHaveBeenCalledWith({ completed: true, dueDateTime: undefined, providerTaskId: 't1' });
    });

    it('converts dueDateTime from an ISO string to a real Date on update too', async () => {
      await service.updateTask('t1', { providerCode: 'MS_GRAPH', dueDateTime: '2026-09-01T00:00:00.000Z' });

      const params = provider.updateTask.mock.calls[0][0];
      expect(params.dueDateTime).toBeInstanceOf(Date);
    });
  });

  describe('deleteTask', () => {
    it('resolves the provider and forwards providerTaskId and listId', async () => {
      await service.deleteTask('t1', { providerCode: 'MS_GRAPH', listId: 'list-1' });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.deleteTask).toHaveBeenCalledWith({ providerTaskId: 't1', listId: 'list-1' });
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No tasks provider registered for providerCode "SALESFORCE"');
    });

    await expect(service.createTask({ providerCode: 'SALESFORCE', title: 'x' })).rejects.toThrow(
      'No tasks provider registered for providerCode "SALESFORCE"',
    );
  });
});
