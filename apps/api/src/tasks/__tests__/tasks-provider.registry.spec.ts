import { TasksProviderRegistry } from '../tasks-provider.registry';
import { TasksProvider } from '../tasks-provider.interface';

function fakeProvider(): TasksProvider {
  return {
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
  };
}

describe('TasksProviderRegistry', () => {
  let registry: TasksProviderRegistry;

  beforeEach(() => {
    registry = new TasksProviderRegistry();
  });

  it('starts with no providers registered', () => {
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('MS_GRAPH')).toBe(false);
  });

  it('registers and retrieves a provider by code', () => {
    const provider = fakeProvider();
    registry.register('MS_GRAPH', provider);

    expect(registry.isRegistered('MS_GRAPH')).toBe(true);
    expect(registry.get('MS_GRAPH')).toBe(provider);
    expect(registry.list()).toEqual(['MS_GRAPH']);
  });

  it('throws a descriptive error when getting an unregistered code', () => {
    registry.register('MS_GRAPH', fakeProvider());

    expect(() => registry.get('GOOGLE_TASKS')).toThrow(/No tasks provider registered for providerCode "GOOGLE_TASKS"/);
    expect(() => registry.get('GOOGLE_TASKS')).toThrow(/MS_GRAPH/); // lists what IS registered
  });

  it('throws a clear "(none)" message when nothing is registered at all', () => {
    expect(() => registry.get('MS_GRAPH')).toThrow(/\(none\)/);
  });

  it('re-registering the same code overwrites the previous provider (last registration wins)', () => {
    const first = fakeProvider();
    const second = fakeProvider();
    registry.register('MS_GRAPH', first);
    registry.register('MS_GRAPH', second);

    expect(registry.get('MS_GRAPH')).toBe(second);
    expect(registry.list()).toEqual(['MS_GRAPH']);
  });

  it('supports multiple providers registered independently', () => {
    registry.register('MS_GRAPH', fakeProvider());
    registry.register('GOOGLE_TASKS', fakeProvider());

    expect(registry.list().sort()).toEqual(['GOOGLE_TASKS', 'MS_GRAPH']);
  });
});
