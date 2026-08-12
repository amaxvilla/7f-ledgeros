import { TeamsService } from '../teams.service';

describe('TeamsService', () => {
  let registry: { get: jest.Mock };
  let provider: { createMeeting: jest.Mock; cancelMeeting: jest.Mock };
  let service: TeamsService;

  beforeEach(() => {
    provider = {
      createMeeting: jest.fn().mockResolvedValue({ providerMeetingId: 'm1', joinUrl: 'https://teams.microsoft.com/l/meetup-join/m1' }),
      cancelMeeting: jest.fn().mockResolvedValue(undefined),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new TeamsService(registry as any);
  });

  describe('createMeeting', () => {
    it('resolves the provider by providerCode and converts startTime/endTime to real Dates', async () => {
      const result = await service.createMeeting({
        providerCode: 'MS_GRAPH',
        subject: 'Interview: Backend Engineer',
        startTime: '2026-08-15T09:00:00.000Z',
        endTime: '2026-08-15T09:30:00.000Z',
        organizerIdentifier: 'recruiter@7fifteencapital.com',
      });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      const params = provider.createMeeting.mock.calls[0][0];
      expect(params.subject).toBe('Interview: Backend Engineer');
      expect(params.organizerIdentifier).toBe('recruiter@7fifteencapital.com');
      expect(params.startTime).toBeInstanceOf(Date);
      expect(params.endTime).toBeInstanceOf(Date);
      expect(params.startTime.toISOString()).toBe('2026-08-15T09:00:00.000Z');
      expect(result).toEqual({ providerMeetingId: 'm1', joinUrl: 'https://teams.microsoft.com/l/meetup-join/m1' });
    });
  });

  describe('cancelMeeting', () => {
    it('resolves the provider and forwards providerMeetingId and organizerIdentifier', async () => {
      await service.cancelMeeting('m1', { providerCode: 'MS_GRAPH', organizerIdentifier: 'recruiter@7fifteencapital.com' });

      expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
      expect(provider.cancelMeeting).toHaveBeenCalledWith({
        providerMeetingId: 'm1',
        organizerIdentifier: 'recruiter@7fifteencapital.com',
      });
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No teams provider registered for providerCode "ZOOM"');
    });

    await expect(
      service.createMeeting({
        providerCode: 'ZOOM',
        subject: 'x',
        startTime: '2026-08-15T09:00:00.000Z',
        endTime: '2026-08-15T09:30:00.000Z',
        organizerIdentifier: 'a@b.com',
      }),
    ).rejects.toThrow('No teams provider registered for providerCode "ZOOM"');
  });
});
