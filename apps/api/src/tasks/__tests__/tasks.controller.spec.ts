import { TasksController } from '../tasks.controller';

describe('TasksController', () => {
  let tasks: { createTask: jest.Mock; updateTask: jest.Mock; deleteTask: jest.Mock };
  let controller: TasksController;

  beforeEach(() => {
    tasks = {
      createTask: jest.fn().mockResolvedValue({ providerTaskId: 't1' }),
      updateTask: jest.fn().mockResolvedValue(undefined),
      deleteTask: jest.fn().mockResolvedValue(undefined),
    };
    controller = new TasksController(tasks as any);
  });

  it('create() delegates to TasksService.createTask', async () => {
    const dto = { providerCode: 'MS_GRAPH', title: 'Follow up with candidate' } as any;
    const result = await controller.create(dto);

    expect(tasks.createTask).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ providerTaskId: 't1' });
  });

  it('update() delegates to TasksService.updateTask with the path param', async () => {
    const dto = { providerCode: 'MS_GRAPH', completed: true } as any;
    await controller.update('t1', dto);

    expect(tasks.updateTask).toHaveBeenCalledWith('t1', dto);
  });

  it('remove() delegates to TasksService.deleteTask with the path param', async () => {
    const dto = { providerCode: 'MS_GRAPH', listId: 'list-1' } as any;
    await controller.remove('t1', dto);

    expect(tasks.deleteTask).toHaveBeenCalledWith('t1', dto);
  });
});
