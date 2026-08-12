import { PresenceController } from '../presence.controller';

describe('PresenceController', () => {
  let presence: { getPresence: jest.Mock };
  let controller: PresenceController;

  beforeEach(() => {
    presence = { getPresence: jest.fn().mockResolvedValue({ availability: 'Busy', activity: 'InAMeeting' }) };
    controller = new PresenceController(presence as any);
  });

  it('getPresence() delegates to PresenceService.getPresence with both query params', async () => {
    const result = await controller.getPresence('MS_GRAPH', 'recruiter@7fifteencapital.com');

    expect(presence.getPresence).toHaveBeenCalledWith('MS_GRAPH', 'recruiter@7fifteencapital.com');
    expect(result).toEqual({ availability: 'Busy', activity: 'InAMeeting' });
  });
});
