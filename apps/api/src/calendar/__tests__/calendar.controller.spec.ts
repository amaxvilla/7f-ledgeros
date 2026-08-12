import { CalendarController } from '../calendar.controller';

describe('CalendarController', () => {
  let calendar: { createEvent: jest.Mock; updateEvent: jest.Mock; cancelEvent: jest.Mock };
  let controller: CalendarController;

  beforeEach(() => {
    calendar = {
      createEvent: jest.fn().mockResolvedValue({ providerEventId: 'evt1' }),
      updateEvent: jest.fn().mockResolvedValue(undefined),
      cancelEvent: jest.fn().mockResolvedValue(undefined),
    };
    controller = new CalendarController(calendar as any);
  });

  it('create() delegates to CalendarService.createEvent', async () => {
    const dto = { providerCode: 'MS_GRAPH', title: 'x', startTime: '2026-01-01T00:00:00.000Z', endTime: '2026-01-01T01:00:00.000Z' } as any;
    const result = await controller.create(dto);

    expect(calendar.createEvent).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ providerEventId: 'evt1' });
  });

  it('update() delegates to CalendarService.updateEvent with the path param', async () => {
    const dto = { providerCode: 'MS_GRAPH', title: 'y' } as any;
    await controller.update('evt1', dto);

    expect(calendar.updateEvent).toHaveBeenCalledWith('evt1', dto);
  });

  it('cancel() delegates to CalendarService.cancelEvent with the path param', async () => {
    const dto = { providerCode: 'MS_GRAPH', comment: 'done' } as any;
    await controller.cancel('evt1', dto);

    expect(calendar.cancelEvent).toHaveBeenCalledWith('evt1', dto);
  });
});
