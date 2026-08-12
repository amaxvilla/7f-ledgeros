import { CalendarService } from '../calendar.service';

describe('CalendarService', () => {
  let registry: { get: jest.Mock };
  let provider: { createEvent: jest.Mock; updateEvent: jest.Mock; cancelEvent: jest.Mock };
  let service: CalendarService;

  beforeEach(() => {
    provider = {
      createEvent: jest.fn().mockResolvedValue({ providerEventId: 'evt1', htmlLink: 'https://example.com/evt1' }),
      updateEvent: jest.fn().mockResolvedValue(undefined),
      cancelEvent: jest.fn().mockResolvedValue(undefined),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new CalendarService(registry as any);
  });

  describe('createEvent', () => {
    it('resolves the provider by providerCode and converts date strings to Date objects', async () => {
      const result = await service.createEvent({
        providerCode: 'MS_GRAPH',
        title: 'Site visit',
        startTime: '2026-08-01T10:00:00.000Z',
        endTime: '2026-08-01T11:00:00.000Z',
        attendeeEmails: ['a@example.com'],
      });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.createEvent).toHaveBeenCalledWith({
        title: 'Site visit',
        startTime: new Date('2026-08-01T10:00:00.000Z'),
        endTime: new Date('2026-08-01T11:00:00.000Z'),
        attendeeEmails: ['a@example.com'],
      });
      expect(result).toEqual({ providerEventId: 'evt1', htmlLink: 'https://example.com/evt1' });
    });
  });

  describe('updateEvent', () => {
    it('passes providerEventId and only converts the date fields that were supplied', async () => {
      await service.updateEvent('evt1', { providerCode: 'MS_GRAPH', title: 'Rescheduled site visit' });

      expect(provider.updateEvent).toHaveBeenCalledWith({
        title: 'Rescheduled site visit',
        providerEventId: 'evt1',
        startTime: undefined,
        endTime: undefined,
      });
    });

    it('converts startTime/endTime when both are supplied', async () => {
      await service.updateEvent('evt1', {
        providerCode: 'MS_GRAPH',
        startTime: '2026-08-02T10:00:00.000Z',
        endTime: '2026-08-02T11:00:00.000Z',
      });

      expect(provider.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: new Date('2026-08-02T10:00:00.000Z'),
          endTime: new Date('2026-08-02T11:00:00.000Z'),
        }),
      );
    });
  });

  describe('cancelEvent', () => {
    it('resolves the provider and forwards providerEventId/comment', async () => {
      await service.cancelEvent('evt1', { providerCode: 'MS_GRAPH', comment: 'No longer needed' });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.cancelEvent).toHaveBeenCalledWith({ providerEventId: 'evt1', comment: 'No longer needed' });
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No calendar provider registered for providerCode "GOOGLE"');
    });

    await expect(
      service.createEvent({ providerCode: 'GOOGLE', title: 'x', startTime: '2026-01-01T00:00:00.000Z', endTime: '2026-01-01T01:00:00.000Z' }),
    ).rejects.toThrow('No calendar provider registered for providerCode "GOOGLE"');
  });
});
