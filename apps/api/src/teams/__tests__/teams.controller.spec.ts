import { TeamsController } from '../teams.controller';

describe('TeamsController', () => {
  let teams: { createMeeting: jest.Mock; cancelMeeting: jest.Mock };
  let controller: TeamsController;

  beforeEach(() => {
    teams = {
      createMeeting: jest.fn().mockResolvedValue({ providerMeetingId: 'm1', joinUrl: 'https://teams.microsoft.com/l/meetup-join/m1' }),
      cancelMeeting: jest.fn().mockResolvedValue(undefined),
    };
    controller = new TeamsController(teams as any);
  });

  it('create() delegates to TeamsService.createMeeting', async () => {
    const dto = {
      providerCode: 'MS_GRAPH',
      subject: 'Interview',
      startTime: '2026-08-15T09:00:00.000Z',
      endTime: '2026-08-15T09:30:00.000Z',
      organizerIdentifier: 'recruiter@7fifteencapital.com',
    } as any;

    const result = await controller.create(dto);

    expect(teams.createMeeting).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ providerMeetingId: 'm1', joinUrl: 'https://teams.microsoft.com/l/meetup-join/m1' });
  });

  it('cancel() delegates to TeamsService.cancelMeeting with the path param', async () => {
    const dto = { providerCode: 'MS_GRAPH', organizerIdentifier: 'recruiter@7fifteencapital.com' } as any;
    await controller.cancel('m1', dto);

    expect(teams.cancelMeeting).toHaveBeenCalledWith('m1', dto);
  });
});
